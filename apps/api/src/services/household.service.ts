import { randomBytes } from 'crypto';
import type { HydratedDocument } from 'mongoose';
import { User, IUser } from '../models/user.js';
import { Household } from '../models/household.js';
import { HouseholdInvite } from '../models/householdInvite.js';
import { AppError } from '../utils/errors.js';
import type { HouseholdResponse, InviteResponse } from '@shelfchef/shared';

function toHouseholdResponse(
  household: { _id: unknown; name: string },
  members: HydratedDocument<IUser>[],
): HouseholdResponse {
  return {
    id: String(household._id),
    name: household.name,
    members: members.map((m) => ({ id: m._id.toString(), email: m.email })),
  };
}

function generateCode(): string {
  // 6 random bytes → 12 hex chars, take first 8 and uppercase
  return randomBytes(6).toString('hex').slice(0, 8).toUpperCase();
}

export async function createHousehold(
  userId: string,
  name: string,
): Promise<HouseholdResponse> {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  if (user.household) throw new AppError(409, 'Already in a household', 'ALREADY_IN_HOUSEHOLD');

  const household = await Household.create({ name, members: [user._id] });
  user.household = household._id;
  await user.save();

  return toHouseholdResponse(household, [user]);
}

export async function getHousehold(userId: string): Promise<HouseholdResponse> {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  if (!user.household) throw new AppError(404, 'No household', 'NO_HOUSEHOLD');

  const household = await Household.findById(user.household);
  if (!household) throw new AppError(404, 'Household not found', 'HOUSEHOLD_NOT_FOUND');

  const members = await User.find({ _id: { $in: household.members } });
  return toHouseholdResponse(household, members);
}

export async function generateInvite(userId: string): Promise<InviteResponse> {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  if (!user.household) throw new AppError(403, 'Must be in a household to invite', 'NO_HOUSEHOLD');

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  // Retry once on the rare collision of the unique code constraint
  let invite;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      invite = await HouseholdInvite.create({
        household: user.household,
        code: generateCode(),
        createdBy: user._id,
        expiresAt,
      });
      break;
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 11000) {
        continue;
      }
      throw err;
    }
  }
  if (!invite) throw new AppError(500, 'Failed to generate invite code', 'INVITE_GENERATION_FAILED');

  return { code: invite.code, expiresAt: invite.expiresAt.toISOString() };
}

export async function joinHousehold(
  userId: string,
  code: string,
): Promise<HouseholdResponse> {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  if (user.household) throw new AppError(409, 'Already in a household', 'ALREADY_IN_HOUSEHOLD');

  const invite = await HouseholdInvite.findOne({ code });
  if (!invite) throw new AppError(404, 'Invite not found', 'INVITE_NOT_FOUND');
  if (invite.usedBy) throw new AppError(409, 'Invite already used', 'INVITE_ALREADY_USED');
  if (invite.expiresAt < new Date()) throw new AppError(410, 'Invite expired', 'INVITE_EXPIRED');

  const household = await Household.findById(invite.household);
  if (!household) throw new AppError(404, 'Household not found', 'HOUSEHOLD_NOT_FOUND');

  household.members.push(user._id);
  await household.save();

  invite.usedBy = user._id;
  await invite.save();

  user.household = household._id;
  await user.save();

  const members = await User.find({ _id: { $in: household.members } });
  return toHouseholdResponse(household, members);
}

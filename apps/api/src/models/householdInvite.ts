import { Schema, model, Types } from 'mongoose';

export interface IHouseholdInvite {
  household: Types.ObjectId;
  code: string;
  createdBy: Types.ObjectId;
  expiresAt: Date;
  usedBy: Types.ObjectId | null;
}

const householdInviteSchema = new Schema<IHouseholdInvite>(
  {
    household: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    code: { type: String, required: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    usedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const HouseholdInvite = model<IHouseholdInvite>('HouseholdInvite', householdInviteSchema);

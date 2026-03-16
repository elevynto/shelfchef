import { Types } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { PantryItem, IPantryItem } from '../models/pantryItem.js';
import { AppError } from '../utils/errors.js';
import type {
  PantryItemInput,
  UpdatePantryItemInput,
  PantryItemResponse,
} from '@shelfchef/shared';

function toResponse(item: HydratedDocument<IPantryItem>): PantryItemResponse {
  return {
    id: item._id.toString(),
    household: item.household.toString(),
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    aliases: item.aliases,
    spoonacularIngredientId: item.spoonacularIngredientId,
    expiresAt: item.expiresAt ? item.expiresAt.toISOString() : null,
    addedBy: item.addedBy.toString(),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function listItems(householdId: string): Promise<PantryItemResponse[]> {
  const items = await PantryItem.find({ household: householdId });
  return items.map(toResponse);
}

export async function addItem(
  householdId: string,
  userId: string,
  input: PantryItemInput,
): Promise<PantryItemResponse> {
  const item = await PantryItem.create({
    household: householdId,
    addedBy: userId,
    ...input,
  });
  return toResponse(item);
}

export async function updateItem(
  householdId: string,
  itemId: string,
  input: UpdatePantryItemInput,
): Promise<PantryItemResponse> {
  if (!Types.ObjectId.isValid(itemId)) {
    throw new AppError(404, 'Item not found', 'ITEM_NOT_FOUND');
  }

  if (Object.keys(input).length === 0) {
    throw new AppError(400, 'No fields to update', 'NO_UPDATE_FIELDS');
  }

  const item = await PantryItem.findOneAndUpdate(
    { _id: itemId, household: householdId },
    { $set: input },
    { new: true, runValidators: true },
  );

  if (!item) throw new AppError(404, 'Item not found', 'ITEM_NOT_FOUND');
  return toResponse(item);
}

export async function deleteItem(householdId: string, itemId: string): Promise<void> {
  if (!Types.ObjectId.isValid(itemId)) {
    throw new AppError(404, 'Item not found', 'ITEM_NOT_FOUND');
  }

  const item = await PantryItem.findOneAndDelete({ _id: itemId, household: householdId });
  if (!item) throw new AppError(404, 'Item not found', 'ITEM_NOT_FOUND');
}

export async function bulkAdd(
  householdId: string,
  userId: string,
  items: PantryItemInput[],
): Promise<PantryItemResponse[]> {
  const docs = items.map((input) => ({
    household: householdId,
    addedBy: userId,
    ...input,
  }));
  const created = await PantryItem.insertMany(docs);
  return created.map((item) => toResponse(item as unknown as HydratedDocument<IPantryItem>));
}

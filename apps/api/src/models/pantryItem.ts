import { Schema, model, Types } from 'mongoose';
import { CanonicalUnit } from '@shelfchef/shared';

const canonicalUnitValues = Object.values(CanonicalUnit);

export interface IPantryItem {
  household: Types.ObjectId;
  name: string;
  quantity: number;
  unit: string;
  spoonacularIngredientId: number | null;
  aliases: string[];
  addedBy: Types.ObjectId;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const pantryItemSchema = new Schema<IPantryItem>(
  {
    household: { type: Schema.Types.ObjectId, ref: 'Household', required: true, index: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: canonicalUnitValues, required: true },
    spoonacularIngredientId: { type: Number, default: null },
    aliases: [{ type: String }],
    addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const PantryItem = model<IPantryItem>('PantryItem', pantryItemSchema);

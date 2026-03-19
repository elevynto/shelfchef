import { Schema, model, Types } from 'mongoose';

interface IRecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  spoonacularIngredientId: number | null;
}

export interface IRecipe {
  source: 'spoonacular' | 'custom';
  spoonacularId: number | null;
  household: Types.ObjectId | null;
  title: string;
  description: string;
  imageUrl: string | null;
  servings: number;
  readyInMinutes: number | null;
  ingredients: IRecipeIngredient[];
  instructions: string[];
  cachedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const recipeIngredientSchema = new Schema<IRecipeIngredient>(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    spoonacularIngredientId: { type: Number, default: null },
  },
  { _id: false },
);

const recipeSchema = new Schema<IRecipe>(
  {
    source: { type: String, enum: ['spoonacular', 'custom'], required: true },
    spoonacularId: { type: Number, default: null },
    household: { type: Schema.Types.ObjectId, ref: 'Household', default: null },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    imageUrl: { type: String, default: null },
    servings: { type: Number, required: true, min: 1 },
    readyInMinutes: { type: Number, default: null },
    ingredients: { type: [recipeIngredientSchema], required: true },
    instructions: { type: [String], required: true },
    cachedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

recipeSchema.index({ spoonacularId: 1 }, { sparse: true });
recipeSchema.index({ household: 1 });

export const Recipe = model<IRecipe>('Recipe', recipeSchema);

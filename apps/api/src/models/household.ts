import { Schema, model, Types } from 'mongoose';

export interface IHousehold {
  name: string;
  members: Types.ObjectId[];
  deletedAt: Date | null;
}

const householdSchema = new Schema<IHousehold>(
  {
    name: { type: String, required: true, trim: true },
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Household = model<IHousehold>('Household', householdSchema);

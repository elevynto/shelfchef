import { Schema, model, Types } from 'mongoose';

export interface IUser {
  email: string;
  passwordHash: string | null;
  oauthProviders: Array<{ provider: 'google' | 'github'; providerId: string }>;
  emailVerified: boolean;
  household: Types.ObjectId | null;
  refreshTokenHash: string | null;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, default: null },
    oauthProviders: [
      {
        provider: { type: String, enum: ['google', 'github'], required: true },
        providerId: { type: String, required: true },
      },
    ],
    emailVerified: { type: Boolean, default: false },
    household: { type: Schema.Types.ObjectId, ref: 'Household', default: null },
    refreshTokenHash: { type: String, default: null },
  },
  { timestamps: true },
);

export const User = model<IUser>('User', userSchema);

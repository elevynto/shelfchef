import express from 'express';
import cookieParser from 'cookie-parser';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import householdRouter from './routes/household.js';
import pantryRouter from './routes/pantry.js';
import recipeRouter from './routes/recipe.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/households', householdRouter);
  app.use('/api/v1/pantry', pantryRouter);
  app.use('/api/v1/recipes', recipeRouter);

  app.use(errorHandler);

  return app;
}

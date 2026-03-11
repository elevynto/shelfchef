import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

interface HttpError {
  status?: number;
  message?: string;
}

function isHttpError(err: unknown): err is HttpError {
  return typeof err === 'object' && err !== null;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  const status = isHttpError(err) && typeof err.status === 'number' ? err.status : 500;
  const message =
    isHttpError(err) && typeof err.message === 'string' ? err.message : 'Internal server error';

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({ error: message });
}

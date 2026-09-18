import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors';
import { logger } from '../utils/logger';

const HTTP_INTERNAL_SERVER_ERROR = 500;

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof AppError) {
    logger.warn(error.message, { code: error.code, path: req.path });
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error instanceof Error && 'details' in error ? { details: error.details } : {}),
      },
    });
    return;
  }

  const unexpectedError = error instanceof Error ? error : new Error('Unknown error');
  logger.error(unexpectedError.message, { stack: unexpectedError.stack, path: req.path });

  res.status(HTTP_INTERNAL_SERVER_ERROR).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocorreu um erro inesperado',
    },
  });
}

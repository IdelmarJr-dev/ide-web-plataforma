import type { Request, Response } from 'express';

const HTTP_NOT_FOUND = 404;

export function notFoundHandler(req: Request, res: Response): void {
  res.status(HTTP_NOT_FOUND).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Rota ${req.method} ${req.path} não encontrada`,
    },
  });
}

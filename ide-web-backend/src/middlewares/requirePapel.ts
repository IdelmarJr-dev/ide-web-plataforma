import type { NextFunction, Request, Response } from 'express';
import type { Papel } from '../generated/prisma/client';
import { ForbiddenError, UnauthorizedError } from '../errors';

export function requirePapel(...papeisPermitidos: Papel[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      next(new UnauthorizedError('Autenticação necessária'));
      return;
    }

    if (!papeisPermitidos.includes(req.usuario.papel)) {
      next(new ForbiddenError('Sem permissão para acessar este recurso'));
      return;
    }

    next();
  };
}

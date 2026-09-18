import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../errors';
import { PrismaSessaoAuthRepository } from '../repositories/SessaoAuthRepository';
import { SessaoAuthService } from '../services/SessaoAuthService';
import { getAccessTokenCookie } from '../utils/cookies';
import { verifyToken } from '../utils/jwt';

const sessaoService = new SessaoAuthService(new PrismaSessaoAuthRepository());

/**
 * Além de conferir a assinatura do token, carrega a sessão: é o que faz o logout
 * revogar de verdade e a janela de inatividade valer (Fase 10, D1). O custo é uma
 * leitura por requisição autenticada.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const accessToken = getAccessTokenCookie(req.cookies as Record<string, string | undefined>);
  if (!accessToken) {
    next(new UnauthorizedError('Autenticação necessária'));
    return;
  }

  let payload;
  try {
    payload = verifyToken(accessToken, 'access');
  } catch {
    next(new UnauthorizedError('Sessão inválida ou expirada'));
    return;
  }

  sessaoService
    .validar(payload.sid)
    .then(() => {
      req.usuario = { id: payload.sub, papel: payload.papel, sessaoId: payload.sid };
      next();
    })
    .catch((erro: unknown) => {
      next(erro);
    });
}

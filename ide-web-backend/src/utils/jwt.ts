import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { Papel } from '../generated/prisma/client';

export type TokenType = 'access' | 'refresh';

export interface JwtPayload {
  sub: string;
  papel: Papel;
  type: TokenType;
  /** Id da SessaoAuth — é por ele que o `requireAuth` revoga (Fase 10, D1). */
  sid: string;
}

type ExpiresIn = NonNullable<jwt.SignOptions['expiresIn']>;

export function signAccessToken(usuarioId: string, papel: Papel, sessaoId: string): string {
  const payload: JwtPayload = { sub: usuarioId, papel, type: 'access', sid: sessaoId };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.accessExpiresIn as ExpiresIn });
}

export function signRefreshToken(usuarioId: string, papel: Papel, sessaoId: string, expiresIn?: ExpiresIn): string {
  const payload: JwtPayload = { sub: usuarioId, papel, type: 'refresh', sid: sessaoId };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: expiresIn ?? (config.jwt.refreshExpiresIn as ExpiresIn) });
}

export function verifyToken(token: string, expectedType: TokenType): JwtPayload {
  const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

  if (decoded.type !== expectedType) {
    throw new Error(`Expected a ${expectedType} token`);
  }

  return decoded;
}

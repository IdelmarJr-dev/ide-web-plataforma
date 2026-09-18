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

export interface ResearchJwtPayload {
  usuario_id: string;
  papel: Papel;
  // Lista porque o aluno pode estar em várias turmas — quem decide qual delas está em
  // pesquisa é o backend Python, o único que conhece as pesquisas ativas (Fase 8).
  turma_ids: string[];
}

/**
 * Token curto pro front usar como Bearer nas chamadas diretas ao backend Python de
 * pesquisa (self-hosted) — assinado com um segredo separado do JWT_SECRET normal,
 * compartilhado só entre este backend e o Docker do autor. Carrega só o mínimo (sem
 * nome). Ver docs/decisions/fase4-pesquisa-python-sessao-aluno-login.md e fase6.
 */
export function signResearchToken(payload: ResearchJwtPayload): string {
  return jwt.sign(payload, config.researchJwt.secret, {
    expiresIn: config.researchJwt.expiresIn as ExpiresIn,
  });
}

export function verifyResearchToken(token: string): ResearchJwtPayload {
  return jwt.verify(token, config.researchJwt.secret) as ResearchJwtPayload;
}

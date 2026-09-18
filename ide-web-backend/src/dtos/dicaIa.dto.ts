import { z } from 'zod';
import type { DicaIa } from '../generated/prisma/client';
import { documentoModelagemSchema, documentoTemConteudo } from './modelagem.schema';

export const pedirDicaBodySchema = z
  .object({
    contexto: z.enum(['sql', 'mer']),
    // Estado ao vivo dos editores no momento do clique (não o último persistido) — ver
    // docs/decisions/fase3-dicas-ia.md. Desde a Fase 6 os dois vêm juntos quando o
    // exercício tem as duas partes, pra IA poder apontar incoerência entre MER e SQL.
    estadoMer: documentoModelagemSchema.optional(),
    estadoSql: z.string().optional(),
  })
  .refine((body) => body.contexto !== 'sql' || (body.estadoSql?.trim() ?? '') !== '', {
    message: 'Escreva alguma coisa no editor SQL antes de pedir dica',
    path: ['estadoSql'],
  })
  .refine((body) => body.contexto !== 'mer' || (body.estadoMer !== undefined && documentoTemConteudo(body.estadoMer)), {
    message: 'Desenhe ao menos uma entidade ou tabela antes de pedir dica',
    path: ['estadoMer'],
  });

export type PedirDicaBodyDto = z.infer<typeof pedirDicaBodySchema>;

export interface DicaIaResponseDto {
  id: string;
  contexto: 'sql' | 'mer';
  respostaIa: string;
  criadoEm: string;
}

export function toDicaIaResponseDto(dica: DicaIa): DicaIaResponseDto {
  return {
    id: dica.id,
    contexto: dica.contexto,
    respostaIa: dica.resposta_ia,
    criadoEm: dica.criado_em.toISOString(),
  };
}

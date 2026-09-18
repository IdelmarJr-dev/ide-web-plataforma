import type { Papel } from '../generated/prisma/client';

declare global {
  namespace Express {
    interface Request {
      usuario?: {
        id: string;
        papel: Papel;
        /** Sessão do login atual — usada pelo logout pra revogar (Fase 10, D1). */
        sessaoId: string;
      };
    }
  }
}

export {};

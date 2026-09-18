import { z } from 'zod';

const MAX_IMAGENS = 2;
const MAX_ROTULO = 60;
const MAX_SQL_MODELO = 20_000;

export const gerarPacoteBodySchema = z.object({
  // Imagens dos modelos em PNG base64, sem o prefixo `data:image/png;base64,` — geradas
  // no frontend a partir do canvas React Flow. No modo conceitual → lógico vêm as duas
  // (ver docs/decisions/fase7-modelagem-conceitual-logica.md).
  imagens: z
    .array(z.object({ rotulo: z.string().min(1).max(MAX_ROTULO), pngBase64: z.string().min(1) }))
    .max(MAX_IMAGENS)
    .optional(),
  // SQL gerado do modelo lógico do aluno (ausente no modo puramente conceitual).
  sqlModelo: z.string().max(MAX_SQL_MODELO).optional(),
});

export type GerarPacoteBodyDto = z.infer<typeof gerarPacoteBodySchema>;

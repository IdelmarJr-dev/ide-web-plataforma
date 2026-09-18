import { z } from 'zod';

const MAX_EXERCICIOS = 50;

// `?exercicioIds=a,b,c` — os exercícios da tarefa de uma pesquisa (definidos no backend Python).
export const acertosQuerySchema = z.object({
  exercicioIds: z
    .string()
    .min(1)
    .transform((valor) => [...new Set(valor.split(',').map((id) => id.trim()).filter(Boolean))])
    .pipe(z.array(z.string().uuid()).min(1).max(MAX_EXERCICIOS)),
});

export type AcertosQueryDto = z.infer<typeof acertosQuerySchema>;

export interface AcertoExercicioDto {
  exercicioId: string;
  tentativas: number;
  // null = nenhuma submissão; true = alguma submissão correta; false = tentou e não acertou.
  correta: boolean | null;
  dicasSql: number;
  dicasMer: number;
}

export interface AcertosAlunoDto {
  usuarioId: string;
  exercicios: AcertoExercicioDto[];
}

export interface AcertosResponseDto {
  turmaId: string;
  exercicioIds: string[];
  alunos: AcertosAlunoDto[];
}

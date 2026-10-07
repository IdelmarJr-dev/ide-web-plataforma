/**
 * Popula `GET /exercicios/publicos` (estudo livre, Fase 8) com exercícios de exemplo —
 * hoje a lista vem vazia porque nenhum exercício tem `publico: true`. Autoria própria do
 * projeto IDE Web: os enunciados usam entidades genéricas (clientes/pedidos/produtos),
 * sem copiar texto de nenhuma fonte externa. Idempotente por `titulo` (find-then-create).
 * Depende da turma de demonstração — rode `seed-exemplos.ts` antes se for a primeira vez.
 *
 * Uso: npx tsx scripts/seed-exercicios-publicos.ts
 */
import type { Exercicio, Turma } from '../src/generated/prisma/client';
import { prisma } from '../src/lib/prisma';
import { logger } from '../src/utils/logger';

const CODIGO_TURMA_DEMO = 'DEMO01';
const AUTORIA = 'Exercício de autoria própria do projeto IDE Web.';

interface ExercicioPublicoSeed {
  titulo: string;
  enunciado: string;
  nivelDificuldade: 'iniciante' | 'intermediario';
  sqlSetup: string;
  sqlGabarito: string;
  ordem: number;
}

const EXERCICIOS_PUBLICOS: ExercicioPublicoSeed[] = [
  {
    titulo: '[Público] Produtos em estoque',
    enunciado:
      `Escreva uma consulta que liste nome e preço de todos os produtos com estoque maior que zero, ` +
      `em ordem decrescente de preço.\n\n${AUTORIA}`,
    nivelDificuldade: 'iniciante',
    sqlSetup:
      'CREATE TABLE produtos (\n' +
      '  id SERIAL PRIMARY KEY,\n' +
      '  nome TEXT NOT NULL,\n' +
      '  preco NUMERIC(10,2) NOT NULL,\n' +
      '  estoque INTEGER NOT NULL DEFAULT 0\n' +
      ');\n\n' +
      "INSERT INTO produtos (nome, preco, estoque) VALUES\n" +
      "  ('Teclado mecânico', 350.00, 12),\n" +
      "  ('Mouse sem fio', 89.90, 0),\n" +
      "  ('Monitor 24 polegadas', 899.00, 5),\n" +
      "  ('Cadeira gamer', 1200.00, 0),\n" +
      "  ('Headset USB', 199.90, 20);",
    sqlGabarito: 'SELECT nome, preco FROM produtos WHERE estoque > 0 ORDER BY preco DESC;',
    ordem: 1,
  },
  {
    titulo: '[Público] Total de pedidos por cliente',
    enunciado:
      'Escreva uma consulta que mostre o nome de cada cliente e a quantidade de pedidos que ele fez, ' +
      'incluindo clientes sem nenhum pedido (quantidade 0), ordenado por quantidade decrescente e depois ' +
      `pelo nome em ordem alfabética.\n\n${AUTORIA}`,
    nivelDificuldade: 'intermediario',
    sqlSetup:
      'CREATE TABLE clientes (\n' +
      '  id SERIAL PRIMARY KEY,\n' +
      '  nome TEXT NOT NULL\n' +
      ');\n\n' +
      'CREATE TABLE pedidos (\n' +
      '  id SERIAL PRIMARY KEY,\n' +
      '  cliente_id INTEGER NOT NULL REFERENCES clientes(id)\n' +
      ');\n\n' +
      "INSERT INTO clientes (nome) VALUES ('Ana Souza'), ('Bruno Lima'), ('Carla Dias');\n" +
      'INSERT INTO pedidos (cliente_id) VALUES (1), (1), (2);',
    sqlGabarito:
      'SELECT c.nome, COUNT(p.id) AS total_pedidos\n' +
      'FROM clientes c\n' +
      'LEFT JOIN pedidos p ON p.cliente_id = c.id\n' +
      'GROUP BY c.nome\n' +
      'ORDER BY total_pedidos DESC, c.nome ASC;',
    ordem: 2,
  },
  {
    titulo: '[Público] Clientes sem nenhum pedido',
    enunciado:
      'Escreva uma consulta que liste o nome dos clientes que nunca fizeram nenhum pedido, ' +
      `em ordem alfabética.\n\n${AUTORIA}`,
    nivelDificuldade: 'intermediario',
    sqlSetup:
      'CREATE TABLE clientes (\n' +
      '  id SERIAL PRIMARY KEY,\n' +
      '  nome TEXT NOT NULL\n' +
      ');\n\n' +
      'CREATE TABLE pedidos (\n' +
      '  id SERIAL PRIMARY KEY,\n' +
      '  cliente_id INTEGER NOT NULL REFERENCES clientes(id)\n' +
      ');\n\n' +
      "INSERT INTO clientes (nome) VALUES ('Ana Souza'), ('Bruno Lima'), ('Carla Dias');\n" +
      'INSERT INTO pedidos (cliente_id) VALUES (1);',
    sqlGabarito:
      'SELECT c.nome\n' +
      'FROM clientes c\n' +
      'WHERE NOT EXISTS (SELECT 1 FROM pedidos p WHERE p.cliente_id = c.id)\n' +
      'ORDER BY c.nome;',
    ordem: 3,
  },
];

async function obterTurmaDemo(): Promise<Turma> {
  const existente = await prisma.turma.findUnique({ where: { codigo: CODIGO_TURMA_DEMO } });
  if (existente) return existente;

  throw new Error(
    `Turma de demonstração "${CODIGO_TURMA_DEMO}" não encontrada. Rode "npx tsx scripts/seed-exemplos.ts" primeiro.`,
  );
}

async function upsertExercicioPublico(turmaId: string, seed: ExercicioPublicoSeed): Promise<Exercicio> {
  const existente = await prisma.exercicio.findFirst({ where: { turma_id: turmaId, titulo: seed.titulo } });
  if (existente) {
    return prisma.exercicio.update({
      where: { id: existente.id },
      data: {
        enunciado: seed.enunciado,
        sql_setup: seed.sqlSetup,
        sql_gabarito: seed.sqlGabarito,
        publico: true,
        gabarito_liberado: true,
        gabarito_liberado_em: existente.gabarito_liberado_em ?? new Date(),
      },
    });
  }

  return prisma.exercicio.create({
    data: {
      turma_id: turmaId,
      titulo: seed.titulo,
      enunciado: seed.enunciado,
      nivel_dificuldade: seed.nivelDificuldade,
      sql_setup: seed.sqlSetup,
      sql_gabarito: seed.sqlGabarito,
      publico: true,
      gabarito_liberado: true,
      gabarito_liberado_em: new Date(),
      ordem: seed.ordem,
    },
  });
}

async function main(): Promise<void> {
  const turma = await obterTurmaDemo();

  const criados: string[] = [];
  for (const seed of EXERCICIOS_PUBLICOS) {
    const exercicio = await upsertExercicioPublico(turma.id, seed);
    criados.push(exercicio.titulo);
  }

  logger.info('Exercícios públicos prontos', { quantidade: criados.length, titulos: criados });
}

main()
  .catch((error: unknown) => {
    logger.error('Falha ao criar exercícios públicos', {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });

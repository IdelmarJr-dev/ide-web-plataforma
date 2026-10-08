/**
 * Cria as contas de aluno da coleta (conta_teste1 … conta_teste40), com senha aleatória
 * por conta, e opcionalmente já matricula todas numa turma pelo código.
 *
 * As senhas ficam só em scripts/.contas-alunos.csv (fora do git) — é a lista que vai pra
 * sala. Idempotente: rodar de novo reaproveita as senhas do CSV, então a lista impressa
 * continua valendo; conta existente sem senha no CSV ganha senha nova.
 *
 * Uso (contra o DATABASE_URL carregado — em produção, passe o do Render; no PowerShell
 * use aspas simples, a senha pode ter `$`):
 *
 *   $env:DATABASE_URL='postgresql://...'; $env:TURMA_CODIGO='ABC123'; npx tsx scripts/seed-contas-alunos.ts
 */
import { randomInt } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Turma } from '../src/generated/prisma/client';
import { prisma } from '../src/lib/prisma';
import { logger } from '../src/utils/logger';
import { hashPassword } from '../src/utils/password';

const ARQUIVO_CONTAS = join(__dirname, '.contas-alunos.csv');
const QUANTIDADE_PADRAO = 40;
const QUANTIDADE_CONTAS = Number(process.env.QUANTIDADE_CONTAS ?? QUANTIDADE_PADRAO);
const PREFIXO = 'conta_teste';
const DOMINIO_EMAIL = 'ide-web.local';
const TAMANHO_SENHA = 10;
// Sem 0/O, 1/l/I: a senha vai ser lida num papel e digitada.
const ALFABETO_SENHA = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface ContaAluno {
  numero: number;
  nome: string;
  email: string;
  senha: string;
}

function gerarSenha(): string {
  return Array.from({ length: TAMANHO_SENHA }, () => ALFABETO_SENHA[randomInt(ALFABETO_SENHA.length)]).join('');
}

function lerSenhasSalvas(): Map<string, string> {
  const senhas = new Map<string, string>();
  if (!existsSync(ARQUIVO_CONTAS)) return senhas;

  const [, ...linhas] = readFileSync(ARQUIVO_CONTAS, 'utf-8').trim().split(/\r?\n/);
  for (const linha of linhas) {
    const [, , email, senha] = linha.split(',');
    if (email && senha) senhas.set(email, senha);
  }
  return senhas;
}

function salvarContas(contas: ContaAluno[]): void {
  const linhas = contas.map(({ numero, nome, email, senha }) => [numero, nome, email, senha].join(','));
  writeFileSync(ARQUIVO_CONTAS, ['numero,nome,email,senha', ...linhas].join('\n') + '\n', 'utf-8');
}

async function obterTurma(codigo: string): Promise<Turma> {
  const turma = await prisma.turma.findUnique({ where: { codigo } });
  if (!turma) throw new Error(`Turma com código "${codigo}" não encontrada.`);
  if (turma.encerrada_em) throw new Error(`Turma "${codigo}" está encerrada — reabra antes de matricular.`);
  return turma;
}

async function main(): Promise<void> {
  if (!Number.isInteger(QUANTIDADE_CONTAS) || QUANTIDADE_CONTAS < 1) {
    throw new Error('QUANTIDADE_CONTAS precisa ser um inteiro positivo.');
  }

  const codigoTurma = process.env.TURMA_CODIGO;
  const turma = codigoTurma ? await obterTurma(codigoTurma) : null;
  const senhasSalvas = lerSenhasSalvas();
  const contas: ContaAluno[] = [];
  let criadas = 0;
  let senhasNovas = 0;

  for (let numero = 1; numero <= QUANTIDADE_CONTAS; numero += 1) {
    const nome = `${PREFIXO}${String(numero)}`;
    const email = `${nome}@${DOMINIO_EMAIL}`;
    const existente = await prisma.usuario.findUnique({ where: { email } });

    if (existente && existente.papel !== 'aluno') {
      throw new Error(`${email} já existe com papel "${existente.papel}" — não vou sobrescrever.`);
    }

    const senhaSalva = senhasSalvas.get(email);
    const senha = senhaSalva ?? gerarSenha();
    let usuarioId = existente?.id;

    if (!existente) {
      const criado = await prisma.usuario.create({
        data: { nome, email, senha_hash: await hashPassword(senha), papel: 'aluno' },
      });
      usuarioId = criado.id;
      criadas += 1;
    } else if (!senhaSalva) {
      await prisma.usuario.update({ where: { id: existente.id }, data: { senha_hash: await hashPassword(senha) } });
      senhasNovas += 1;
    }

    if (turma && usuarioId) {
      await prisma.matriculaTurma.upsert({
        where: { aluno_id_turma_id: { aluno_id: usuarioId, turma_id: turma.id } },
        create: { aluno_id: usuarioId, turma_id: turma.id },
        update: {},
      });
    }

    contas.push({ numero, nome, email, senha });
  }

  salvarContas(contas);
  logger.info('Contas de aluno prontas', {
    total: contas.length,
    criadas,
    senhasNovas,
    turma: turma?.codigo ?? null,
    arquivo: ARQUIVO_CONTAS,
  });
}

main()
  .catch((error: unknown) => {
    logger.error('Falha ao criar contas de aluno', {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });

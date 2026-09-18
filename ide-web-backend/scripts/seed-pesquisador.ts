/**
 * Cria (ou atualiza) a conta única de pesquisador. O papel `pesquisador` não é mais
 * registrável por `POST /auth/registrar` (ver src/dtos/auth.dto.ts) — essa é a única
 * porta de entrada pra essa conta, e ela é do autor, não de autocadastro.
 *
 * Idempotente: roda de novo pra trocar a senha (upsert por e-mail). Nunca imprime a
 * senha em log, e ela nunca fica hardcoded aqui — vem de variável de ambiente na hora
 * de rodar, pra não deixar rastro em texto plano no histórico do git.
 *
 * Uso (local ou produção, contra o DATABASE_URL do .env carregado):
 *
 *   PESQUISADOR_NOME="Nome do Autor" \
 *   PESQUISADOR_EMAIL="prof.ifpi@pesquisador" \
 *   PESQUISADOR_SENHA="a senha real" \
 *   npx tsx scripts/seed-pesquisador.ts
 */
import { prisma } from '../src/lib/prisma';
import { logger } from '../src/utils/logger';
import { hashPassword } from '../src/utils/password';

async function main(): Promise<void> {
  const nome = process.env.PESQUISADOR_NOME;
  const email = process.env.PESQUISADOR_EMAIL;
  const senha = process.env.PESQUISADOR_SENHA;

  if (!nome || !email || !senha) {
    throw new Error(
      'Defina PESQUISADOR_NOME, PESQUISADOR_EMAIL e PESQUISADOR_SENHA na variável de ambiente antes de rodar este script.',
    );
  }

  const senha_hash = await hashPassword(senha);

  const usuario = await prisma.usuario.upsert({
    where: { email },
    create: { nome, email, senha_hash, papel: 'pesquisador' },
    // Se já existir com outro papel (ex.: criado antes desta restrição, como
    // professor/aluno), o upsert corrige pra pesquisador também — é a mesma conta.
    update: { nome, senha_hash, papel: 'pesquisador' },
  });

  logger.info('Conta de pesquisador pronta', { email: usuario.email, usuarioId: usuario.id });
}

main()
  .catch((error: unknown) => {
    logger.error('Falha ao criar/atualizar conta de pesquisador', {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });

import { Router } from 'express';
import { PesquisaController } from '../controllers/PesquisaController';
import { requireAuth } from '../middlewares/requireAuth';
import { requirePapel } from '../middlewares/requirePapel';
import { PrismaAlocacaoGrupoRepository } from '../repositories/AlocacaoGrupoRepository';
import { PrismaDicaIaRepository } from '../repositories/DicaIaRepository';
import { PrismaExercicioRepository } from '../repositories/ExercicioRepository';
import { PrismaMatriculaRepository } from '../repositories/MatriculaRepository';
import { PrismaPesquisaRepository } from '../repositories/PesquisaRepository';
import { PrismaRespostaRtlxRepository } from '../repositories/RespostaRtlxRepository';
import { PrismaRespostaSusRepository } from '../repositories/RespostaSusRepository';
import { PrismaSessaoUsoRepository } from '../repositories/SessaoUsoRepository';
import { PrismaSubmissaoSqlRepository } from '../repositories/SubmissaoSqlRepository';
import { PrismaTcleConsentimentoRepository } from '../repositories/TcleConsentimentoRepository';
import { PrismaUsuarioRepository } from '../repositories/UsuarioRepository';
import { PesquisaService } from '../services/PesquisaService';
import { asyncHandler } from '../utils/asyncHandler';

const pesquisaService = new PesquisaService(
  new PrismaUsuarioRepository(),
  new PrismaExercicioRepository(),
  new PrismaMatriculaRepository(),
  new PrismaSubmissaoSqlRepository(),
  new PrismaDicaIaRepository(),
  new PrismaPesquisaRepository(),
  new PrismaTcleConsentimentoRepository(),
  new PrismaAlocacaoGrupoRepository(),
  new PrismaSessaoUsoRepository(),
  new PrismaRespostaSusRepository(),
  new PrismaRespostaRtlxRepository(),
);
const pesquisaController = new PesquisaController(pesquisaService);

export const pesquisaRoutes = Router();

// Acertos/tentativas/dicas por aluno nos exercícios da tarefa — o front do pesquisador
// junta com a exportação pra montar o CSV. Ver docs/decisions/fase6-alinhamento-tcc.md.
pesquisaRoutes.get(
  '/pesquisa/acertos',
  requireAuth,
  requirePapel('pesquisador'),
  asyncHandler((req, res) => pesquisaController.acertos(req, res)),
);

// ---- Aluno ----
// Ver docs/decisions/fase13-pesquisa-dados-no-node.md — dado de sujeito de pesquisa
// (TCLE/grupo/sessão/SUS/RTLX), anonimizado, agora neste mesmo backend/banco.

pesquisaRoutes.get(
  '/pesquisa/minha-participacao',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => pesquisaController.minhaParticipacao(req, res)),
);

pesquisaRoutes.post(
  '/pesquisa/tcle/consentir',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => pesquisaController.consentirTcle(req, res)),
);

pesquisaRoutes.post(
  '/pesquisa/sessoes/iniciar',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => pesquisaController.iniciarSessao(req, res)),
);

pesquisaRoutes.post(
  '/pesquisa/sessoes/:sessaoId/finalizar',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => pesquisaController.finalizarSessao(req, res)),
);

pesquisaRoutes.post(
  '/pesquisa/sessoes/:sessaoId/sus',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => pesquisaController.registrarSus(req, res)),
);

pesquisaRoutes.post(
  '/pesquisa/sessoes/:sessaoId/rtlx',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => pesquisaController.registrarRtlx(req, res)),
);

// Qualquer papel autenticado (front usa pra saber se a turma tem pesquisa ativa).
pesquisaRoutes.get(
  '/pesquisa/status/:turmaId',
  requireAuth,
  asyncHandler((req, res) => pesquisaController.status(req, res)),
);

// ---- Pesquisador ----

pesquisaRoutes.post(
  '/pesquisa/iniciar',
  requireAuth,
  requirePapel('pesquisador'),
  asyncHandler((req, res) => pesquisaController.iniciar(req, res)),
);

pesquisaRoutes.get(
  '/pesquisa/turma/:turmaId/historico',
  requireAuth,
  requirePapel('pesquisador'),
  asyncHandler((req, res) => pesquisaController.historico(req, res)),
);

pesquisaRoutes.post(
  '/pesquisa/:pesquisaId/sortear-grupos',
  requireAuth,
  requirePapel('pesquisador'),
  asyncHandler((req, res) => pesquisaController.sortearGrupos(req, res)),
);

pesquisaRoutes.post(
  '/pesquisa/:pesquisaId/encerrar',
  requireAuth,
  requirePapel('pesquisador'),
  asyncHandler((req, res) => pesquisaController.encerrar(req, res)),
);

pesquisaRoutes.get(
  '/pesquisa/:pesquisaId/participantes',
  requireAuth,
  requirePapel('pesquisador'),
  asyncHandler((req, res) => pesquisaController.participantes(req, res)),
);

pesquisaRoutes.get(
  '/pesquisa/:pesquisaId/exportacao',
  requireAuth,
  requirePapel('pesquisador'),
  asyncHandler((req, res) => pesquisaController.exportacao(req, res)),
);

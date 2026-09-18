import { Router } from 'express';
import { PacoteController } from '../controllers/PacoteController';
import { SandboxController } from '../controllers/SandboxController';
import { requireAuth } from '../middlewares/requireAuth';
import { requirePapel } from '../middlewares/requirePapel';
import { PrismaExercicioRepository } from '../repositories/ExercicioRepository';
import { PrismaMatriculaRepository } from '../repositories/MatriculaRepository';
import { PrismaRespostaDissertativaRepository } from '../repositories/RespostaDissertativaRepository';
import { PrismaResultadoExercicioRepository } from '../repositories/ResultadoExercicioRepository';
import { PgSandboxExecutionRepository } from '../repositories/sandbox/SandboxExecutionRepository';
import { PgSandboxProvisioningRepository } from '../repositories/sandbox/SandboxProvisioningRepository';
import { PrismaSubmissaoSqlRepository } from '../repositories/SubmissaoSqlRepository';
import { PrismaTurmaRepository } from '../repositories/TurmaRepository';
import { AcessoExercicioService } from '../services/AcessoExercicioService';
import { PacoteService } from '../services/PacoteService';
import { SandboxSqlService } from '../services/SandboxSqlService';
import { asyncHandler } from '../utils/asyncHandler';

const provisioningRepository = new PgSandboxProvisioningRepository();
const executionRepository = new PgSandboxExecutionRepository();
const submissaoRepository = new PrismaSubmissaoSqlRepository();
const exercicioRepository = new PrismaExercicioRepository();
const matriculaRepository = new PrismaMatriculaRepository();
const turmaRepository = new PrismaTurmaRepository();
const respostaDissertativaRepository = new PrismaRespostaDissertativaRepository();
const resultadoRepository = new PrismaResultadoExercicioRepository();

const acessoExercicio = new AcessoExercicioService(
  exercicioRepository,
  matriculaRepository,
  turmaRepository,
  submissaoRepository,
  resultadoRepository,
);

const sandboxSqlService = new SandboxSqlService(
  provisioningRepository,
  executionRepository,
  submissaoRepository,
  acessoExercicio,
  resultadoRepository,
);

const pacoteService = new PacoteService(
  acessoExercicio,
  submissaoRepository,
  respostaDissertativaRepository,
  resultadoRepository,
  provisioningRepository,
);

const sandboxController = new SandboxController(sandboxSqlService);
const pacoteController = new PacoteController(pacoteService);

export const sandboxRoutes = Router();

sandboxRoutes.post(
  '/exercicios/:id/sandbox/testar',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => sandboxController.testar(req, res)),
);

sandboxRoutes.post(
  '/exercicios/:id/sandbox/enviar',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => sandboxController.enviar(req, res)),
);

sandboxRoutes.post(
  '/exercicios/:id/pacote',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => pacoteController.gerar(req, res)),
);

sandboxRoutes.post(
  '/exercicios/:id/finalizar',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => pacoteController.finalizar(req, res)),
);

// Estudo livre: banco próprio do aluno, sem exercício (Fase 8).
sandboxRoutes.post(
  '/sandbox/livre/executar',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => sandboxController.executarLivre(req, res)),
);

sandboxRoutes.delete(
  '/sandbox/livre',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => sandboxController.limparLivre(req, res)),
);

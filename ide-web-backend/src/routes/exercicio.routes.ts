import { Router } from 'express';
import { ExercicioController } from '../controllers/ExercicioController';
import { ResultadoController } from '../controllers/ResultadoController';
import { requireAuth } from '../middlewares/requireAuth';
import { requirePapel } from '../middlewares/requirePapel';
import { PrismaExercicioRepository } from '../repositories/ExercicioRepository';
import { PrismaMatriculaRepository } from '../repositories/MatriculaRepository';
import { PrismaProvaRepository } from '../repositories/ProvaRepository';
import { PrismaRespostaDissertativaRepository } from '../repositories/RespostaDissertativaRepository';
import { PrismaResultadoExercicioRepository } from '../repositories/ResultadoExercicioRepository';
import { PrismaSubmissaoSqlRepository } from '../repositories/SubmissaoSqlRepository';
import { PrismaTurmaRepository } from '../repositories/TurmaRepository';
import { AcessoExercicioService } from '../services/AcessoExercicioService';
import { ExercicioService } from '../services/ExercicioService';
import { ResultadoExercicioService } from '../services/ResultadoExercicioService';
import { asyncHandler } from '../utils/asyncHandler';

const exercicioRepository = new PrismaExercicioRepository();
const turmaRepository = new PrismaTurmaRepository();
const matriculaRepository = new PrismaMatriculaRepository();
const provaRepository = new PrismaProvaRepository();
const resultadoRepository = new PrismaResultadoExercicioRepository();
const submissaoRepository = new PrismaSubmissaoSqlRepository();
const respostaDissertativaRepository = new PrismaRespostaDissertativaRepository();

const acessoExercicio = new AcessoExercicioService(
  exercicioRepository,
  matriculaRepository,
  turmaRepository,
  submissaoRepository,
  resultadoRepository,
);
const exercicioService = new ExercicioService(
  exercicioRepository,
  turmaRepository,
  matriculaRepository,
  provaRepository,
  acessoExercicio,
);
const resultadoService = new ResultadoExercicioService(
  resultadoRepository,
  exercicioRepository,
  turmaRepository,
  matriculaRepository,
  submissaoRepository,
  respostaDissertativaRepository,
);

const exercicioController = new ExercicioController(exercicioService);
const resultadoController = new ResultadoController(resultadoService);

export const exercicioRoutes = Router();

exercicioRoutes.post(
  '/exercicios',
  requireAuth,
  requirePapel('professor', 'pesquisador'),
  asyncHandler((req, res) => exercicioController.criar(req, res)),
);

exercicioRoutes.patch(
  '/exercicios/:id',
  requireAuth,
  requirePapel('professor', 'pesquisador'),
  asyncHandler((req, res) => exercicioController.atualizar(req, res)),
);

// Estudo livre: antes de qualquer rota `/exercicios/:id`, senão "publicos" entra como id.
exercicioRoutes.get(
  '/exercicios/publicos',
  requireAuth,
  asyncHandler((req, res) => exercicioController.listarPublicos(req, res)),
);

exercicioRoutes.get(
  '/turmas/:turmaId/exercicios',
  requireAuth,
  asyncHandler((req, res) => exercicioController.listarPorTurma(req, res)),
);

exercicioRoutes.get(
  '/exercicios/:id',
  requireAuth,
  asyncHandler((req, res) => exercicioController.buscarPorId(req, res)),
);

exercicioRoutes.patch(
  '/exercicios/:exercicioId/alunos/:usuarioId/resultado',
  requireAuth,
  requirePapel('professor', 'pesquisador'),
  asyncHandler((req, res) => resultadoController.revisar(req, res)),
);

exercicioRoutes.post(
  '/exercicios/:id/liberar-gabarito',
  requireAuth,
  requirePapel('professor', 'pesquisador'),
  asyncHandler((req, res) => resultadoController.liberarGabarito(req, res)),
);

exercicioRoutes.post(
  '/exercicios/:id/ocultar-gabarito',
  requireAuth,
  requirePapel('professor', 'pesquisador'),
  asyncHandler((req, res) => resultadoController.ocultarGabarito(req, res)),
);

exercicioRoutes.get(
  '/exercicios/:id/resultado',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => resultadoController.meuResultado(req, res)),
);

// A válvula do modo prova: devolve UM envio ao aluno (Fase 10, D8).
exercicioRoutes.post(
  '/exercicios/:id/alunos/:usuarioId/liberar-envio',
  requireAuth,
  requirePapel('professor', 'pesquisador'),
  asyncHandler((req, res) => resultadoController.liberarEnvio(req, res)),
);

// O professor precisa ver o que o aluno entregou antes de dar nota (Fase 9, D17).
exercicioRoutes.get(
  '/exercicios/:exercicioId/alunos/:usuarioId/respostas',
  requireAuth,
  requirePapel('professor', 'pesquisador'),
  asyncHandler((req, res) => resultadoController.respostasDoAluno(req, res)),
);

exercicioRoutes.get(
  '/exercicios/:exercicioId/alunos/:usuarioId/resultado',
  requireAuth,
  requirePapel('professor', 'pesquisador'),
  asyncHandler((req, res) => resultadoController.resultadoDoAluno(req, res)),
);

import { Router } from 'express';
import { DiagramaMerController } from '../controllers/DiagramaMerController';
import { requireAuth } from '../middlewares/requireAuth';
import { requirePapel } from '../middlewares/requirePapel';
import { PrismaDiagramaMerRepository } from '../repositories/DiagramaMerRepository';
import { PrismaExercicioRepository } from '../repositories/ExercicioRepository';
import { PrismaMatriculaRepository } from '../repositories/MatriculaRepository';
import { PrismaTurmaRepository } from '../repositories/TurmaRepository';
import { PrismaResultadoExercicioRepository } from '../repositories/ResultadoExercicioRepository';
import { PrismaSubmissaoSqlRepository } from '../repositories/SubmissaoSqlRepository';
import { AcessoExercicioService } from '../services/AcessoExercicioService';
import { DiagramaMerService } from '../services/DiagramaMerService';
import { asyncHandler } from '../utils/asyncHandler';

const diagramaMerRepository = new PrismaDiagramaMerRepository();
const exercicioRepository = new PrismaExercicioRepository();
const matriculaRepository = new PrismaMatriculaRepository();
const turmaRepository = new PrismaTurmaRepository();

const submissaoRepository = new PrismaSubmissaoSqlRepository();
const resultadoRepository = new PrismaResultadoExercicioRepository();

const acessoExercicio = new AcessoExercicioService(
  exercicioRepository,
  matriculaRepository,
  turmaRepository,
  submissaoRepository,
  resultadoRepository,
);
const diagramaMerService = new DiagramaMerService(
  diagramaMerRepository,
  exercicioRepository,
  acessoExercicio,
  turmaRepository,
);
const diagramaMerController = new DiagramaMerController(diagramaMerService);

export const diagramaRoutes = Router();

diagramaRoutes.put(
  '/exercicios/:id/diagrama',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => diagramaMerController.salvar(req, res)),
);

diagramaRoutes.get(
  '/exercicios/:id/diagrama',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => diagramaMerController.buscar(req, res)),
);

// Revisão do professor: leitura do modelo de um aluno da sua turma.
diagramaRoutes.get(
  '/exercicios/:exercicioId/alunos/:usuarioId/diagrama',
  requireAuth,
  requirePapel('professor', 'pesquisador'),
  asyncHandler((req, res) => diagramaMerController.buscarDoAluno(req, res)),
);

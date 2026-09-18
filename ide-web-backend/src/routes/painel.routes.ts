import { Router } from 'express';
import { PainelController } from '../controllers/PainelController';
import { requireAuth } from '../middlewares/requireAuth';
import { requirePapel } from '../middlewares/requirePapel';
import { PrismaExercicioRepository } from '../repositories/ExercicioRepository';
import { PrismaMatriculaRepository } from '../repositories/MatriculaRepository';
import { PrismaPainelRepository } from '../repositories/PainelRepository';
import { PrismaTurmaRepository } from '../repositories/TurmaRepository';
import { PainelService } from '../services/PainelService';
import { asyncHandler } from '../utils/asyncHandler';

const painelRepository = new PrismaPainelRepository();
const turmaRepository = new PrismaTurmaRepository();
const exercicioRepository = new PrismaExercicioRepository();
const matriculaRepository = new PrismaMatriculaRepository();

const painelService = new PainelService(painelRepository, turmaRepository, exercicioRepository, matriculaRepository);
const painelController = new PainelController(painelService);

export const painelRoutes = Router();

painelRoutes.get(
  '/painel/professor',
  requireAuth,
  requirePapel('professor', 'pesquisador'),
  asyncHandler((req, res) => painelController.doProfessor(req, res)),
);

painelRoutes.get(
  '/painel/aluno',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => painelController.doAluno(req, res)),
);

// Todas as atividades de um aluno na turma: a revisão passa a ser da pessoa (Fase 10, D4).
painelRoutes.get(
  '/turmas/:turmaId/alunos/:usuarioId/atividades',
  requireAuth,
  requirePapel('professor', 'pesquisador'),
  asyncHandler((req, res) => painelController.atividadesDoAluno(req, res)),
);

// A matriz aluno × exercício de uma turma (Fase 9, D2).
painelRoutes.get(
  '/turmas/:id/painel',
  requireAuth,
  requirePapel('professor', 'pesquisador'),
  asyncHandler((req, res) => painelController.daTurma(req, res)),
);

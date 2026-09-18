import { Router } from 'express';
import { TurmaController } from '../controllers/TurmaController';
import { requireAuth } from '../middlewares/requireAuth';
import { requirePapel } from '../middlewares/requirePapel';
import { PrismaMatriculaRepository } from '../repositories/MatriculaRepository';
import { PrismaTurmaRepository } from '../repositories/TurmaRepository';
import { TurmaService } from '../services/TurmaService';
import { asyncHandler } from '../utils/asyncHandler';

const turmaRepository = new PrismaTurmaRepository();
const matriculaRepository = new PrismaMatriculaRepository();
const turmaService = new TurmaService(turmaRepository, matriculaRepository);
const turmaController = new TurmaController(turmaService);

export const turmaRoutes = Router();

turmaRoutes.post(
  '/turmas',
  requireAuth,
  requirePapel('professor'),
  asyncHandler((req, res) => turmaController.criar(req, res)),
);

turmaRoutes.get('/turmas/minhas', requireAuth, asyncHandler((req, res) => turmaController.minhas(req, res)));

turmaRoutes.get(
  '/turmas/:id/alunos',
  requireAuth,
  requirePapel('professor'),
  asyncHandler((req, res) => turmaController.listarAlunos(req, res)),
);

turmaRoutes.post(
  '/turmas/:id/encerrar',
  requireAuth,
  requirePapel('professor'),
  asyncHandler((req, res) => turmaController.encerrar(req, res)),
);

turmaRoutes.post(
  '/turmas/:id/reabrir',
  requireAuth,
  requirePapel('professor'),
  asyncHandler((req, res) => turmaController.reabrir(req, res)),
);

// O código da turma é matrícula, não credencial: o aluno já chega logado (ver
// docs/decisions/fase8-conta-do-aluno-matricula-estudo-livre.md).
turmaRoutes.post(
  '/turmas/:codigo/matricular',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => turmaController.matricular(req, res)),
);

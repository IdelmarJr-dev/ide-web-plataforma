import { Router } from 'express';
import { ProvaController } from '../controllers/ProvaController';
import { requireAuth } from '../middlewares/requireAuth';
import { requirePapel } from '../middlewares/requirePapel';
import { PrismaProvaRepository } from '../repositories/ProvaRepository';
import { PrismaTurmaRepository } from '../repositories/TurmaRepository';
import { PrismaExercicioRepository } from '../repositories/ExercicioRepository';
import { PrismaMatriculaRepository } from '../repositories/MatriculaRepository';
import { ProvaService } from '../services/ProvaService';
import { asyncHandler } from '../utils/asyncHandler';

const provaRepository = new PrismaProvaRepository();
const turmaRepository = new PrismaTurmaRepository();
const matriculaRepository = new PrismaMatriculaRepository();
const exercicioRepository = new PrismaExercicioRepository();
const provaService = new ProvaService(provaRepository, turmaRepository, matriculaRepository, exercicioRepository);
const provaController = new ProvaController(provaService);

export const provaRoutes = Router();

provaRoutes.post(
  '/turmas/:turmaId/provas',
  requireAuth,
  requirePapel('professor'),
  asyncHandler((req, res) => provaController.criar(req, res)),
);

provaRoutes.get(
  '/turmas/:turmaId/provas',
  requireAuth,
  requirePapel('professor'),
  asyncHandler((req, res) => provaController.listarPorTurma(req, res)),
);

provaRoutes.post(
  '/turmas/:turmaId/sortear-provas',
  requireAuth,
  requirePapel('professor'),
  asyncHandler((req, res) => provaController.sortear(req, res)),
);

// Assistente: monta a prova a partir do acervo sem prova da turma (Fase 10, D13).
provaRoutes.get(
  '/turmas/:turmaId/provas/acervo',
  requireAuth,
  requirePapel('professor'),
  asyncHandler((req, res) => provaController.acervo(req, res)),
);

provaRoutes.post(
  '/turmas/:turmaId/provas/assistente',
  requireAuth,
  requirePapel('professor'),
  asyncHandler((req, res) => provaController.montarComAssistente(req, res)),
);

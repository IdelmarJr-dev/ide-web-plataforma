import { Router } from 'express';
import { DicaIaController } from '../controllers/DicaIaController';
import { requireAuth } from '../middlewares/requireAuth';
import { requirePapel } from '../middlewares/requirePapel';
import { PrismaDicaIaRepository } from '../repositories/DicaIaRepository';
import { PrismaExercicioRepository } from '../repositories/ExercicioRepository';
import { GroqLlmClient } from '../repositories/llm/GroqLlmClient';
import { PrismaMatriculaRepository } from '../repositories/MatriculaRepository';
import { PrismaResultadoExercicioRepository } from '../repositories/ResultadoExercicioRepository';
import { PrismaSubmissaoSqlRepository } from '../repositories/SubmissaoSqlRepository';
import { PrismaTurmaRepository } from '../repositories/TurmaRepository';
import { AcessoExercicioService } from '../services/AcessoExercicioService';
import { DicaIaService } from '../services/DicaIaService';
import { asyncHandler } from '../utils/asyncHandler';

const dicaIaRepository = new PrismaDicaIaRepository();
const exercicioRepository = new PrismaExercicioRepository();
const matriculaRepository = new PrismaMatriculaRepository();
const turmaRepository = new PrismaTurmaRepository();
const submissaoSqlRepository = new PrismaSubmissaoSqlRepository();
const resultadoExercicioRepository = new PrismaResultadoExercicioRepository();
const llmClient = new GroqLlmClient();

const acessoExercicio = new AcessoExercicioService(
  exercicioRepository,
  matriculaRepository,
  turmaRepository,
  submissaoSqlRepository,
  resultadoExercicioRepository,
);
const dicaIaService = new DicaIaService(
  dicaIaRepository,
  exercicioRepository,
  acessoExercicio,
  submissaoSqlRepository,
  resultadoExercicioRepository,
  llmClient,
);

const dicaIaController = new DicaIaController(dicaIaService);

export const dicaIaRoutes = Router();

dicaIaRoutes.post(
  '/exercicios/:id/dicas',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => dicaIaController.pedir(req, res)),
);

import { Router } from 'express';
import { RespostaDissertativaController } from '../controllers/RespostaDissertativaController';
import { requireAuth } from '../middlewares/requireAuth';
import { requirePapel } from '../middlewares/requirePapel';
import { PrismaExercicioRepository } from '../repositories/ExercicioRepository';
import { PrismaMatriculaRepository } from '../repositories/MatriculaRepository';
import { PrismaRespostaDissertativaRepository } from '../repositories/RespostaDissertativaRepository';
import { PrismaResultadoExercicioRepository } from '../repositories/ResultadoExercicioRepository';
import { PrismaSubmissaoSqlRepository } from '../repositories/SubmissaoSqlRepository';
import { PrismaTurmaRepository } from '../repositories/TurmaRepository';
import { AcessoExercicioService } from '../services/AcessoExercicioService';
import { RespostaDissertativaService } from '../services/RespostaDissertativaService';
import { asyncHandler } from '../utils/asyncHandler';

const acessoExercicio = new AcessoExercicioService(
  new PrismaExercicioRepository(),
  new PrismaMatriculaRepository(),
  new PrismaTurmaRepository(),
  new PrismaSubmissaoSqlRepository(),
  new PrismaResultadoExercicioRepository(),
);
const respostaDissertativaController = new RespostaDissertativaController(
  new RespostaDissertativaService(new PrismaRespostaDissertativaRepository(), acessoExercicio),
);

export const dissertativaRoutes = Router();

dissertativaRoutes.put(
  '/exercicios/:id/dissertativa',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => respostaDissertativaController.salvar(req, res)),
);

dissertativaRoutes.get(
  '/exercicios/:id/dissertativa',
  requireAuth,
  requirePapel('aluno'),
  asyncHandler((req, res) => respostaDissertativaController.buscar(req, res)),
);

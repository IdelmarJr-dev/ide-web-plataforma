import { Router } from 'express';
import { PesquisaController } from '../controllers/PesquisaController';
import { requireAuth } from '../middlewares/requireAuth';
import { requirePapel } from '../middlewares/requirePapel';
import { PrismaDicaIaRepository } from '../repositories/DicaIaRepository';
import { PrismaExercicioRepository } from '../repositories/ExercicioRepository';
import { PrismaMatriculaRepository } from '../repositories/MatriculaRepository';
import { PrismaSubmissaoSqlRepository } from '../repositories/SubmissaoSqlRepository';
import { PrismaUsuarioRepository } from '../repositories/UsuarioRepository';
import { PesquisaService } from '../services/PesquisaService';
import { asyncHandler } from '../utils/asyncHandler';

const pesquisaService = new PesquisaService(
  new PrismaUsuarioRepository(),
  new PrismaExercicioRepository(),
  new PrismaMatriculaRepository(),
  new PrismaSubmissaoSqlRepository(),
  new PrismaDicaIaRepository(),
);
const pesquisaController = new PesquisaController(pesquisaService);

export const pesquisaRoutes = Router();

// Emite o token curto que o front usa como Bearer nas chamadas diretas ao backend
// Python de pesquisa (self-hosted) — não passa pelo Node. Ver
// docs/decisions/fase4-pesquisa-python-sessao-aluno-login.md.
pesquisaRoutes.get('/pesquisa/token', requireAuth, asyncHandler((req, res) => pesquisaController.token(req, res)));

// Acertos/tentativas/dicas por aluno nos exercícios da tarefa — o front do pesquisador
// junta com a exportação do Python pra montar o CSV. Ver docs/decisions/fase6-alinhamento-tcc.md.
pesquisaRoutes.get(
  '/pesquisa/acertos',
  requireAuth,
  requirePapel('pesquisador'),
  asyncHandler((req, res) => pesquisaController.acertos(req, res)),
);

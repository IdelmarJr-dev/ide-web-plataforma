import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { diagramaRoutes } from './diagrama.routes';
import { dicaIaRoutes } from './dicaIa.routes';
import { exercicioRoutes } from './exercicio.routes';
import { healthRoutes } from './health.routes';
import { painelRoutes } from './painel.routes';
import { pesquisaRoutes } from './pesquisa.routes';
import { provaRoutes } from './prova.routes';
import { sandboxRoutes } from './sandbox.routes';
import { turmaRoutes } from './turma.routes';

export const routes = Router();

routes.use(healthRoutes);
routes.use(authRoutes);
routes.use(turmaRoutes);
routes.use(provaRoutes);
routes.use(exercicioRoutes);
routes.use(diagramaRoutes);
routes.use(sandboxRoutes);
routes.use(dicaIaRoutes);
routes.use(painelRoutes);
routes.use(pesquisaRoutes);

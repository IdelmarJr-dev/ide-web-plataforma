import type { Request, Response } from 'express';
import { enviarSandboxBodySchema, testarSandboxBodySchema } from '../dtos/sandbox.dto';
import { UnauthorizedError, ValidationError } from '../errors';
import type { SandboxSqlService } from '../services/SandboxSqlService';
import { BaseController } from './BaseController';

const HTTP_SEM_CONTEUDO = 204;

export class SandboxController extends BaseController {
  constructor(private readonly sandboxSqlService: SandboxSqlService) {
    super();
  }

  testar = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const parsed = testarSandboxBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Consulta SQL inválida', parsed.error.issues);
    }

    const exercicioId = req.params.id ?? '';
    const resultado = await this.sandboxSqlService.testar(req.usuario.id, exercicioId, parsed.data.sql);
    this.handleSuccess(res, resultado);
  };

  enviar = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const parsed = enviarSandboxBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Consulta SQL inválida', parsed.error.issues);
    }

    const exercicioId = req.params.id ?? '';
    const resultado = await this.sandboxSqlService.enviar(req.usuario.id, exercicioId, parsed.data.sql);
    this.handleSuccess(res, resultado);
  };

  executarLivre = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const parsed = testarSandboxBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Consulta SQL inválida', parsed.error.issues);
    }

    const resultado = await this.sandboxSqlService.executarLivre(req.usuario.id, parsed.data.sql);
    this.handleSuccess(res, resultado);
  };

  limparLivre = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    await this.sandboxSqlService.limparLivre(req.usuario.id);
    res.status(HTTP_SEM_CONTEUDO).send();
  };
}

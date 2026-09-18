import type { Request, Response } from 'express';
import { acertosQuerySchema } from '../dtos/pesquisa.dto';
import { UnauthorizedError, ValidationError } from '../errors';
import type { PesquisaService } from '../services/PesquisaService';
import { BaseController } from './BaseController';

export class PesquisaController extends BaseController {
  constructor(private readonly pesquisaService: PesquisaService) {
    super();
  }

  token = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const token = await this.pesquisaService.gerarToken(req.usuario.id);
    this.handleSuccess(res, { token });
  };

  acertos = async (req: Request, res: Response): Promise<void> => {
    const parsed = acertosQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError('Informe exercicioIds (UUIDs separados por vírgula)', parsed.error.issues);
    }

    const acertos = await this.pesquisaService.acertos(parsed.data.exercicioIds);
    this.handleSuccess(res, acertos);
  };
}

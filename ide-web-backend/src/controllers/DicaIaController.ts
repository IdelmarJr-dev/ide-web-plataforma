import type { Request, Response } from 'express';
import { pedirDicaBodySchema, toDicaIaResponseDto } from '../dtos/dicaIa.dto';
import { UnauthorizedError, ValidationError } from '../errors';
import type { DicaIaService } from '../services/DicaIaService';
import { BaseController } from './BaseController';

const HTTP_CREATED = 201;

export class DicaIaController extends BaseController {
  constructor(private readonly dicaIaService: DicaIaService) {
    super();
  }

  pedir = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const parsed = pedirDicaBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Dados de pedido de dica inválidos', parsed.error.issues);
    }

    const exercicioId = req.params.id ?? '';
    const dica = await this.dicaIaService.pedir(req.usuario.id, exercicioId, parsed.data);
    this.handleSuccess(res, toDicaIaResponseDto(dica), HTTP_CREATED);
  };
}

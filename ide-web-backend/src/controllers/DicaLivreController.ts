import type { Request, Response } from 'express';
import { pedirDicaLivreBodySchema } from '../dtos/dicaIa.dto';
import type { DicaLivreResponseDto } from '../dtos/dicaIa.dto';
import { UnauthorizedError, ValidationError } from '../errors';
import type { DicaLivreService } from '../services/DicaLivreService';
import { BaseController } from './BaseController';

const HTTP_CREATED = 201;

export class DicaLivreController extends BaseController {
  constructor(private readonly dicaLivreService: DicaLivreService) {
    super();
  }

  pedir = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const parsed = pedirDicaLivreBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Dados de pedido de dica inválidos', parsed.error.issues);
    }

    const respostaIa = await this.dicaLivreService.pedir(req.usuario.id, parsed.data);
    const dto: DicaLivreResponseDto = { respostaIa };
    this.handleSuccess(res, dto, HTTP_CREATED);
  };
}

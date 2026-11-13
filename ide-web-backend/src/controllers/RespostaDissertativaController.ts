import type { Request, Response } from 'express';
import { salvarDissertativaBodySchema, toDissertativaResponseDto } from '../dtos/dissertativa.dto';
import { UnauthorizedError, ValidationError } from '../errors';
import type { RespostaDissertativaService } from '../services/RespostaDissertativaService';
import { BaseController } from './BaseController';

export class RespostaDissertativaController extends BaseController {
  constructor(private readonly respostaDissertativaService: RespostaDissertativaService) {
    super();
  }

  salvar = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const parsed = salvarDissertativaBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Resposta dissertativa inválida.', parsed.error.issues);
    }

    const resposta = await this.respostaDissertativaService.salvar(req.usuario.id, req.params.id ?? '', parsed.data.texto);
    this.handleSuccess(res, toDissertativaResponseDto(resposta));
  };

  buscar = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const resposta = await this.respostaDissertativaService.buscar(req.usuario.id, req.params.id ?? '');
    this.handleSuccess(res, resposta ? toDissertativaResponseDto(resposta) : null);
  };
}

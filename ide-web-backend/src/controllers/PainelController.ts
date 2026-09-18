import type { Request, Response } from 'express';
import {
  toAtividadesDoAlunoResponseDto,
  toPainelAlunoResponseDto,
  toPainelProfessorResponseDto,
  toPainelTurmaResponseDto,
} from '../dtos/painel.dto';
import { UnauthorizedError } from '../errors';
import type { PainelService } from '../services/PainelService';
import { BaseController } from './BaseController';

export class PainelController extends BaseController {
  constructor(private readonly painelService: PainelService) {
    super();
  }

  doProfessor = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const painel = await this.painelService.doProfessor(req.usuario.id);
    this.handleSuccess(res, toPainelProfessorResponseDto(painel));
  };

  daTurma = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const painel = await this.painelService.daTurma(req.usuario.id, req.params.id ?? '');
    this.handleSuccess(res, toPainelTurmaResponseDto(painel));
  };

  atividadesDoAluno = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const dados = await this.painelService.atividadesDoAluno(
      req.usuario.id,
      req.params.turmaId ?? '',
      req.params.usuarioId ?? '',
    );
    this.handleSuccess(res, toAtividadesDoAlunoResponseDto(dados));
  };

  doAluno = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const painel = await this.painelService.doAluno(req.usuario.id);
    this.handleSuccess(res, toPainelAlunoResponseDto(painel));
  };
}

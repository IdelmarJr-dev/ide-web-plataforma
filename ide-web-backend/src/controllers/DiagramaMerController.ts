import type { Request, Response } from 'express';
import { salvarDiagramaBodySchema, toDiagramaResponseDto } from '../dtos/diagrama.dto';
import { UnauthorizedError, ValidationError } from '../errors';
import type { DiagramaMerService } from '../services/DiagramaMerService';
import { BaseController } from './BaseController';

export class DiagramaMerController extends BaseController {
  constructor(private readonly diagramaMerService: DiagramaMerService) {
    super();
  }

  salvar = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const parsed = salvarDiagramaBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Dados de diagrama inválidos', parsed.error.issues);
    }

    const exercicioId = req.params.id ?? '';
    const diagrama = await this.diagramaMerService.salvar(
      req.usuario.id,
      exercicioId,
      parsed.data.conteudoJson,
    );
    this.handleSuccess(res, toDiagramaResponseDto(diagrama));
  };

  buscar = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const exercicioId = req.params.id ?? '';
    const diagrama = await this.diagramaMerService.buscar(req.usuario.id, exercicioId);
    this.handleSuccess(res, diagrama ? toDiagramaResponseDto(diagrama) : null);
  };

  buscarDoAluno = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const diagrama = await this.diagramaMerService.buscarDoAluno(
      req.usuario.id,
      req.params.exercicioId ?? '',
      req.params.usuarioId ?? '',
    );
    this.handleSuccess(res, diagrama ? toDiagramaResponseDto(diagrama) : null);
  };
}

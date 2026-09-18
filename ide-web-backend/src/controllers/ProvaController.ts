import type { Request, Response } from 'express';
import { assistenteProvaBodySchema, criarProvaBodySchema, toProvaResponseDto } from '../dtos/prova.dto';
import { UnauthorizedError, ValidationError } from '../errors';
import type { ProvaService } from '../services/ProvaService';
import { BaseController } from './BaseController';

const HTTP_CREATED = 201;

export class ProvaController extends BaseController {
  constructor(private readonly provaService: ProvaService) {
    super();
  }

  criar = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const parsed = criarProvaBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Dados de prova inválidos', parsed.error.issues);
    }

    const turmaId = req.params.turmaId ?? '';
    const prova = await this.provaService.criar(req.usuario.id, turmaId, parsed.data.titulo);
    this.handleSuccess(res, toProvaResponseDto(prova), HTTP_CREATED);
  };

  listarPorTurma = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const turmaId = req.params.turmaId ?? '';
    const provas = await this.provaService.listarPorTurma(req.usuario.id, turmaId);
    this.handleSuccess(res, provas.map(toProvaResponseDto));
  };

  sortear = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const turmaId = req.params.turmaId ?? '';
    const resultado = await this.provaService.sortear(req.usuario.id, turmaId);
    this.handleSuccess(res, resultado);
  };

  acervo = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const acervo = await this.provaService.acervoDisponivel(req.usuario.id, req.params.turmaId ?? '');
    this.handleSuccess(res, acervo);
  };

  montarComAssistente = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const parsed = assistenteProvaBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Dados do assistente de prova inválidos', parsed.error.issues);
    }

    const { prova, questoes } = await this.provaService.montarComAssistente(
      req.usuario.id,
      req.params.turmaId ?? '',
      parsed.data,
    );
    this.handleSuccess(res, { ...toProvaResponseDto(prova), questoes });
  };
}

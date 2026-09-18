import type { Request, Response } from 'express';
import { criarTurmaBodySchema, toAlunoResponseDto, toTurmaResponseDto } from '../dtos/turma.dto';
import { UnauthorizedError, ValidationError } from '../errors';
import type { TurmaService } from '../services/TurmaService';
import { BaseController } from './BaseController';

const HTTP_CREATED = 201;

export class TurmaController extends BaseController {
  constructor(private readonly turmaService: TurmaService) {
    super();
  }

  criar = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const parsed = criarTurmaBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Dados de turma inválidos', parsed.error.issues);
    }

    const turma = await this.turmaService.criar(req.usuario.id, parsed.data);
    this.handleSuccess(res, toTurmaResponseDto(turma), HTTP_CREATED);
  };

  minhas = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const turmas = await this.turmaService.minhas(req.usuario.id, req.usuario.papel);
    this.handleSuccess(res, turmas.map(toTurmaResponseDto));
  };

  listarAlunos = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const turmaId = req.params.id ?? '';
    const alunos = await this.turmaService.listarAlunos(req.usuario.id, turmaId);
    this.handleSuccess(res, alunos.map(toAlunoResponseDto));
  };

  matricular = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const codigo = req.params.codigo ?? '';
    const turma = await this.turmaService.matricular(req.usuario.id, codigo);
    this.handleSuccess(res, toTurmaResponseDto(turma), HTTP_CREATED);
  };

  encerrar = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const turmaId = req.params.id ?? '';
    const turma = await this.turmaService.encerrar(req.usuario.id, turmaId);
    this.handleSuccess(res, toTurmaResponseDto(turma));
  };

  reabrir = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const turmaId = req.params.id ?? '';
    const turma = await this.turmaService.reabrir(req.usuario.id, turmaId);
    this.handleSuccess(res, toTurmaResponseDto(turma));
  };
}

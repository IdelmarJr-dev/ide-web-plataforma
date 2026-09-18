import type { Request, Response } from 'express';
import {
  atualizarExercicioBodySchema,
  criarExercicioBodySchema,
  toExercicioAlunoResponseDto,
  toExercicioProfessorResponseDto,
} from '../dtos/exercicio.dto';
import { UnauthorizedError, ValidationError } from '../errors';
import type { Papel } from '../generated/prisma/client';
import type { ExercicioService } from '../services/ExercicioService';
import { BaseController } from './BaseController';

const HTTP_CREATED = 201;

export class ExercicioController extends BaseController {
  constructor(private readonly exercicioService: ExercicioService) {
    super();
  }

  criar = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const parsed = criarExercicioBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Dados de exercício inválidos', parsed.error.issues);
    }

    const exercicio = await this.exercicioService.criar(req.usuario.id, parsed.data);
    this.handleSuccess(res, toExercicioProfessorResponseDto(exercicio), HTTP_CREATED);
  };

  atualizar = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const parsed = atualizarExercicioBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Dados de exercício inválidos', parsed.error.issues);
    }

    const exercicioId = req.params.id ?? '';
    const exercicio = await this.exercicioService.atualizar(req.usuario.id, exercicioId, parsed.data);
    this.handleSuccess(res, toExercicioProfessorResponseDto(exercicio));
  };

  buscarPorId = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const exercicioId = req.params.id ?? '';
    const exercicio = await this.exercicioService.buscarPorId(req.usuario.id, req.usuario.papel, exercicioId);

    const dto = vePapelDeGestor(req.usuario.papel)
      ? toExercicioProfessorResponseDto(exercicio)
      : toExercicioAlunoResponseDto(exercicio);

    this.handleSuccess(res, dto);
  };

  /** Estudo livre: o gabarito nunca vai junto, nem pro professor que publicou. */
  listarPublicos = async (_req: Request, res: Response): Promise<void> => {
    const exercicios = await this.exercicioService.listarPublicos();
    this.handleSuccess(res, exercicios.map(toExercicioAlunoResponseDto));
  };

  listarPorTurma = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const turmaId = req.params.turmaId ?? '';
    const exercicios = await this.exercicioService.listarPorTurma(req.usuario.id, req.usuario.papel, turmaId);

    const dto = vePapelDeGestor(req.usuario.papel)
      ? exercicios.map(toExercicioProfessorResponseDto)
      : exercicios.map(toExercicioAlunoResponseDto);

    this.handleSuccess(res, dto);
  };
}

/** professor e pesquisador enxergam o exercício com gabarito; aluno, sem. */
function vePapelDeGestor(papel: Papel): boolean {
  return papel === 'professor' || papel === 'pesquisador';
}

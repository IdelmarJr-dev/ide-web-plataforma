import type { Request, Response } from 'express';
import {
  revisarResultadoBodySchema,
  toRespostasDoAlunoResponseDto,
  toResultadoResponseDto,
} from '../dtos/resultado.dto';
import { toExercicioProfessorResponseDto } from '../dtos/exercicio.dto';
import { UnauthorizedError, ValidationError } from '../errors';
import type { ResultadoExercicioService } from '../services/ResultadoExercicioService';
import { BaseController } from './BaseController';

export class ResultadoController extends BaseController {
  constructor(private readonly resultadoService: ResultadoExercicioService) {
    super();
  }

  revisar = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const parsed = revisarResultadoBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Dados de revisão inválidos', parsed.error.issues);
    }

    const exercicioId = req.params.exercicioId ?? '';
    const usuarioId = req.params.usuarioId ?? '';
    const resultado = await this.resultadoService.revisar(req.usuario.id, exercicioId, usuarioId, parsed.data);
    this.handleSuccess(res, toResultadoResponseDto(resultado));
  };

  liberarGabarito = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const exercicioId = req.params.id ?? '';
    const exercicio = await this.resultadoService.definirGabaritoLiberado(req.usuario.id, exercicioId, true);
    this.handleSuccess(res, toExercicioProfessorResponseDto(exercicio));
  };

  ocultarGabarito = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const exercicioId = req.params.id ?? '';
    const exercicio = await this.resultadoService.definirGabaritoLiberado(req.usuario.id, exercicioId, false);
    this.handleSuccess(res, toExercicioProfessorResponseDto(exercicio));
  };

  meuResultado = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const exercicioId = req.params.id ?? '';
    const meuResultado = await this.resultadoService.meuResultado(req.usuario.id, exercicioId);

    this.handleSuccess(res, meuResultado ? toResultadoResponseDto(meuResultado.resultado) : null);
  };

  liberarEnvio = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const exercicioId = req.params.id ?? '';
    const usuarioId = req.params.usuarioId ?? '';
    await this.resultadoService.liberarEnvio(req.usuario.id, exercicioId, usuarioId);
    this.handleSuccess(res, { liberado: true });
  };

  respostasDoAluno = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const exercicioId = req.params.exercicioId ?? '';
    const usuarioId = req.params.usuarioId ?? '';
    const respostas = await this.resultadoService.respostasDoAluno(req.usuario.id, exercicioId, usuarioId);
    this.handleSuccess(res, toRespostasDoAlunoResponseDto(respostas));
  };

  resultadoDoAluno = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const exercicioId = req.params.exercicioId ?? '';
    const usuarioId = req.params.usuarioId ?? '';
    const resultado = await this.resultadoService.resultadoDoAluno(req.usuario.id, exercicioId, usuarioId);
    this.handleSuccess(res, resultado ? toResultadoResponseDto(resultado) : null);
  };
}

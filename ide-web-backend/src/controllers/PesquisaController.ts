import type { Request, Response } from 'express';
import { acertosQuerySchema } from '../dtos/pesquisa.dto';
import {
  iniciarPesquisaBodySchema,
  rtlxBodySchema,
  susBodySchema,
  tcleConsentirBodySchema,
} from '../dtos/pesquisaAplicada.dto';
import { UnauthorizedError, ValidationError } from '../errors';
import type { PesquisaService } from '../services/PesquisaService';
import { BaseController } from './BaseController';

const HTTP_CREATED = 201;

export class PesquisaController extends BaseController {
  constructor(private readonly pesquisaService: PesquisaService) {
    super();
  }

  acertos = async (req: Request, res: Response): Promise<void> => {
    const parsed = acertosQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError('Informe exercicioIds (UUIDs separados por vírgula)', parsed.error.issues);
    }

    const acertos = await this.pesquisaService.acertos(parsed.data.exercicioIds);
    this.handleSuccess(res, acertos);
  };

  // ---- Pesquisador ----

  iniciar = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }
    const parsed = iniciarPesquisaBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Dados de pesquisa inválidos', parsed.error.issues);
    }

    const pesquisa = await this.pesquisaService.iniciar(req.usuario.id, parsed.data.turmaId, parsed.data.exercicioIds);
    this.handleSuccess(res, pesquisa, HTTP_CREATED);
  };

  status = async (req: Request, res: Response): Promise<void> => {
    const turmaId = req.params.turmaId ?? '';
    const status = await this.pesquisaService.statusPorTurma(turmaId);
    this.handleSuccess(res, status);
  };

  historico = async (req: Request, res: Response): Promise<void> => {
    const turmaId = req.params.turmaId ?? '';
    const historico = await this.pesquisaService.historicoPorTurma(turmaId);
    this.handleSuccess(res, historico);
  };

  sortearGrupos = async (req: Request, res: Response): Promise<void> => {
    const pesquisaId = req.params.pesquisaId ?? '';
    const resultado = await this.pesquisaService.sortearGrupos(pesquisaId);
    this.handleSuccess(res, resultado);
  };

  encerrar = async (req: Request, res: Response): Promise<void> => {
    const pesquisaId = req.params.pesquisaId ?? '';
    const pesquisa = await this.pesquisaService.encerrar(pesquisaId);
    this.handleSuccess(res, pesquisa);
  };

  participantes = async (req: Request, res: Response): Promise<void> => {
    const pesquisaId = req.params.pesquisaId ?? '';
    const participantes = await this.pesquisaService.participantes(pesquisaId);
    this.handleSuccess(res, participantes);
  };

  exportacao = async (req: Request, res: Response): Promise<void> => {
    const pesquisaId = req.params.pesquisaId ?? '';
    const exportacao = await this.pesquisaService.exportacao(pesquisaId);
    this.handleSuccess(res, exportacao);
  };

  // ---- Aluno ----

  minhaParticipacao = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }
    const participacao = await this.pesquisaService.minhaParticipacao(req.usuario.id);
    this.handleSuccess(res, participacao);
  };

  consentirTcle = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }
    const parsed = tcleConsentirBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Dados de consentimento inválidos', parsed.error.issues);
    }

    const status = await this.pesquisaService.consentirTcle(req.usuario.id, parsed.data.aceito);
    this.handleSuccess(res, status);
  };

  iniciarSessao = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }
    const sessao = await this.pesquisaService.iniciarSessao(req.usuario.id);
    this.handleSuccess(res, sessao, HTTP_CREATED);
  };

  finalizarSessao = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }
    const sessaoId = req.params.sessaoId ?? '';
    const sessao = await this.pesquisaService.finalizarSessao(req.usuario.id, sessaoId);
    this.handleSuccess(res, sessao);
  };

  registrarSus = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }
    const parsed = susBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Respostas do SUS inválidas', parsed.error.issues);
    }

    const sessaoId = req.params.sessaoId ?? '';
    const resposta = await this.pesquisaService.registrarSus(
      req.usuario.id,
      sessaoId,
      parsed.data.itens,
      parsed.data.pontuacaoSus,
    );
    this.handleSuccess(res, resposta, HTTP_CREATED);
  };

  registrarRtlx = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }
    const parsed = rtlxBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Respostas do RTLX inválidas', parsed.error.issues);
    }

    const sessaoId = req.params.sessaoId ?? '';
    const resposta = await this.pesquisaService.registrarRtlx(
      req.usuario.id,
      sessaoId,
      parsed.data.dimensoes,
      parsed.data.pontuacaoRtlx,
    );
    this.handleSuccess(res, resposta, HTTP_CREATED);
  };
}

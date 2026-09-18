import type { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { gerarPacoteBodySchema } from '../dtos/pacote.dto';
import { UnauthorizedError, ValidationError } from '../errors';
import { renderizarPacotePdf } from '../lib/pacotePdf';
import type { PacoteService } from '../services/PacoteService';

const HTTP_SEM_CONTEUDO = 204;

export class PacoteController {
  constructor(private readonly pacoteService: PacoteService) {}

  gerar = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }
    const usuarioId = req.usuario.id;

    const parsed = gerarPacoteBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Dados de pacote inválidos', parsed.error.issues);
    }

    const exercicioId = req.params.id ?? '';
    const dados = await this.pacoteService.gerar(usuarioId, exercicioId, {
      imagensModelos: parsed.data.imagens ?? [],
      sqlModelo: parsed.data.sqlModelo ?? null,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="exercicio-${exercicioId}.pdf"`);

    const doc = new PDFDocument();
    doc.pipe(res);
    renderizarPacotePdf(doc, {
      titulo: dados.exercicio.titulo,
      enunciado: dados.exercicio.enunciado,
      querySql: dados.submissaoSql?.query_sql ?? null,
      respostaDissertativa: dados.respostaDissertativa?.texto ?? null,
      imagensModelos: dados.imagensModelos,
      sqlModelo: dados.sqlModelo,
    });

    doc.end();
  };

  finalizar = async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new UnauthorizedError('Autenticação necessária');
    }

    const exercicioId = req.params.id ?? '';
    await this.pacoteService.finalizar(req.usuario.id, exercicioId);
    res.status(HTTP_SEM_CONTEUDO).send();
  };
}

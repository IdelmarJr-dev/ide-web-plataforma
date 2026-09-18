const DIAGRAMA_LARGURA_MAX = 480;
const DIAGRAMA_ALTURA_MAX = 320;

const TAMANHO_FONTE_TITULO = 18;
const TAMANHO_FONTE_TEXTO = 12;
const TAMANHO_FONTE_SECAO = 14;
const TAMANHO_FONTE_CODIGO = 10;
const ESPACAMENTO_MEIA_LINHA = 0.5;

/** Imagem de um dos modelos, capturada no navegador do aluno. */
export interface ImagemModeloPdf {
  rotulo: string;
  pngBase64: string;
}

export interface DadosPacotePdf {
  titulo: string;
  enunciado: string;
  querySql: string | null;
  respostaDissertativa: string | null;
  // Até duas: modelo conceitual e modelo lógico (ver docs/decisions/fase7-modelagem-conceitual-logica.md).
  imagensModelos: ImagemModeloPdf[];
  // SQL gerado do modelo lógico do aluno.
  sqlModelo: string | null;
}

/** Renderização pura — não abre nem fecha o documento, quem chama controla o stream. */
export function renderizarPacotePdf(doc: PDFKit.PDFDocument, dados: DadosPacotePdf): void {
  doc.fontSize(TAMANHO_FONTE_TITULO).text(dados.titulo, { underline: true });
  doc.moveDown();
  doc.fontSize(TAMANHO_FONTE_TEXTO).font('Helvetica').text(dados.enunciado);
  doc.moveDown();

  if (dados.querySql) {
    doc.fontSize(TAMANHO_FONTE_SECAO).font('Helvetica-Bold').text('Consulta SQL enviada');
    doc.fontSize(TAMANHO_FONTE_CODIGO).font('Courier').text(dados.querySql);
    doc.font('Helvetica');
    doc.moveDown();
  }

  if (dados.respostaDissertativa) {
    doc.fontSize(TAMANHO_FONTE_SECAO).font('Helvetica-Bold').text('Resposta dissertativa');
    doc.fontSize(TAMANHO_FONTE_TEXTO).font('Helvetica').text(dados.respostaDissertativa);
    doc.moveDown();
  }

  for (const imagem of dados.imagensModelos) {
    doc.fontSize(TAMANHO_FONTE_SECAO).font('Helvetica-Bold').text(imagem.rotulo);
    doc.moveDown(ESPACAMENTO_MEIA_LINHA);
    doc.image(Buffer.from(imagem.pngBase64, 'base64'), {
      fit: [DIAGRAMA_LARGURA_MAX, DIAGRAMA_ALTURA_MAX],
    });
    doc.moveDown();
  }

  if (dados.sqlModelo) {
    doc.fontSize(TAMANHO_FONTE_SECAO).font('Helvetica-Bold').text('SQL do modelo lógico');
    doc.fontSize(TAMANHO_FONTE_CODIGO).font('Courier').text(dados.sqlModelo);
    doc.font('Helvetica');
    doc.moveDown();
  }
}

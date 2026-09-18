import { describe, expect, it } from 'vitest';
import { renderizarPacotePdf } from '../../src/lib/pacotePdf';

/** Documento falso: guarda o que foi escrito, sem gerar PDF de verdade. */
function criarDocumentoFalso(): { doc: PDFKit.PDFDocument; textos: string[]; imagens: Buffer[] } {
  const textos: string[] = [];
  const imagens: Buffer[] = [];
  const doc = {
    fontSize: () => doc,
    font: () => doc,
    moveDown: () => doc,
    text: (conteudo: string) => {
      textos.push(conteudo);
      return doc;
    },
    image: (dados: Buffer) => {
      imagens.push(dados);
      return doc;
    },
  } as unknown as PDFKit.PDFDocument & { textos: string[] };

  return { doc, textos, imagens };
}

describe('renderizarPacotePdf', () => {
  it('embute as duas imagens dos modelos com os rótulos e o SQL do modelo lógico', () => {
    const { doc, textos, imagens } = criarDocumentoFalso();

    renderizarPacotePdf(doc, {
      titulo: 'Locadora',
      enunciado: 'Modele o banco da locadora.',
      querySql: null,
      respostaDissertativa: null,
      imagensModelos: [
        { rotulo: 'Modelo conceitual', pngBase64: Buffer.from('conceitual').toString('base64') },
        { rotulo: 'Modelo lógico', pngBase64: Buffer.from('logico').toString('base64') },
      ],
      sqlModelo: 'CREATE TABLE filme ();',
    });

    expect(textos).toContain('Modelo conceitual');
    expect(textos).toContain('Modelo lógico');
    expect(textos).toContain('SQL do modelo lógico');
    expect(textos).toContain('CREATE TABLE filme ();');
    expect(imagens.map((imagem) => imagem.toString())).toEqual(['conceitual', 'logico']);
  });

  it('omite as seções de modelagem quando o aluno não tem modelo', () => {
    const { doc, textos, imagens } = criarDocumentoFalso();

    renderizarPacotePdf(doc, {
      titulo: 'Consulta',
      enunciado: 'Escreva a consulta.',
      querySql: 'SELECT 1',
      respostaDissertativa: null,
      imagensModelos: [],
      sqlModelo: null,
    });

    expect(imagens).toHaveLength(0);
    expect(textos).not.toContain('SQL do modelo lógico');
    expect(textos).toContain('Consulta SQL enviada');
  });
});

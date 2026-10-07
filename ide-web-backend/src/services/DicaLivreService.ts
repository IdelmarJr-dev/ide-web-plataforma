import type { PedirDicaLivreBodyDto } from '../dtos/dicaIa.dto';
import { TooManyRequestsError } from '../errors';
import type { LlmClient } from '../repositories/llm/GroqLlmClient';

const LIMITE_PEDIDOS_POR_JANELA = 10;
const MINUTOS_POR_HORA = 60;
const SEGUNDOS_POR_MINUTO = 60;
const MS_POR_SEGUNDO = 1000;
const JANELA_MS = MINUTOS_POR_HORA * SEGUNDOS_POR_MINUTO * MS_POR_SEGUNDO;

const SEM_OBJETIVO_INFORMADO = 'o aluno não disse o que está tentando fazer';

/**
 * Dica de IA pro estudo livre (Fase 8: banco sem turma/exercício, "Meu banco"). Sem
 * exercicio_id pra ancorar (ver DicaIa no schema), não dá pra reusar a quota por
 * contexto do DicaIaService — o limite aqui é uma janela deslizante em memória por
 * processo (reseta em redeploy, não é compartilhado entre instâncias). Aceitável pro
 * tamanho atual de uso; se crescer, vale mover pra uma tabela própria com janela real.
 */
export class DicaLivreService {
  private readonly pedidosPorUsuario = new Map<string, number[]>();

  constructor(private readonly llmClient: LlmClient) {}

  async pedir(usuarioId: string, input: PedirDicaLivreBodyDto): Promise<string> {
    this.exigirTaxaDisponivel(usuarioId);

    const prompt = this.montarPrompt(input);
    const resposta = await this.llmClient.gerarDica(prompt);
    return resposta.texto;
  }

  private exigirTaxaDisponivel(usuarioId: string): void {
    const agora = Date.now();
    const pedidosAnteriores = this.pedidosPorUsuario.get(usuarioId) ?? [];
    const pedidosNaJanela = pedidosAnteriores.filter((timestamp) => agora - timestamp < JANELA_MS);

    if (pedidosNaJanela.length >= LIMITE_PEDIDOS_POR_JANELA) {
      throw new TooManyRequestsError('Limite de dicas no estudo livre atingido, tente novamente mais tarde');
    }

    pedidosNaJanela.push(agora);
    this.pedidosPorUsuario.set(usuarioId, pedidosNaJanela);
  }

  private montarPrompt(input: PedirDicaLivreBodyDto): string {
    const objetivo = input.objetivo?.trim();
    const objetivoDescrito = objetivo === undefined || objetivo === '' ? SEM_OBJETIVO_INFORMADO : objetivo;
    return [
      'O aluno está estudando sozinho, sem um exercício formal — ele criou as próprias tabelas num banco livre.',
      `O que ele diz que está tentando fazer: ${objetivoDescrito}`,
      `SQL atual do aluno:\n${input.sql}`,
      'Dê uma dica curta sobre o próximo passo ou o que revisar, sem reescrever a consulta pronta pra ele.',
    ].join('\n\n');
  }
}

import { config } from '../../config';
import { LlmIndisponivelError, LlmNaoConfiguradoError } from '../../errors';
import { logger } from '../../utils/logger';

// System prompt fixo: nunca revelar a resposta/gabarito completo, só orientar.
// Ver docs/decisions/fase3-dicas-ia.md.
const SYSTEM_PROMPT =
  'Você é um assistente pedagógico de banco de dados para alunos de graduação. ' +
  'Dado o enunciado de um exercício, a tentativa atual do aluno e (se houver) o erro da ' +
  'última submissão, dê uma dica curta que ajude o aluno a avançar sozinho. ' +
  'NUNCA escreva a query SQL completa nem o diagrama MER completo da resposta certa — ' +
  'aponte o próximo passo, o conceito envolvido ou o que revisar, sem entregar a solução pronta.';

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';
const HTTP_TOO_MANY_REQUESTS = 429;
const MAX_TENTATIVAS = 4;
const MS_POR_SEGUNDO = 1000;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MULTIPLICADOR = 2;

export interface LlmRespostaDica {
  texto: string;
  tokensUsados: number | null;
}

export interface LlmClient {
  gerarDica(prompt: string): Promise<LlmRespostaDica>;
}

interface GroqChatCompletionResponse {
  choices: { message: { content: string } }[];
  usage?: { total_tokens?: number };
}

function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function calcularEsperaMs(tentativa: number, retryAfterHeader: string | null): number {
  const retryAfterSegundos = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (!Number.isNaN(retryAfterSegundos) && retryAfterSegundos > 0) {
    return retryAfterSegundos * MS_POR_SEGUNDO;
  }

  return BACKOFF_BASE_MS * BACKOFF_MULTIPLICADOR ** tentativa;
}

/**
 * Client OpenAI-compatible para o Groq (free tier: 30 req/min por organização —
 * ver docs/decisions/fase3-dicas-ia.md). Absorve burst de alunos pedindo dica ao
 * mesmo tempo com fila/retry + backoff em 429, em vez de propagar o erro pro aluno.
 */
export class GroqLlmClient implements LlmClient {
  async gerarDica(prompt: string): Promise<LlmRespostaDica> {
    if (!config.llm.apiKey) {
      throw new LlmNaoConfiguradoError();
    }

    for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa += 1) {
      const response = await this.chamarGroq(prompt, config.llm.apiKey);

      if (response.status === HTTP_TOO_MANY_REQUESTS) {
        const espera = calcularEsperaMs(tentativa, response.headers.get('retry-after'));
        logger.warn('Groq rate limit atingido, aguardando antes de tentar de novo', { tentativa, espera });
        await aguardar(espera);
        continue;
      }

      if (!response.ok) {
        const corpo = await response.text();
        logger.error('Falha ao chamar Groq', { status: response.status, corpo });
        throw new LlmIndisponivelError();
      }

      const dados = (await response.json()) as GroqChatCompletionResponse;
      const texto = dados.choices[0]?.message.content.trim();
      if (!texto) {
        throw new LlmIndisponivelError();
      }

      return { texto, tokensUsados: dados.usage?.total_tokens ?? null };
    }

    throw new LlmIndisponivelError();
  }

  private async chamarGroq(prompt: string, apiKey: string): Promise<Response> {
    try {
      return await fetch(GROQ_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: config.llm.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
        }),
      });
    } catch (error) {
      logger.error('Erro de rede ao chamar Groq', { error: error instanceof Error ? error.message : error });
      throw new LlmIndisponivelError();
    }
  }
}

import type { Exercicio } from '../generated/prisma/client';
import type { AlocacaoGrupoRepository } from '../repositories/AlocacaoGrupoRepository';
import type { PesquisaRepository } from '../repositories/PesquisaRepository';
import type { RegraEnvioUnico } from './AcessoExercicioService';

const MOTIVO = 'Na pesquisa, o grupo controle entrega a consulta uma vez só, e a sua já foi registrada';

/**
 * Pesquisa do TCC (código só-pesquisa, removido depois da coleta — ver CLAUDE.md): no
 * grupo controle a consulta final da tarefa é entregue uma vez só (ControleEntrega).
 * Até 16/11/2026 isso valia só no navegador (localStorage); outro navegador, ou a API
 * direto, entregava de novo e o CSV contava mais de uma tentativa. Ligada só nas rotas
 * do sandbox; tirar a pesquisa é apagar este arquivo e o argumento em sandbox.routes.ts.
 */
export class EntregaUnicaDoControle implements RegraEnvioUnico {
  constructor(
    private readonly pesquisaRepository: PesquisaRepository,
    private readonly alocacaoGrupoRepository: AlocacaoGrupoRepository,
  ) {}

  async motivoEnvioUnico(usuarioId: string, exercicio: Exercicio): Promise<string | null> {
    const pesquisa = await this.pesquisaRepository.buscarAtivaPorTurma(exercicio.turma_id);
    if (!pesquisa?.exercicio_ids.includes(exercicio.id)) {
      return null;
    }

    const alocacao = await this.alocacaoGrupoRepository.buscarPorPesquisaEUsuario(pesquisa.id, usuarioId);
    return alocacao?.grupo === 'controle' ? MOTIVO : null;
  }
}

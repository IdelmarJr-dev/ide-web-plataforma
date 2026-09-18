import type { AcertosResponseDto } from '../dtos/pesquisa.dto';
import { NotFoundError, ValidationError } from '../errors';
import type { DicaIaRepository } from '../repositories/DicaIaRepository';
import type { ExercicioRepository } from '../repositories/ExercicioRepository';
import type { MatriculaRepository } from '../repositories/MatriculaRepository';
import type { SubmissaoSqlRepository } from '../repositories/SubmissaoSqlRepository';
import type { UsuarioRepository } from '../repositories/UsuarioRepository';
import { signResearchToken } from '../utils/jwt';

/**
 * Pontos de contato do Node com a pesquisa do TCC (código só-pesquisa, removido
 * depois da coleta — ver CLAUDE.md): o token curto pro backend Python e os acertos
 * por aluno que o pesquisador junta à exportação do Python.
 */
export class PesquisaService {
  constructor(
    private readonly usuarioRepository: UsuarioRepository,
    private readonly exercicioRepository: ExercicioRepository,
    private readonly matriculaRepository: MatriculaRepository,
    private readonly submissaoSqlRepository: SubmissaoSqlRepository,
    private readonly dicaIaRepository: DicaIaRepository,
  ) {}

  async gerarToken(usuarioId: string): Promise<string> {
    const usuario = await this.usuarioRepository.findById(usuarioId);
    if (!usuario) {
      throw new NotFoundError('Usuário');
    }

    const matriculas = await this.matriculaRepository.findByAlunoId(usuario.id);

    return signResearchToken({
      usuario_id: usuario.id,
      papel: usuario.papel,
      turma_ids: matriculas.map((matricula) => matricula.turma_id),
    });
  }

  /**
   * Taxa de acerto e tentativas por aluno × exercício da tarefa — métricas
   * complementares do TCC (Resultados Esperados). O grupo controle entrega a query
   * final pela mesma rota de envio do sandbox, então aparece aqui do mesmo jeito.
   */
  async acertos(exercicioIds: string[]): Promise<AcertosResponseDto> {
    const exercicios = await this.exercicioRepository.findByIds(exercicioIds);
    if (exercicios.length !== exercicioIds.length) {
      throw new NotFoundError('Exercício');
    }

    const turmas = new Set(exercicios.map((exercicio) => exercicio.turma_id));
    const [turmaId] = turmas;
    if (turmas.size !== 1 || !turmaId) {
      throw new ValidationError('Os exercícios da tarefa precisam ser da mesma turma');
    }

    const [alunos, submissoes, dicas] = await Promise.all([
      this.matriculaRepository.findAlunosDaTurma(turmaId),
      this.submissaoSqlRepository.findResumoPorExercicios(exercicioIds),
      this.dicaIaRepository.contarPorExercicios(exercicioIds),
    ]);

    const chave = (usuarioId: string, exercicioId: string): string => `${usuarioId}:${exercicioId}`;
    const tentativas = new Map<string, { total: number; acertou: boolean }>();
    for (const submissao of submissoes) {
      const atual = tentativas.get(chave(submissao.usuario_id, submissao.exercicio_id)) ?? { total: 0, acertou: false };
      atual.total += 1;
      atual.acertou ||= submissao.correta === true;
      tentativas.set(chave(submissao.usuario_id, submissao.exercicio_id), atual);
    }
    const dicasPorChave = new Map<string, { sql: number; mer: number }>();
    for (const contagem of dicas) {
      const atual = dicasPorChave.get(chave(contagem.usuario_id, contagem.exercicio_id)) ?? { sql: 0, mer: 0 };
      atual[contagem.contexto] += contagem.total;
      dicasPorChave.set(chave(contagem.usuario_id, contagem.exercicio_id), atual);
    }

    return {
      turmaId,
      exercicioIds,
      alunos: alunos
        .filter((usuario) => usuario.papel === 'aluno')
        .map((aluno) => ({
          usuarioId: aluno.id,
          exercicios: exercicioIds.map((exercicioId) => {
            const envio = tentativas.get(chave(aluno.id, exercicioId));
            const dicasDoAluno = dicasPorChave.get(chave(aluno.id, exercicioId));
            return {
              exercicioId,
              tentativas: envio?.total ?? 0,
              correta: envio ? envio.acertou : null,
              dicasSql: dicasDoAluno?.sql ?? 0,
              dicasMer: dicasDoAluno?.mer ?? 0,
            };
          }),
        })),
    };
  }
}

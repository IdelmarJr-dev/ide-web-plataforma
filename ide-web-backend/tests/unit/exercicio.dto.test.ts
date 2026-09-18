import { describe, expect, it } from 'vitest';
import { toExercicioAlunoResponseDto, toExercicioProfessorResponseDto } from '../../src/dtos/exercicio.dto';
import type { Exercicio } from '../../src/generated/prisma/client';

function buildExercicio(overrides: Partial<Exercicio> = {}): Exercicio {
  return {
    id: 'exercicio-1',
    turma_id: 'turma-1',
    prova_id: null,
    titulo: 'Consulta básica',
    enunciado: 'Escreva uma query que...',
    nivel_dificuldade: 'iniciante',
    publico: false,
    mer_gabarito: { entidades: ['Usuario'] },
    modo_mer: 'logico',
    sql_gabarito: 'SELECT * FROM usuarios',
    sql_setup: null,
    gabarito_dissertativo: 'Resposta esperada...',
    gabarito_liberado: false,
    gabarito_liberado_em: null,
    prazo: null,
    ordem: 1,
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('exercicio.dto', () => {
  it('a resposta do aluno nunca inclui nenhum campo de gabarito', () => {
    const dto = toExercicioAlunoResponseDto(buildExercicio());

    expect(dto).not.toHaveProperty('merGabarito');
    expect(dto).not.toHaveProperty('sqlGabarito');
    expect(dto).not.toHaveProperty('gabaritoDissertativo');
  });

  it('a resposta do aluno diz quais partes existem, sem expor o conteúdo delas', () => {
    const dto = toExercicioAlunoResponseDto(buildExercicio());

    expect(dto.temSql).toBe(true);
    expect(dto.temMer).toBe(true);
    expect(dto.temDissertativa).toBe(true);
  });

  it('temSql/temMer/temDissertativa refletem partes ausentes', () => {
    const dto = toExercicioAlunoResponseDto(
      buildExercicio({ sql_gabarito: null, mer_gabarito: null, gabarito_dissertativo: null }),
    );

    expect(dto.temSql).toBe(false);
    expect(dto.temMer).toBe(false);
    expect(dto.temDissertativa).toBe(false);
  });

  it('a resposta do aluno informa o nível da modelagem definido pelo professor', () => {
    expect(toExercicioAlunoResponseDto(buildExercicio()).modoMer).toBe('logico');
  });

  it('a resposta do aluno inclui o script de dados-exemplo (não é resposta)', () => {
    const dto = toExercicioAlunoResponseDto(buildExercicio({ sql_setup: 'CREATE TABLE t (id INT);' }));

    expect(dto.sqlSetup).toBe('CREATE TABLE t (id INT);');
  });

  it('a resposta do professor inclui os gabaritos', () => {
    const dto = toExercicioProfessorResponseDto(buildExercicio());

    expect(dto.sqlGabarito).toBe('SELECT * FROM usuarios');
    expect(dto.gabaritoDissertativo).toBe('Resposta esperada...');
    expect(dto.merGabarito).toEqual({ entidades: ['Usuario'] });
  });
});

import type { GrantStmt, Node, ObjectType, RangeVar, VariableSetStmt } from 'libpg-query';

/**
 * Pra onde a instrução deve ir depois de classificada: a conexão de execução do
 * próprio aluno (`exec_<usuario_id>`, hoje) ou a conexão dedicada só a `CREATE ROLE`/
 * `DROP ROLE`/`GRANT papel TO papel` com `CREATEROLE` (Fase 12, D9/D13/D14 — ainda não
 * implementada; esta etapa só precisa classificar corretamente, a etapa 5 do decision
 * doc constrói essa segunda conexão e o `RoleNameRewriter`).
 */
export type RotaInstrucao = 'execucao_aluno' | 'administracao_role';

export interface InstrucaoPermitida {
  permitida: true;
  rota: RotaInstrucao;
  tipoNo: string;
}

export interface InstrucaoRejeitada {
  permitida: false;
  tipoNo: string;
  motivo: string;
}

export type ClassificacaoInstrucao = InstrucaoPermitida | InstrucaoRejeitada;

function permitida(rota: RotaInstrucao, tipoNo: string): InstrucaoPermitida {
  return { permitida: true, rota, tipoNo };
}

function rejeitada(tipoNo: string, motivo: string): InstrucaoRejeitada {
  return { permitida: false, tipoNo, motivo };
}

function motivoPadrao(tipoNo: string): string {
  return `Comando não permitido no sandbox (${tipoNo}).`;
}

function motivoQualificado(tipoNo: string): string {
  return `Comando não permitido: ${tipoNo} não pode referenciar objeto de outro schema.`;
}

/** Todo nó do AST é `{ NomeDoTipo: corpo }` — sempre uma única chave. */
function tipoDoNo(node: object): string {
  return Object.keys(node)[0] ?? 'Desconhecido';
}

function nomeQualificado(partes: Node[] | undefined): boolean {
  return (partes?.length ?? 0) > 1;
}

function schemaQualificado(rangeVar: RangeVar | undefined): boolean {
  return Boolean(rangeVar?.schemaname);
}

/**
 * Objeto referenciado por um `GRANT`/`REVOKE` ou por um `DROP` de TABLE/VIEW/INDEX/
 * SEQUENCE/TYPE/FUNCTION/PROCEDURE — cada um desses serializa o nome num formato
 * diferente (`RangeVar`, `ObjectWithArgs`, `TypeName`, ou um `List` de `String`), mas
 * a pergunta é sempre a mesma: tem mais de uma parte (schema.nome), ou é só o nome?
 * Ver comentário de `classificarDrop` pro caso especial de `DROP TRIGGER` (a lista vem
 * sempre com 2+ partes, pela própria sintaxe `ON tabela`, não por qualificação).
 */
function objetoReferenciaOutroSchema(objeto: Node): boolean {
  if (typeof objeto !== 'object') return false;
  const tipo = tipoDoNo(objeto);
  const corpo = (objeto as Record<string, unknown>)[tipo];

  switch (tipo) {
    case 'RangeVar':
      return schemaQualificado(corpo as RangeVar);
    case 'ObjectWithArgs':
      return nomeQualificado((corpo as { objname?: Node[] }).objname);
    case 'TypeName':
      return nomeQualificado((corpo as { names?: Node[] }).names);
    case 'List':
      return ((corpo as { items?: Node[] }).items?.length ?? 0) > 1;
    default:
      // String solto (ex.: nome de extensão) — não é um objeto com schema, não se aplica.
      return false;
  }
}

function classificarGrant(tipoNo: string, grant: GrantStmt): ClassificacaoInstrucao {
  // ACL_TARGET_ALL_IN_SCHEMA ("... ON ALL TABLES IN SCHEMA x ...") e ACL_TARGET_DEFAULTS
  // (privilégio padrão pra objetos futuros) alcançam além do objeto nomeado — só objeto
  // específico entra na lista branca (decision doc, lista branca v1).
  if (grant.targtype !== 'ACL_TARGET_OBJECT') {
    return rejeitada(
      tipoNo,
      `${tipoNo === 'GrantStmt' ? 'GRANT/REVOKE' : tipoNo} só é permitido em um objeto específico do próprio schema (não em ALL IN SCHEMA nem em privilégio padrão).`,
    );
  }

  const algumQualificado = (grant.objects ?? []).some(objetoReferenciaOutroSchema);
  if (algumQualificado) {
    return rejeitada(tipoNo, motivoQualificado(tipoNo));
  }

  return permitida('execucao_aluno', tipoNo);
}

function classificarDrop(tipoNo: string, removeType: ObjectType | undefined, objects: Node[]): ClassificacaoInstrucao {
  const tiposPermitidos: ObjectType[] = [
    'OBJECT_TABLE',
    'OBJECT_VIEW',
    'OBJECT_INDEX',
    'OBJECT_SEQUENCE',
    'OBJECT_FUNCTION',
    'OBJECT_PROCEDURE',
    'OBJECT_TRIGGER',
    'OBJECT_TYPE',
  ];
  if (!removeType || !tiposPermitidos.includes(removeType)) {
    return rejeitada(tipoNo, motivoPadrao(`DROP ${removeType ?? 'desconhecido'}`));
  }

  // DROP TRIGGER serializa como List [schema?, tabela, trigger] — a sintaxe
  // `ON tabela` já obriga 2 partes mesmo sem qualificação nenhuma, então "mais de uma
  // parte" não serve de sinal aqui: só 3+ partes indica schema.tabela qualificado.
  const PARTES_TRIGGER_SEM_SCHEMA = 2;
  if (removeType === 'OBJECT_TRIGGER') {
    const algumQualificado = objects.some((objeto) => {
      if (typeof objeto !== 'object') return false;
      const lista = (objeto as { List?: { items?: Node[] } }).List;
      return (lista?.items?.length ?? 0) > PARTES_TRIGGER_SEM_SCHEMA;
    });
    return algumQualificado ? rejeitada(tipoNo, motivoQualificado('DROP TRIGGER')) : permitida('execucao_aluno', tipoNo);
  }

  const algumQualificado = objects.some(objetoReferenciaOutroSchema);
  return algumQualificado ? rejeitada(tipoNo, motivoQualificado(`DROP ${removeType}`)) : permitida('execucao_aluno', tipoNo);
}

function classificarVariableSet(tipoNo: string, set: VariableSetStmt): ClassificacaoInstrucao {
  // VariableSetStmt cobre SET ROLE, SET SESSION AUTHORIZATION e SET search_path sob o
  // mesmo tipo de nó — tratar cada `name` nomeadamente (skill sql-sandbox-security,
  // item 2 / decision doc D12), nunca liberar o nó genérico inteiro.
  if (set.name === 'role' && (set.kind === 'VAR_SET_VALUE' || set.kind === 'VAR_RESET')) {
    // Pra qual role é permitido trocar (só uma que já pertence ao aluno) é validado
    // pelo próprio Postgres no SET ROLE real — não é responsabilidade do classificador.
    return permitida('execucao_aluno', tipoNo);
  }
  if (set.name === 'session_authorization') {
    return rejeitada(tipoNo, 'SET SESSION AUTHORIZATION não é permitido no sandbox.');
  }
  if (set.name === 'search_path') {
    return rejeitada(tipoNo, 'SET search_path não é permitido no sandbox — o schema já é o seu, fixado pelo servidor.');
  }
  return rejeitada(tipoNo, `SET/RESET de "${set.name ?? ''}" não é permitido no sandbox — só SET ROLE/RESET ROLE.`);
}

/**
 * Classifica uma única instrução (já dividida por `dividirScript`) numa rota de
 * execução ou rejeita com um motivo em português. Lista branca v1 do decision doc
 * (`docs/decisions/fase12-sql-studio-bd2.md`, D4/D11/D12) — negar por padrão: toda
 * instrução cujo tipo de nó não bate com algo abaixo cai no `default`, rejeitada.
 *
 * Escopo conhecido (deliberado, não um descuido): a verificação "não referencia outro
 * schema" roda pro objeto sendo criado/alterado/removido (CREATE/ALTER/DROP/GRANT), não
 * pras tabelas referenciadas dentro de um SELECT/INSERT/UPDATE/DELETE (ex.:
 * `SELECT * FROM outro_schema.tabela`) — isso exigiria percorrer toda a árvore de FROM/
 * JOIN/subquery/CTE. Fica contido mesmo assim pelo privilégio real do Postgres: a role
 * de execução do aluno só tem GRANT no próprio schema (skill sql-sandbox-security, item
 * 6) — uma referência cross-schema numa DML falha por permissão negada no banco, só com
 * uma mensagem menos amigável do que a que este classificador daria.
 */
export function classificarInstrucao(stmt: Node): ClassificacaoInstrucao {
  const tipoNo = tipoDoNo(stmt);
  const corpo = (stmt as Record<string, unknown>)[tipoNo];

  switch (tipoNo) {
    case 'SelectStmt':
    case 'InsertStmt':
    case 'UpdateStmt':
    case 'DeleteStmt':
    case 'DoStmt':
      return permitida('execucao_aluno', tipoNo);

    case 'CreateStmt': // CREATE TABLE
      return schemaQualificado((corpo as { relation?: RangeVar }).relation)
        ? rejeitada(tipoNo, motivoQualificado(tipoNo))
        : permitida('execucao_aluno', tipoNo);

    case 'AlterTableStmt':
      return schemaQualificado((corpo as { relation?: RangeVar }).relation)
        ? rejeitada(tipoNo, motivoQualificado(tipoNo))
        : permitida('execucao_aluno', tipoNo);

    case 'ViewStmt':
      return schemaQualificado((corpo as { view?: RangeVar }).view)
        ? rejeitada(tipoNo, motivoQualificado(tipoNo))
        : permitida('execucao_aluno', tipoNo);

    case 'IndexStmt':
      return schemaQualificado((corpo as { relation?: RangeVar }).relation)
        ? rejeitada(tipoNo, motivoQualificado(tipoNo))
        : permitida('execucao_aluno', tipoNo);

    case 'CreateSeqStmt':
      return schemaQualificado((corpo as { sequence?: RangeVar }).sequence)
        ? rejeitada(tipoNo, motivoQualificado(tipoNo))
        : permitida('execucao_aluno', tipoNo);

    case 'AlterSeqStmt':
      return schemaQualificado((corpo as { sequence?: RangeVar }).sequence)
        ? rejeitada(tipoNo, motivoQualificado(tipoNo))
        : permitida('execucao_aluno', tipoNo);

    case 'CreateFunctionStmt': // cobre FUNCTION e PROCEDURE (campo is_procedure)
      return nomeQualificado((corpo as { funcname?: Node[] }).funcname)
        ? rejeitada(tipoNo, motivoQualificado(tipoNo))
        : permitida('execucao_aluno', tipoNo);

    case 'AlterFunctionStmt':
      return nomeQualificado((corpo as { func?: { objname?: Node[] } }).func?.objname)
        ? rejeitada(tipoNo, motivoQualificado(tipoNo))
        : permitida('execucao_aluno', tipoNo);

    case 'CreateTrigStmt':
      return schemaQualificado((corpo as { relation?: RangeVar }).relation)
        ? rejeitada(tipoNo, motivoQualificado(tipoNo))
        : permitida('execucao_aluno', tipoNo);

    case 'CompositeTypeStmt': // CREATE TYPE x AS (...)
      return schemaQualificado((corpo as { typevar?: RangeVar }).typevar)
        ? rejeitada(tipoNo, motivoQualificado(tipoNo))
        : permitida('execucao_aluno', tipoNo);

    case 'CreateEnumStmt': // CREATE TYPE x AS ENUM (...)
    case 'CreateRangeStmt': // CREATE TYPE x AS RANGE (...)
    case 'AlterEnumStmt': // ALTER TYPE x ADD VALUE ...
      return nomeQualificado((corpo as { typeName?: Node[] }).typeName)
        ? rejeitada(tipoNo, motivoQualificado(tipoNo))
        : permitida('execucao_aluno', tipoNo);

    case 'DropStmt':
      return classificarDrop(tipoNo, (corpo as { removeType?: ObjectType }).removeType, (corpo as { objects?: Node[] }).objects ?? []);

    case 'GrantStmt':
      return classificarGrant(tipoNo, corpo as GrantStmt);

    case 'VariableSetStmt':
      return classificarVariableSet(tipoNo, corpo as VariableSetStmt);

    case 'CreateRoleStmt':
    case 'DropRoleStmt':
    case 'GrantRoleStmt': // GRANT papel TO papel / REVOKE papel FROM papel
      return permitida('administracao_role', tipoNo);

    // Nomeados explicitamente (skill sql-sandbox-security, item 2) mesmo já cobertos
    // pelo default-deny abaixo — mensagem mais clara pro aluno do que o genérico.
    case 'AlterRoleStmt':
    case 'AlterRoleSetStmt':
      return rejeitada(tipoNo, 'ALTER ROLE não é permitido no sandbox.');
    case 'AlterSystemStmt':
      return rejeitada(tipoNo, 'ALTER SYSTEM não é permitido no sandbox.');
    case 'CreateExtensionStmt':
      return rejeitada(tipoNo, 'CREATE EXTENSION não é permitido no sandbox.');
    case 'CopyStmt':
      return rejeitada(tipoNo, 'COPY não é permitido no sandbox.');
    case 'ListenStmt':
    case 'NotifyStmt':
    case 'UnlistenStmt':
      return rejeitada(tipoNo, 'LISTEN/NOTIFY não é permitido no sandbox.');

    default:
      return rejeitada(tipoNo, motivoPadrao(tipoNo));
  }
}

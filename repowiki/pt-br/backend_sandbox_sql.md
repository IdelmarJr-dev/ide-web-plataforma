# Módulo Backend Sandbox SQL

## Visão geral

O módulo **backend_sandbox_sql** oferece ambientes isolados de execução de SQL para que os alunos pratiquem consultas de banco de dados com segurança. Cada aluno recebe o seu próprio schema PostgreSQL por exercício, com correção automática, análise do plano de execução e limites de segurança que impedem a interferência entre usuários. O módulo dá suporte tanto a exercícios guiados (com schemas predefinidos e gabaritos) quanto ao modo de estudo livre (em que os alunos montam os próprios schemas).

Este é um módulo **crítico para a segurança**, pois lida com SQL não confiável vindo de alunos. Desde a Fase 12, ele implementa roles de execução por usuário, com controle granular de privilégios, garantindo que os alunos só acessem os seus próprios sandboxes.

---

## Sumário

1. [Arquitetura](#arquitetura)
2. [Relações entre componentes](#relações-entre-componentes)
3. [Modelo de segurança](#modelo-de-segurança)
4. [Fluxo de dados](#fluxo-de-dados)
5. [Endpoints da API](#endpoints-da-api)
6. [Componentes principais](#componentes-principais)
7. [Correção automática](#correção-automática)
8. [Modo de estudo livre](#modo-de-estudo-livre)
9. [Tratamento de erros](#tratamento-de-erros)
10. [Configuração e instalação](#configuração-e-instalação)
11. [Evolução e decisões de projeto](#evolução-e-decisões-de-projeto)
12. [Módulos relacionados](#módulos-relacionados)

---

## Arquitetura

```mermaid
graph TB
    subgraph "Camada HTTP"
        SC[SandboxController]
    end
    
    subgraph "Lógica de negócio"
        SSS[SandboxSqlService]
        AES[AcessoExercicioService]
    end
    
    subgraph "Camada de acesso a dados"
        SPR[SandboxProvisioningRepository]
        SER[SandboxExecutionRepository]
        SSR[SubmissaoSqlRepository]
        RER[ResultadoExercicioRepository]
    end
    
    subgraph "Sistemas externos"
        DB_MAIN[(Banco principal<br/>Supabase)]
        DB_SANDBOX[(Banco do sandbox<br/>Supabase separado)]
    end
    
    SC --> SSS
    SSS --> AES
    SSS --> SPR
    SSS --> SER
    SSS --> SSR
    SSS --> RER
    
    SPR --> DB_SANDBOX
    SER --> DB_SANDBOX
    SSR --> DB_MAIN
    RER --> DB_MAIN
    AES --> DB_MAIN
    
    style SC fill:#e1f5ff
    style SSS fill:#fff4e1
    style SPR fill:#e8f5e9
    style SER fill:#e8f5e9
    style DB_SANDBOX fill:#ffebee
```

**Principais decisões de arquitetura:**

1. **Banco de dados separado**: o sandbox executa num projeto Supabase dedicado, isolado do banco de dados principal da aplicação
2. **Modelo de duas conexões**: 
   - **Conexão de provisionamento** (`SANDBOX_DATABASE_URL`): tem o privilégio `CREATEROLE`, cria e derruba schemas e roles
   - **Conexão de execução** (`SANDBOX_EXEC_DATABASE_URL`): restrita, faz login como `sandbox_login` e assume as roles por usuário
3. **Um schema por exercício**: cada aluno recebe um schema dedicado `sandbox_<exercicio_id>_<usuario_id>`
4. **Uma role por usuário** (Fase 12): cada aluno tem a sua própria role de execução `exec_<usuario_id>`, o que impede o acesso entre alunos

---

## Relações entre componentes

```mermaid
classDiagram
    class SandboxController {
        -sandboxSqlService: SandboxSqlService
        +testar(req, res)
        +enviar(req, res)
        +executarLivre(req, res)
        +limparLivre(req, res)
    }
    
    class SandboxSqlService {
        -provisioningRepository
        -executionRepository
        -submissaoRepository
        -acessoExercicio
        -resultadoRepository
        +testar(usuarioId, exercicioId, sql)
        +enviar(usuarioId, exercicioId, sql)
        +executarLivre(usuarioId, sql)
        +limparLivre(usuarioId)
    }
    
    class SandboxProvisioningRepository {
        <<interface>>
        +garantirSchema(schemaName, usuarioId, sqlSetup)
        +garantirSchemaLivre(schemaName, usuarioId)
        +dropSchema(schemaName)
    }
    
    class PgSandboxProvisioningRepository {
        -garantirRoleExecucao(client, usuarioId)
        +garantirSchema()
        +garantirSchemaLivre()
        +dropSchema()
    }
    
    class SandboxExecutionRepository {
        <<interface>>
        +executar(schemaName, usuarioId, sql, timeoutMs)
        +explain(schemaName, usuarioId, sql, timeoutMs)
    }
    
    class PgSandboxExecutionRepository {
        +executar()
        +explain()
    }
    
    class AcessoExercicioService {
        +exigirTeste(usuarioId, exercicioId)
        +exigirEntrega(usuarioId, exercicioId)
        +consumirLiberacao(usuarioId, exercicioId)
    }
    
    SandboxController --> SandboxSqlService
    SandboxSqlService --> SandboxProvisioningRepository
    SandboxSqlService --> SandboxExecutionRepository
    SandboxSqlService --> AcessoExercicioService
    PgSandboxProvisioningRepository ..|> SandboxProvisioningRepository
    PgSandboxExecutionRepository ..|> SandboxExecutionRepository
```

**Fluxo de dependências:**

- **Controller → Service**: o tratamento da requisição HTTP é delegado à lógica de negócio
- **Service → Controle de acesso**: toda operação valida os direitos de acesso do aluno
- **Service → Provisionamento**: garante que o schema e a role de execução existam antes de executar o SQL
- **Service → Execução**: executa o SQL do aluno num ambiente isolado
- **Service → Persistência**: registra as submissões e atualiza as notas automáticas

---

## Modelo de segurança

O sandbox implementa **defesa em profundidade**, com várias camadas de segurança:

```mermaid
graph TD
    subgraph "Camadas de segurança"
        A[1. Autenticação] --> B[2. Controle de acesso]
        B --> C[3. Isolamento de schema]
        C --> D[4. Execução baseada em roles]
        D --> E[5. Restrição de privilégios]
        E --> F[6. Imposição do protocolo]
        F --> G[7. Limites de tempo]
    end
    
    subgraph "Melhoria da Fase 12"
        H[role sandbox_login<br/>NOLOGIN globalmente]
        I[roles exec_&lt;usuario_id&gt;<br/>Uma por aluno]
        J[SET ROLE em tempo de execução<br/>Assume a identidade do aluno]
        K[GRANTs por schema<br/>O aluno só vê os próprios dados]
    end
    
    D --> H
    H --> I
    I --> J
    J --> K
    
    style A fill:#ffcdd2
    style D fill:#c8e6c9
    style H fill:#c8e6c9
    style I fill:#c8e6c9
```

### Camadas de segurança explicadas

1. **Autenticação**: validação do JWT no middleware `requireAuth` (veja [backend_auth](backend_auth.md))
2. **Controle de acesso**: o `AcessoExercicioService` valida:
   - O aluno está matriculado na turma do exercício (ou o exercício é público)
   - A turma não está encerrada para envios
   - Regras do modo prova (envio único, sem testes)
   - Restrições de prazo
3. **Isolamento de schema**: cada schema `sandbox_<exercicio_id>_<usuario_id>` é privado daquele par aluno-exercício
4. **Execução baseada em roles** (Fase 12):
   ```sql
   -- A conexão se autentica como sandbox_login (sem privilégios)
   SET ROLE "exec_<usuario_id>";  -- Assume a identidade do aluno
   SET search_path TO "sandbox_<exercicio_id>_<usuario_id>";
   ```
5. **Restrição de privilégios**:
   - **Sandboxes de exercício**: apenas `SELECT`, `INSERT`, `UPDATE`, `DELETE`
   - **Sandbox de estudo livre**: concede também `CREATE` (o aluno monta o próprio schema)
   - **Nunca concedidos**: `DROP`, `TRUNCATE` nas tabelas do exercício, acesso a outros schemas
6. **Imposição do protocolo**: o SQL do aluno é forçado pelo protocolo estendido do PostgreSQL (parâmetro `values: []`), para impedir a injeção de múltiplos comandos
7. **Limites de tempo**: `statement_timeout` imposto (configurável por `config.sandbox.statementTimeoutMs`)

### Hierarquia de roles (Fase 12)

```
postgres (superusuário)
  └─ role de provisionamento (CREATEROLE, cria schemas)
       └─ sandbox_login (NOLOGIN, sem privilégios diretos)
            └─ exec_<usuario_1> (NOLOGIN, concedida ao sandbox_login)
            └─ exec_<usuario_2>
            └─ exec_<usuario_N>
```

Cada role `exec_<usuario_id>`:
- É criada no primeiro acesso pelo `garantirRoleExecucao()`
- Tem `NOSUPERUSER NOCREATEDB NOCREATEROLE NOLOGIN`
- Recebe `USAGE` + GRANTs de CRUD apenas nos schemas do próprio aluno
- É uma role concedida como membro ao `sandbox_login`, o que permite o `SET ROLE`

**Por que isso importa**: antes da Fase 12, uma única role compartilhada `sandbox_exec` podia, em teoria, acessar qualquer schema. Agora, mesmo que um aluno tente `SET search_path TO "sandbox_other_exercise_other_student"`, o sistema de privilégios do PostgreSQL bloqueia a consulta: a role do aluno nunca recebeu acesso àquele schema.

---

## Fluxo de dados

### Fluxo de teste (execução sem correção)

```mermaid
sequenceDiagram
    participant C as Cliente
    participant Ctrl as SandboxController
    participant Svc as SandboxSqlService
    participant Acc as AcessoExercicioService
    participant Prov as ProvisioningRepo
    participant Exec as ExecutionRepo
    participant DB as Banco do sandbox
    
    C->>Ctrl: POST /exercicios/:id/sandbox/testar<br/>{sql: "SELECT ..."}
    Ctrl->>Svc: testar(usuarioId, exercicioId, sql)
    Svc->>Acc: exigirTeste(usuarioId, exercicioId)
    
    alt Questão de prova
        Acc-->>Svc: Lança ForbiddenError<br/>"Teste bloqueado no modo prova"
    end
    
    Acc-->>Svc: Devolve o exercício com sql_setup
    
    Svc->>Prov: garantirSchema(schemaName, usuarioId, sqlSetup)
    Prov->>DB: CREATE ROLE "exec_<usuario_id>" (se não existir)
    Prov->>DB: CREATE SCHEMA "sandbox_..." (se não existir)
    Prov->>DB: Executa o sql_setup (CREATE TABLE, INSERT)
    Prov->>DB: GRANT USAGE ON SCHEMA TO "exec_<usuario_id>"
    Prov->>DB: GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES
    Prov-->>Svc: Schema pronto
    
    Svc->>Exec: executar(schemaName, usuarioId, sql, timeout)
    Exec->>DB: SET ROLE "exec_<usuario_id>"
    Exec->>DB: SET search_path TO "sandbox_..."
    Exec->>DB: SET statement_timeout = 5000
    Exec->>DB: SELECT ... (com imposição do protocolo)
    
    alt Sucesso
        DB-->>Exec: {rows: [...]}
        Exec-->>Svc: {status: 'sucesso', rows: [...]}
    else Erro de sintaxe
        DB-->>Exec: Erro 42601 do PostgreSQL
        Exec-->>Svc: {status: 'erro_sintaxe', message: "..."}
    else Erro de execução
        DB-->>Exec: Erro 23505 do PostgreSQL
        Exec-->>Svc: {status: 'erro_execucao', message: "..."}
    end
    
    Svc-->>Ctrl: TestarSandboxResponseDto
    Ctrl-->>C: 200 OK {status, rows?, message?}
```

**Pontos-chave:**
- **Sem persistência**: as execuções de teste não são gravadas na `SubmissaoSql`
- **Sem correção**: os resultados não são comparados com o gabarito
- **Bloqueado no modo prova**: o `exigirTeste()` lança erro se o exercício tem `prova_id`

### Fluxo de envio (execução com correção)

```mermaid
sequenceDiagram
    participant C as Cliente
    participant Ctrl as SandboxController
    participant Svc as SandboxSqlService
    participant Acc as AcessoExercicioService
    participant Prov as ProvisioningRepo
    participant Exec as ExecutionRepo
    participant SubmRepo as SubmissaoRepo
    participant ResRepo as ResultadoRepo
    participant DB as Banco do sandbox
    participant MainDB as Banco principal
    
    C->>Ctrl: POST /exercicios/:id/sandbox/enviar<br/>{sql: "SELECT ..."}
    Ctrl->>Svc: enviar(usuarioId, exercicioId, sql)
    Svc->>Acc: exigirEntrega(usuarioId, exercicioId)
    
    alt Prazo vencido ou prova já enviada
        Acc-->>Svc: Lança ForbiddenError
    end
    
    Acc-->>Svc: Devolve o exercício
    
    Svc->>Prov: garantirSchema(...)
    Note over Prov: Mesmo provisionamento do fluxo de teste
    
    Svc->>Exec: executar(schemaName, usuarioId, studentSql, timeout)
    Note over Exec: Mede o tempo de execução
    DB-->>Exec: Resultado da consulta do aluno
    
    Svc->>Acc: consumirLiberacao(usuarioId, exercicioId)
    Note over Acc: Limpa o envio_liberado_em<br/>(envio extra de uma única vez consumido)
    
    Svc->>SubmRepo: proximoNumeroTentativa(usuarioId, exercicioId)
    SubmRepo->>MainDB: SELECT MAX(tentativa_numero) + 1
    MainDB-->>SubmRepo: Próximo número de tentativa
    
    alt A consulta do aluno falhou
        Svc->>SubmRepo: criarComLog({..., correta: null})
        SubmRepo->>MainDB: INSERT INTO submissao_sql
        Svc-->>Ctrl: {status: 'erro_...', correta: null, ...}
    else A consulta do aluno teve sucesso
        alt O exercício tem gabarito
            Svc->>Exec: executar(schemaName, usuarioId, exercise.sql_gabarito)
            DB-->>Exec: Resultado do gabarito
            Note over Svc: Compara os conjuntos de linhas<br/>(independente da ordem)
            Svc->>Svc: compararLinhas(studentRows, answerRows)
            Svc->>Svc: correta = (conjuntos coincidem)
        else Sem gabarito
            Svc->>Svc: correta = null
        end
        
        Svc->>Exec: explain(schemaName, usuarioId, studentSql)
        DB-->>Exec: Saída do EXPLAIN (FORMAT JSON)
        
        Svc->>SubmRepo: criarComLog({..., correta, explain_json})
        SubmRepo->>MainDB: INSERT INTO submissao_sql + log_execucao_sql
        
        alt Corrigida (correta não nula)
            Svc->>ResRepo: upsertAcertoAutomatico(usuarioId, exercicioId, correta)
            ResRepo->>MainDB: INSERT/UPDATE resultado_exercicio<br/>SET sql_correto = correta<br/>WHERE revisado = false
            Note over ResRepo: Nunca sobrescreve a revisão manual
        end
        
        Svc-->>Ctrl: {status: 'sucesso', rows, correta, plano, ...}
    end
    
    Ctrl-->>C: 200 OK EnviarSandboxResponseDto
```

**Lógica de correção:**
1. A consulta do aluno executa primeiro → mede o tempo, captura o resultado
2. Se o exercício tem `sql_gabarito`, executa-o no mesmo schema
3. Compara os conjuntos de resultado **independentemente da ordem**: normaliza as linhas como JSON, ordena e compara
4. Atualiza o `ResultadoExercicio.sql_correto` **somente se não houver revisão manual** (`revisado = false`)

---

## Endpoints da API

Todos os endpoints sob `/api/v1/exercicios/:id/sandbox`:

| Método | Endpoint | Autenticação | Descrição |
|--------|----------|------|-------------|
| `POST` | `/testar` | Obrigatória | Executa o SQL sem salvar nem corrigir |
| `POST` | `/enviar` | Obrigatória | Executa, corrige e salva a submissão |

Endpoints do estudo livre sob `/api/v1/sandbox/livre`:

| Método | Endpoint | Autenticação | Descrição |
|--------|----------|------|-------------|
| `POST` | `/executar` | Obrigatória | Executa o SQL no schema pessoal do aluno |
| `DELETE` | `/` | Obrigatória | Derruba e recria o schema pessoal |

### DTOs de requisição e resposta

**Requisição de teste:**
```typescript
interface TestarSandboxBodyDto {
  sql: string; // comprimento mínimo 1
}
```

**Resposta de teste:**
```typescript
interface TestarSandboxResponseDto {
  status: 'sucesso' | 'erro_sintaxe' | 'erro_execucao';
  rows?: Record<string, unknown>[]; // Presente se status === 'sucesso'
  message?: string; // Presente se status !== 'sucesso'
}
```

**Resposta de envio:**
```typescript
interface EnviarSandboxResponseDto extends TestarSandboxResponseDto {
  correta: boolean | null; // null se não há gabarito
  submissaoId: string;
  tentativaNumero: number;
  plano: unknown; // Saída do EXPLAIN (FORMAT JSON), null em caso de erro
}
```

---

## Componentes principais

### 1. SandboxController

**Localização:** `ide-web-backend/src/controllers/SandboxController.ts`

**Responsabilidades:**
- Tratamento de requisição e resposta HTTP
- Validação de entrada por schemas Zod
- Verificação de autenticação (`req.usuario`)
- Delegação ao `SandboxSqlService`

**Métodos principais:**
- `testar(req, res)`: execução de SQL sem persistência
- `enviar(req, res)`: envio com correção
- `executarLivre(req, res)`: execução no estudo livre
- `limparLivre(req, res)`: reinício do schema do estudo livre (204 No Content)

### 2. SandboxSqlService

**Localização:** `ide-web-backend/src/services/SandboxSqlService.ts`

**Responsabilidades:**
- Orquestra o provisionamento, a execução, a correção e a persistência
- Implementa o algoritmo de correção automática
- Gerencia o ciclo de vida do schema (criado sob demanda, derrubado na finalização)

**Dependências:**
- `SandboxProvisioningRepository`: criação de schemas e roles
- `SandboxExecutionRepository`: execução de SQL e EXPLAIN
- `SubmissaoSqlRepository`: salvar tentativas (veja [backend_resultado](backend_resultado.md))
- `ResultadoExercicioRepository`: atualizar as notas automáticas
- `AcessoExercicioService`: controle de acesso (veja [backend_exercicios](backend_exercicios.md))

**Métodos principais:**

```typescript
async testar(usuarioId: string, exercicioId: string, sql: string): Promise<TestarSandboxResponseDto>
```
- Valida o acesso por meio do `exigirTeste()` (bloqueia questões de prova)
- Provisiona o schema com a preparação do exercício
- Executa o SQL do aluno
- Devolve o resultado **sem** persistir

```typescript
async enviar(usuarioId: string, exercicioId: string, sql: string): Promise<EnviarSandboxResponseDto>
```
- Valida o acesso por meio do `exigirEntrega()` (verifica prazos, modo prova, encerramento da turma)
- **Consome a liberação** (`envio_liberado_em`) imediatamente, mesmo se a consulta falhar
- Executa o SQL do aluno e mede o tempo
- Se o exercício tem gabarito: executa-o e compara os resultados
- Gera o plano EXPLAIN
- Salva a submissão com o log
- Atualiza o `ResultadoExercicio.sql_correto` se foi corrigida e não houver revisão manual

```typescript
async executarLivre(usuarioId: string, sql: string): Promise<TestarSandboxResponseDto>
```
- Sem contexto de exercício, sem verificação de matrícula
- Opera no schema `sandbox_livre_<usuario_id>`
- **Concede o privilégio CREATE** (exclusivo do estudo livre)
- Sem registro de submissão

```typescript
async limparLivre(usuarioId: string): Promise<void>
```
- Derruba e recria o schema do estudo livre
- Reinício iniciado pelo aluno

**Algoritmo de correção:**

```typescript
function compararLinhas(
  alunoLinhas: Record<string, unknown>[], 
  gabaritoLinhas: Record<string, unknown>[]
): boolean {
  // 1. Rejeita se as contagens de linhas diferem
  if (alunoLinhas.length !== gabaritoLinhas.length) return false;
  
  // 2. Normaliza cada linha: ordena as chaves, serializa como JSON
  const normalizarLinha = (linha) => 
    JSON.stringify(Object.keys(linha).sort().map(k => [k, linha[k]]));
  
  // 3. Ordena as linhas normalizadas
  const alunoNormalizado = alunoLinhas.map(normalizarLinha).sort();
  const gabaritoNormalizado = gabaritoLinhas.map(normalizarLinha).sort();
  
  // 4. Compara elemento a elemento
  return alunoNormalizado.every((linha, i) => linha === gabaritoNormalizado[i]);
}
```

**Propriedades:**
- Independe da ordem das linhas (ordena antes de comparar)
- Independe da ordem das colunas (ordena as chaves dentro de cada linha)
- Sensível a tipos (a serialização JSON preserva os tipos)
- Seguro com nulos

### 3. SandboxProvisioningRepository

**Localização:** `ide-web-backend/src/repositories/sandbox/SandboxProvisioningRepository.ts`

**Implementação:** `PgSandboxProvisioningRepository`

**Responsabilidades:**
- Criar e gerenciar schemas e roles de execução
- Executar os scripts de preparação dos exercícios (`sql_setup`)
- Conceder privilégios às roles de execução

**Métodos principais:**

```typescript
async garantirSchema(schemaName: string, usuarioId: string, sqlSetup: string | null): Promise<void>
```
1. Cria a role `exec_<usuario_id>` se necessário (via `garantirRoleExecucao()`)
2. Cria o schema se ele não existir
3. Se o schema é novo e há `sqlSetup`: executa o script de preparação (aqui, vários comandos são permitidos)
4. Concede `USAGE ON SCHEMA` e `SELECT, INSERT, UPDATE, DELETE ON ALL TABLES` à role de execução
5. **GRANTs idempotentes**: sempre executam, corrigindo schemas criados antes da Fase 12

```typescript
async garantirSchemaLivre(schemaName: string, usuarioId: string): Promise<void>
```
- Semelhante ao `garantirSchema()`, mas concede **`USAGE, CREATE ON SCHEMA`**
- Sem `sql_setup` (o aluno monta as próprias tabelas)

```typescript
async dropSchema(schemaName: string): Promise<void>
```
- `DROP SCHEMA IF EXISTS ... CASCADE`
- Chamado quando o exercício é finalizado ou o schema do estudo livre é limpo

**Auxiliar privado:**

```typescript
private async garantirRoleExecucao(client: Client, usuarioId: string): Promise<string>
```
- Cria a role `exec_<usuario_id>` com `NOSUPERUSER NOCREATEDB NOCREATEROLE NOLOGIN`
- Concede a role ao `sandbox_login` (habilita o `SET ROLE`)
- Devolve o nome da role para os GRANTs seguintes

### 4. SandboxExecutionRepository

**Localização:** `ide-web-backend/src/repositories/sandbox/SandboxExecutionRepository.ts`

**Implementação:** `PgSandboxExecutionRepository`

**Responsabilidades:**
- Executar o SQL do aluno com imposição do protocolo
- Classificar os erros como de sintaxe ou de execução
- Traduzir os erros do PostgreSQL para o português
- Gerar os planos EXPLAIN

**Métodos principais:**

```typescript
async executar(schemaName: string, usuarioId: string, sql: string, timeoutMs: number): Promise<SandboxExecucaoResultado>
```
1. Conecta pela conexão de execução (`SANDBOX_EXEC_DATABASE_URL`)
2. `SET ROLE "exec_<usuario_id>"` — assume a identidade do aluno
3. `SET search_path TO "<schemaName>"`
4. `SET statement_timeout = <timeoutMs>`
5. Executa o SQL pelo **protocolo estendido** (`{text: sql, values: []}`)
   - O protocolo de rede do PostgreSQL restringe o protocolo estendido a **um único comando**
   - Bloqueia a injeção `SELECT 1; DROP TABLE x`
6. Devolve `{status: 'sucesso', rows}` ou o DTO de erro

**Classificação de erros:**

```typescript
function classificarErro(error: unknown): SandboxExecucaoErro {
  const codigo = error?.code; // SQLSTATE do PostgreSQL
  const status = codigo?.startsWith('42') ? 'erro_sintaxe' : 'erro_execucao';
  return {status, message: traduzirMensagem(error, codigo)};
}
```

- **42xxx**: erros de sintaxe e de schema (`erro_sintaxe`)
- **23xxx, 22xxx, outros**: erros de execução e de restrição (`erro_execucao`)

**Tradução de erros:**

O módulo traduz os erros mais comuns do PostgreSQL para o português, nas mensagens voltadas ao aluno:

| SQLSTATE | Inglês (vindo do pg) | Português (o que o aluno vê) |
|----------|-------------------|---------------------------|
| 42601 | `syntax error at or near "x"` | `Erro de sintaxe na consulta perto de "x"` |
| 42P01 | `relation "x" does not exist` | `A tabela "x" não existe` |
| 42703 | `column "x" does not exist` | `A coluna "x" não existe` |
| 23505 | `duplicate key value violates...` | `Valor duplicado: já existe um registro...` |
| 23503 | `foreign key violation` | `Operação viola chave estrangeira...` |
| ... | | Veja o código para o mapa completo |

```typescript
async explain(schemaName: string, usuarioId: string, sql: string, timeoutMs: number): Promise<unknown>
```
- **Pré-condição**: o `sql` já foi validado pelo `executar()` (comando único)
- Executa `EXPLAIN (FORMAT JSON) <sql>` pelo protocolo simples (o EXPLAIN não aceita parâmetros)
- Devolve o plano em JSON interpretado, ou null

---

## Correção automática

**Quando executa:**
- Somente no `enviar()` (envio), nunca no `testar()` (teste)
- Somente se existe `exercise.sql_gabarito`
- Somente se a consulta do aluno teve sucesso

**Como funciona:**

```mermaid
graph LR
    A[SQL do aluno] -->|Executa| B[Conjunto de resultado do aluno]
    C[sql_gabarito do exercício] -->|Executa no mesmo schema| D[Conjunto de resultado do gabarito]
    B --> E[Normaliza e ordena]
    D --> F[Normaliza e ordena]
    E --> G{Conjuntos de linhas iguais?}
    F --> G
    G -->|Sim| H[correta = true]
    G -->|Não| I[correta = false]
    H --> J[Atualiza resultado_exercicio<br/>SE revisado = false]
    I --> J
```

**Algoritmo de comparação de linhas:**

1. **Verificação de contagem**: rejeita imediatamente se as contagens de linhas diferem
2. **Normalização por linha**:
   - Extrai os nomes das colunas, em ordem alfabética
   - Monta pares `[chave, valor]` na ordem ordenada
   - Serializa em uma string JSON
3. **Ordenação do conjunto**: ordena todas as strings de linhas normalizadas
4. **Comparação elemento a elemento**: verifica se os arrays ordenados coincidem

**Exemplo:**

```javascript
// Resultado do aluno (colunas fora de ordem, linhas embaralhadas)
[
  {nome: "Alice", id: 2},
  {id: 1, nome: "Bob"}
]

// Gabarito
[
  {id: 1, nome: "Bob"},
  {id: 2, nome: "Alice"}
]

// Depois da normalização e da ordenação: COINCIDEM ✓
```

**Persistência:**

```typescript
await resultadoRepository.upsertAcertoAutomatico(usuarioId, exercicioId, correta);
```

- Atualiza o `ResultadoExercicio.sql_correto`
- **Nunca sobrescreve a revisão manual**: `WHERE revisado = false`
- Se o professor já corrigiu manualmente, o resultado automático é descartado

Veja [backend_resultado](backend_resultado.md) para o fluxo de correção completo.

---

## Modo de estudo livre

**Finalidade:** permitir que os alunos pratiquem SQL sem se matricular numa turma.

**Principais diferenças em relação ao modo exercício:**

| Aspecto | Modo exercício | Modo estudo livre |
|--------|---------------|-----------------|
| Nome do schema | `sandbox_<exercicio_id>_<usuario_id>` | `sandbox_livre_<usuario_id>` |
| Script de preparação | Do `Exercicio.sql_setup` | Nenhum (schema vazio) |
| Privilégios | SELECT, INSERT, UPDATE, DELETE | + **CREATE** |
| Controle de acesso | Verificações de matrícula e estado da turma | Apenas usuário autenticado |
| Persistência | Submissões salvas na `SubmissaoSql` | Sem persistência |
| Correção | Automática (se há gabarito) + manual | Nenhuma |

**Endpoints:**

```typescript
// Executa o SQL (idempotente, sem efeitos colaterais no ciclo de vida do schema)
POST /api/v1/sandbox/livre/executar
{sql: "CREATE TABLE usuarios (id INT, nome TEXT); INSERT INTO usuarios VALUES (1, 'Alice');"}
→ {status: 'sucesso', rows: [...]}

// Reinicia o schema (derruba + recria)
DELETE /api/v1/sandbox/livre
→ 204 No Content
```

**Integração com o frontend:**

Os alunos podem:
1. Projetar modelos de dados no editor de modelagem (veja [frontend_modelagem](frontend_modelagem.md))
2. Gerar o DDL em SQL a partir do modelo lógico
3. Clicar em "Usar no meu banco" → envia o DDL para `/sandbox/livre/executar`
4. Praticar consultas no próprio schema

**Armazenamento:** cada schema de estudo livre está ligado ao `usuario_id` e persiste entre sessões até ser limpo explicitamente.

---

## Tratamento de erros

### Tipos de erro

```typescript
// Do SandboxExecutionRepository
type SandboxExecucaoResultado = 
  | {status: 'sucesso', rows: Record<string, unknown>[]}
  | {status: 'erro_sintaxe', message: string}
  | {status: 'erro_execucao', message: string};
```

### Erros personalizados (lançados a montante)

- `SandboxIndisponivelError`: falha de conexão com o banco (veja [backend_errors](backend_errors.md))
- `ForbiddenError`: violações do controle de acesso (do `AcessoExercicioService`)
  - "O exercício é de uma turma encerrada"
  - "Questões de prova não podem ser testadas"
  - "O envio único já foi usado"
  - "Prazo vencido"
- `ValidationError`: entrada inválida (validação do Zod no controller)

### Mensagens de erro voltadas ao aluno

Todos os erros do PostgreSQL são traduzidos para o português antes de chegar ao cliente:

**Erros de sintaxe (42xxx):**
- Indicação clara do que está errado
- Extrai da mensagem de erro o identificador problemático
- Exemplo: `Erro de sintaxe na consulta perto de "SELEC"` (erro de digitação em SELECT)

**Erros de execução:**
- Violações de restrição explicadas em termos do domínio
- Chave estrangeira: "verifique se o registro relacionado existe"
- Violação de unicidade: "já existe um registro com esse valor"
- Not null: "a coluna X não pode receber valor nulo"

**Degradação suave:**
- Códigos de erro desconhecidos: `"Erro ao executar a consulta (código 22012)"`
- Sem código: `"Erro ao executar a consulta"`

Veja o mapa `TRADUCOES_POR_CODIGO` em `SandboxExecutionRepository.ts`.

---

## Configuração e instalação

### Variáveis de ambiente

**Obrigatórias em todos os ambientes:**

```bash
# Conexão de provisionamento (cria schemas/roles)
SANDBOX_DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Conexão de execução (executa o SQL do aluno)
SANDBOX_EXEC_DATABASE_URL=postgresql://sandbox_login:pass@host:5432/dbname

# Tempo limite de execução por consulta (milissegundos)
SANDBOX_STATEMENT_TIMEOUT_MS=5000
```

**Requisitos principais:**
- **Projeto Supabase separado** do banco principal (veja o CLAUDE.md)
- O usuário de provisionamento precisa do privilégio **CREATEROLE**
- A role `sandbox_login` precisa existir (criada pelo script de instalação)

### Instalação manual (produção)

Num projeto Supabase novo, para os sandboxes:

```sql
-- Cria a role de autenticação das conexões de execução
CREATE ROLE sandbox_login WITH 
  LOGIN 
  PASSWORD '<secure_password>'
  NOSUPERUSER 
  NOCREATEDB 
  NOCREATEROLE;
```

Defina o `SANDBOX_EXEC_DATABASE_URL` com as credenciais dessa role.

### Instalação automatizada (desenvolvimento)

**Docker Compose:** o serviço `db_sandbox` executa automaticamente o `scripts/sandbox-init.sh` na primeira inicialização:

```yaml
# docker-compose.yml
db_sandbox:
  image: postgres:16-alpine
  volumes:
    - ./ide-web-backend/scripts/sandbox-init.sh:/docker-entrypoint-initdb.d/init.sh
    - db_sandbox_data:/var/lib/postgresql/data
```

**Script:** `ide-web-backend/scripts/sandbox-init.sh`
- Verifica se o `sandbox_login` existe
- Cria-o se estiver ausente
- **Executa apenas uma vez** (o volume `db_sandbox_data` precisa estar vazio)

**Gatilho de reconstrução:** se estiver atualizando de uma base de código anterior à Fase 12:

```bash
# Força a nova execução do script
docker compose down -v db_sandbox
docker compose up db_sandbox
```

### Objeto de configuração

**Localização:** `ide-web-backend/src/config/index.ts`

```typescript
export const config = {
  sandbox: {
    statementTimeoutMs: parseInt(process.env.SANDBOX_STATEMENT_TIMEOUT_MS ?? '5000', 10),
  },
  // ...
};
```

Referenciado no `SandboxSqlService` para a imposição do tempo limite.

---

## Evolução e decisões de projeto

### Fase 2: implementação inicial
**Decisão:** `docs/decisions/fase2-sandbox-sql-diagrama-mer.md`

- Banco Supabase separado para os sandboxes
- Isolamento com um schema por exercício por aluno
- Role compartilhada `sandbox_exec` (substituída na Fase 12)
- Privilégios básicos de CRUD

### Fase 8: modo de estudo livre
**Decisão:** `docs/decisions/fase8-conta-do-aluno-matricula-estudo-livre.md`

- Acrescentados os schemas `sandbox_livre_<usuario_id>`
- Concedido o privilégio CREATE (exclusivo do estudo livre)
- Habilitada a geração de DDL a partir do editor de modelagem
- Sem persistência das consultas (uso exploratório)

### Fase 12: roles de execução por usuário (reforço de segurança)
**Decisão:** `docs/decisions/fase12-sql-studio-bd2.md`

**Problema:** uma única role compartilhada `sandbox_exec` podia, em teoria, acessar qualquer schema se o `search_path` fosse manipulado.

**Solução:**
- **Uma role por usuário**: `exec_<usuario_id>`, com GRANTs individuais
- **Modelo de pertencimento**: o `sandbox_login` recebe pertencimento a todas as roles de execução
- **Assunção em tempo de execução**: `SET ROLE "exec_<usuario_id>"` no momento da consulta
- **Isolamento de privilégios**: a role do aluno só tem acesso aos próprios schemas

**Caminho de migração:**
- Os schemas existentes recebem GRANTs de forma idempotente no `garantirSchema()`
- Não exige indisponibilidade
- Os schemas novos recebem roles por usuário desde a criação

**Pendente (planejado):**
- Parser de SQL (`libpg-query`) para lista branca de comandos
- Suporte a scripts com vários comandos (funções, procedures)
- Modo prova com sondas de verificação
- Sandboxes efêmeros (pausar/retomar por reexecução do script)

Veja o documento de decisão para o roteiro completo.

---

## Módulos relacionados

### Dependências diretas

- **[backend_exercicios](backend_exercicios.md)**: dados do exercício, `sql_setup`, `sql_gabarito`
  - `ExercicioRepository`: buscar os detalhes do exercício
  - `AcessoExercicioService`: controle de acesso (matrícula, prazos, modo prova)
- **[backend_resultado](backend_resultado.md)**: persistência das submissões e correção
  - `SubmissaoSqlRepository`: salvar as tentativas com os logs de execução
  - `ResultadoExercicioRepository`: atualizar as notas automáticas (`sql_correto`)
- **[backend_auth](backend_auth.md)**: autenticação de usuários
  - O middleware `requireAuth` fornece o `req.usuario.id`
  - Validação do JWT

### Dependências indiretas

- **[backend_turmas](backend_turmas.md)**: validação de matrícula (via `AcessoExercicioService`)
- **[backend_provas](backend_provas.md)**: regras do modo prova (envio único, sem testes)

### Consumido por

- **[frontend_exercicios](frontend_exercicios.md)**: interface do editor de SQL
  - Envia as consultas do aluno para `/sandbox/testar` e `/sandbox/enviar`
  - Mostra resultados, erros e planos EXPLAIN
- **[frontend_modelagem](frontend_modelagem.md)**: editor de modelagem
  - Gera o SQL a partir do modelo lógico
  - Envia para `/sandbox/livre/executar` no estudo livre
- **[backend_pacote](backend_pacote.md)**: geração de PDF
  - Lê a última submissão do `SubmissaoSqlRepository`

### Infraestrutura

- **[infrastructure](infrastructure.md)**: configuração do Docker Compose
  - Definição do serviço `db_sandbox`
  - Execução do script de inicialização
- **Schema do banco de dados**: veja o schema do Prisma (banco principal) e a criação dinâmica de schemas (banco do sandbox)

---

## Resumo

O módulo **backend_sandbox_sql** é o ambiente de execução reforçado em segurança para a prática de SQL dos alunos. Ele equilibra **segurança** (isolamento, restrição de privilégios, limites de tempo) com **usabilidade** (mensagens de erro em português, correção automática, experimentação livre). A arquitetura de roles por usuário da Fase 12 elimina o último caminho teórico de acesso entre alunos, deixando o sandbox pronto para produção com uso simultâneo em várias turmas.

**Principais conclusões:**
- ✅ **Arquitetura de dois bancos**: os dados da aplicação principal separados dos dados voláteis do sandbox
- ✅ **Isolamento por usuário**: cada aluno recebe a sua própria role de execução e os seus próprios schemas
- ✅ **Imposição do protocolo**: o protocolo estendido bloqueia a injeção de múltiplos comandos
- ✅ **Correção automática**: comparação de conjuntos de resultado independente da ordem
- ✅ **Suporte ao estudo livre**: privilégios de CREATE para o projeto de schemas conduzido pelo aluno
- ✅ **Tradução de erros**: erros do PostgreSQL convertidos em apoio à aprendizagem, em português

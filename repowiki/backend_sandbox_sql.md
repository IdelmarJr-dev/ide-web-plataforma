# Backend Sandbox SQL Module

## Overview

The **backend_sandbox_sql** module provides isolated SQL execution environments for students to practice database queries safely. Each student gets their own PostgreSQL schema per exercise, with automatic grading, execution plan analysis, and security boundaries that prevent interference between users. The module supports both guided exercises (with predefined schemas and answer keys) and free study mode (where students build their own schemas).

This is a **security-critical** module that handles untrusted SQL from students. As of Phase 12, it implements per-user execution roles with granular privilege control, ensuring students can only access their own sandboxes.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Component Relationships](#component-relationships)
3. [Security Model](#security-model)
4. [Data Flow](#data-flow)
5. [API Endpoints](#api-endpoints)
6. [Core Components](#core-components)
7. [Automatic Grading](#automatic-grading)
8. [Free Study Mode](#free-study-mode)
9. [Error Handling](#error-handling)
10. [Configuration & Setup](#configuration--setup)
11. [Evolution & Design Decisions](#evolution--design-decisions)
12. [Related Modules](#related-modules)

---

## Architecture

```mermaid
graph TB
    subgraph "HTTP Layer"
        SC[SandboxController]
    end
    
    subgraph "Business Logic"
        SSS[SandboxSqlService]
        AES[AcessoExercicioService]
    end
    
    subgraph "Data Access Layer"
        SPR[SandboxProvisioningRepository]
        SER[SandboxExecutionRepository]
        SSR[SubmissaoSqlRepository]
        RER[ResultadoExercicioRepository]
    end
    
    subgraph "External Systems"
        DB_MAIN[(Main DB<br/>Supabase)]
        DB_SANDBOX[(Sandbox DB<br/>Separate Supabase)]
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

**Key Architectural Decisions:**

1. **Separate Database**: Sandbox executes in a dedicated Supabase project, isolated from the main application database
2. **Two-Connection Model**: 
   - **Provisioning connection** (`SANDBOX_DATABASE_URL`): Has `CREATEROLE` privilege, creates/drops schemas and roles
   - **Execution connection** (`SANDBOX_EXEC_DATABASE_URL`): Restricted, logs in as `sandbox_login` and assumes per-user roles
3. **Schema-per-Exercise**: Each student gets a dedicated schema `sandbox_<exercicio_id>_<usuario_id>`
4. **Role-per-User** (Phase 12): Each student has their own execution role `exec_<usuario_id>`, preventing cross-student access

---

## Component Relationships

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

**Dependency Flow:**

- **Controller → Service**: HTTP request handling delegated to business logic
- **Service → Access Control**: Every operation validates student access rights
- **Service → Provisioning**: Ensures schema and execution role exist before running SQL
- **Service → Execution**: Runs student SQL in isolated environment
- **Service → Persistence**: Records submissions and updates automatic grades

---

## Security Model

The sandbox implements **defense in depth** with multiple security layers:

```mermaid
graph TD
    subgraph "Security Layers"
        A[1. Authentication] --> B[2. Access Control]
        B --> C[3. Schema Isolation]
        C --> D[4. Role-Based Execution]
        D --> E[5. Privilege Restriction]
        E --> F[6. Protocol Enforcement]
        F --> G[7. Timeout Limits]
    end
    
    subgraph "Phase 12 Enhancement"
        H[sandbox_login role<br/>NOLOGIN globally]
        I[exec_&lt;usuario_id&gt; roles<br/>One per student]
        J[SET ROLE at runtime<br/>Assume student identity]
        K[GRANTs per schema<br/>Student sees only their data]
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

### Security Layers Explained

1. **Authentication**: JWT validation in `requireAuth` middleware (see [backend_auth](backend_auth.md))
2. **Access Control**: `AcessoExercicioService` validates:
   - Student is enrolled in the exercise's class (or exercise is public)
   - Class is not closed for submissions
   - Exam mode rules (single submission, no testing)
   - Deadline constraints
3. **Schema Isolation**: Each `sandbox_<exercicio_id>_<usuario_id>` schema is private to that student-exercise pair
4. **Role-Based Execution** (Phase 12):
   ```sql
   -- Connection authenticates as sandbox_login (no privileges)
   SET ROLE "exec_<usuario_id>";  -- Assume student's identity
   SET search_path TO "sandbox_<exercicio_id>_<usuario_id>";
   ```
5. **Privilege Restriction**:
   - **Exercise sandboxes**: `SELECT`, `INSERT`, `UPDATE`, `DELETE` only
   - **Free study sandbox**: Additionally grants `CREATE` (student builds own schema)
   - **Never granted**: `DROP`, `TRUNCATE` on exercise tables, access to other schemas
6. **Protocol Enforcement**: Student SQL forced through PostgreSQL extended protocol (`values: []` parameter) to prevent multi-statement injection
7. **Timeout Limits**: `statement_timeout` enforced (configurable via `config.sandbox.statementTimeoutMs`)

### Role Hierarchy (Phase 12)

```
postgres (superuser)
  └─ provisioning role (CREATEROLE, creates schemas)
       └─ sandbox_login (NOLOGIN, no direct privileges)
            └─ exec_<usuario_1> (NOLOGIN, GRANTed to sandbox_login)
            └─ exec_<usuario_2>
            └─ exec_<usuario_N>
```

Each `exec_<usuario_id>` role:
- Created on first access by `garantirRoleExecucao()`
- Has `NOSUPERUSER NOCREATEDB NOCREATEROLE NOLOGIN`
- Receives `USAGE` + CRUD GRANTs on the student's schemas only
- Is a member granted to `sandbox_login`, enabling `SET ROLE`

**Why this matters**: Before Phase 12, a single shared `sandbox_exec` role could theoretically access any schema. Now, even if a student tries `SET search_path TO "sandbox_other_exercise_other_student"`, the PostgreSQL privilege system blocks the query—the student's role was never granted access to that schema.

---

## Data Flow

### Test Flow (Non-Graded Execution)

```mermaid
sequenceDiagram
    participant C as Client
    participant Ctrl as SandboxController
    participant Svc as SandboxSqlService
    participant Acc as AcessoExercicioService
    participant Prov as ProvisioningRepo
    participant Exec as ExecutionRepo
    participant DB as Sandbox DB
    
    C->>Ctrl: POST /exercicios/:id/sandbox/testar<br/>{sql: "SELECT ..."}
    Ctrl->>Svc: testar(usuarioId, exercicioId, sql)
    Svc->>Acc: exigirTeste(usuarioId, exercicioId)
    
    alt Exam Question
        Acc-->>Svc: Throws ForbiddenError<br/>"Testing blocked in exam mode"
    end
    
    Acc-->>Svc: Returns exercise with sql_setup
    
    Svc->>Prov: garantirSchema(schemaName, usuarioId, sqlSetup)
    Prov->>DB: CREATE ROLE "exec_<usuario_id>" (if not exists)
    Prov->>DB: CREATE SCHEMA "sandbox_..." (if not exists)
    Prov->>DB: Execute sql_setup (CREATE TABLE, INSERT)
    Prov->>DB: GRANT USAGE ON SCHEMA TO "exec_<usuario_id>"
    Prov->>DB: GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES
    Prov-->>Svc: Schema ready
    
    Svc->>Exec: executar(schemaName, usuarioId, sql, timeout)
    Exec->>DB: SET ROLE "exec_<usuario_id>"
    Exec->>DB: SET search_path TO "sandbox_..."
    Exec->>DB: SET statement_timeout = 5000
    Exec->>DB: SELECT ... (with protocol enforcement)
    
    alt Success
        DB-->>Exec: {rows: [...]}
        Exec-->>Svc: {status: 'sucesso', rows: [...]}
    else Syntax Error
        DB-->>Exec: PostgreSQL error 42601
        Exec-->>Svc: {status: 'erro_sintaxe', message: "..."}
    else Runtime Error
        DB-->>Exec: PostgreSQL error 23505
        Exec-->>Svc: {status: 'erro_execucao', message: "..."}
    end
    
    Svc-->>Ctrl: TestarSandboxResponseDto
    Ctrl-->>C: 200 OK {status, rows?, message?}
```

**Key Points:**
- **No persistence**: Test executions are not saved to `SubmissaoSql`
- **No grading**: Results are not compared against answer key
- **Blocked in exam mode**: `exigirTeste()` throws if exercise has `prova_id` and student already submitted

### Submit Flow (Graded Execution)

```mermaid
sequenceDiagram
    participant C as Client
    participant Ctrl as SandboxController
    participant Svc as SandboxSqlService
    participant Acc as AcessoExercicioService
    participant Prov as ProvisioningRepo
    participant Exec as ExecutionRepo
    participant SubmRepo as SubmissaoRepo
    participant ResRepo as ResultadoRepo
    participant DB as Sandbox DB
    participant MainDB as Main DB
    
    C->>Ctrl: POST /exercicios/:id/sandbox/enviar<br/>{sql: "SELECT ..."}
    Ctrl->>Svc: enviar(usuarioId, exercicioId, sql)
    Svc->>Acc: exigirEntrega(usuarioId, exercicioId)
    
    alt Deadline Passed or Exam Submitted
        Acc-->>Svc: Throws ForbiddenError
    end
    
    Acc-->>Svc: Returns exercise
    
    Svc->>Prov: garantirSchema(...)
    Note over Prov: Same provisioning as test flow
    
    Svc->>Exec: executar(schemaName, usuarioId, studentSql, timeout)
    Note over Exec: Measure execution time
    DB-->>Exec: Student query result
    
    Svc->>Acc: consumirLiberacao(usuarioId, exercicioId)
    Note over Acc: Clears envio_liberado_em<br/>(one-time extra submission consumed)
    
    Svc->>SubmRepo: proximoNumeroTentativa(usuarioId, exercicioId)
    SubmRepo->>MainDB: SELECT MAX(tentativa_numero) + 1
    MainDB-->>SubmRepo: Next attempt number
    
    alt Student Query Failed
        Svc->>SubmRepo: criarComLog({..., correta: null})
        SubmRepo->>MainDB: INSERT INTO submissao_sql
        Svc-->>Ctrl: {status: 'erro_...', correta: null, ...}
    else Student Query Succeeded
        alt Exercise Has Answer Key
            Svc->>Exec: executar(schemaName, usuarioId, exercise.sql_gabarito)
            DB-->>Exec: Answer key result
            Note over Svc: Compare row sets<br/>(order-independent)
            Svc->>Svc: compararLinhas(studentRows, answerRows)
            Svc->>Svc: correta = (sets match)
        else No Answer Key
            Svc->>Svc: correta = null
        end
        
        Svc->>Exec: explain(schemaName, usuarioId, studentSql)
        DB-->>Exec: EXPLAIN (FORMAT JSON) output
        
        Svc->>SubmRepo: criarComLog({..., correta, explain_json})
        SubmRepo->>MainDB: INSERT INTO submissao_sql + log_execucao_sql
        
        alt Graded (correta not null)
            Svc->>ResRepo: upsertAcertoAutomatico(usuarioId, exercicioId, correta)
            ResRepo->>MainDB: INSERT/UPDATE resultado_exercicio<br/>SET sql_correto = correta<br/>WHERE revisado = false
            Note over ResRepo: Never overwrites manual review
        end
        
        Svc-->>Ctrl: {status: 'sucesso', rows, correta, plano, ...}
    end
    
    Ctrl-->>C: 200 OK EnviarSandboxResponseDto
```

**Grading Logic:**
1. Student query executes first → measure time, capture result
2. If exercise has `sql_gabarito`, execute it in same schema
3. Compare result sets **order-independently**: normalize rows as JSON, sort, compare
4. Update `ResultadoExercicio.sql_correto` **only if not manually reviewed** (`revisado = false`)

---

## API Endpoints

All endpoints under `/api/v1/exercicios/:id/sandbox`:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/testar` | Required | Execute SQL without saving or grading |
| `POST` | `/enviar` | Required | Execute, grade, and save submission |

Free study endpoints under `/api/v1/sandbox/livre`:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/executar` | Required | Execute SQL in student's personal schema |
| `DELETE` | `/` | Required | Drop and recreate personal schema |

### Request/Response DTOs

**Test Request:**
```typescript
interface TestarSandboxBodyDto {
  sql: string; // min length 1
}
```

**Test Response:**
```typescript
interface TestarSandboxResponseDto {
  status: 'sucesso' | 'erro_sintaxe' | 'erro_execucao';
  rows?: Record<string, unknown>[]; // Present if status === 'sucesso'
  message?: string; // Present if status !== 'sucesso'
}
```

**Submit Response:**
```typescript
interface EnviarSandboxResponseDto extends TestarSandboxResponseDto {
  correta: boolean | null; // null if no answer key
  submissaoId: string;
  tentativaNumero: number;
  plano: unknown; // EXPLAIN (FORMAT JSON) output, null on error
}
```

---

## Core Components

### 1. SandboxController

**Location:** `ide-web-backend/src/controllers/SandboxController.ts`

**Responsibilities:**
- HTTP request/response handling
- Input validation via Zod schemas
- Authentication check (`req.usuario`)
- Delegates to `SandboxSqlService`

**Key Methods:**
- `testar(req, res)`: Non-persistent SQL execution
- `enviar(req, res)`: Graded submission
- `executarLivre(req, res)`: Free study execution
- `limparLivre(req, res)`: Reset free study schema (204 No Content)

### 2. SandboxSqlService

**Location:** `ide-web-backend/src/services/SandboxSqlService.ts`

**Responsibilities:**
- Orchestrates provisioning, execution, grading, and persistence
- Implements automatic grading algorithm
- Manages schema lifecycle (create on-demand, drop on finalize)

**Dependencies:**
- `SandboxProvisioningRepository`: Schema and role creation
- `SandboxExecutionRepository`: SQL execution and EXPLAIN
- `SubmissaoSqlRepository`: Save attempts (see [backend_resultado](backend_resultado.md))
- `ResultadoExercicioRepository`: Update automatic grades
- `AcessoExercicioService`: Access control (see [backend_exercicios](backend_exercicios.md))

**Key Methods:**

```typescript
async testar(usuarioId: string, exercicioId: string, sql: string): Promise<TestarSandboxResponseDto>
```
- Validates access via `exigirTeste()` (blocks exam questions)
- Provisions schema with exercise setup
- Executes student SQL
- Returns result **without** persisting

```typescript
async enviar(usuarioId: string, exercicioId: string, sql: string): Promise<EnviarSandboxResponseDto>
```
- Validates access via `exigirEntrega()` (checks deadlines, exam mode, class closure)
- **Consumes liberation** (`envio_liberado_em`) immediately, even if query fails
- Executes student SQL, measures time
- If exercise has answer key: executes it, compares results
- Generates EXPLAIN plan
- Saves submission with log
- Updates `ResultadoExercicio.sql_correto` if graded and not manually reviewed

```typescript
async executarLivre(usuarioId: string, sql: string): Promise<TestarSandboxResponseDto>
```
- No exercise context, no enrollment check
- Operates on `sandbox_livre_<usuario_id>` schema
- **Grants CREATE privilege** (unique to free study)
- No submission recording

```typescript
async limparLivre(usuarioId: string): Promise<void>
```
- Drops and recreates free study schema
- Student-initiated reset

**Grading Algorithm:**

```typescript
function compararLinhas(
  alunoLinhas: Record<string, unknown>[], 
  gabaritoLinhas: Record<string, unknown>[]
): boolean {
  // 1. Reject if row counts differ
  if (alunoLinhas.length !== gabaritoLinhas.length) return false;
  
  // 2. Normalize each row: sort keys, serialize as JSON
  const normalizarLinha = (linha) => 
    JSON.stringify(Object.keys(linha).sort().map(k => [k, linha[k]]));
  
  // 3. Sort normalized rows
  const alunoNormalizado = alunoLinhas.map(normalizarLinha).sort();
  const gabaritoNormalizado = gabaritoLinhas.map(normalizarLinha).sort();
  
  // 4. Compare element-wise
  return alunoNormalizado.every((linha, i) => linha === gabaritoNormalizado[i]);
}
```

**Properties:**
- Order-independent (sorts before comparing)
- Column-order independent (sorts keys within each row)
- Type-sensitive (JSON serialization preserves types)
- Null-safe

### 3. SandboxProvisioningRepository

**Location:** `ide-web-backend/src/repositories/sandbox/SandboxProvisioningRepository.ts`

**Implementation:** `PgSandboxProvisioningRepository`

**Responsibilities:**
- Create/manage schemas and execution roles
- Execute exercise setup scripts (`sql_setup`)
- Grant privileges to execution roles

**Key Methods:**

```typescript
async garantirSchema(schemaName: string, usuarioId: string, sqlSetup: string | null): Promise<void>
```
1. Creates `exec_<usuario_id>` role if needed (via `garantirRoleExecucao()`)
2. Creates schema if it doesn't exist
3. If new schema and `sqlSetup` provided: executes setup script (multi-statement OK here)
4. Grants `USAGE ON SCHEMA` and `SELECT, INSERT, UPDATE, DELETE ON ALL TABLES` to execution role
5. **Idempotent GRANTs**: Always runs, fixing schemas created before Phase 12

```typescript
async garantirSchemaLivre(schemaName: string, usuarioId: string): Promise<void>
```
- Similar to `garantirSchema()`, but grants **`USAGE, CREATE ON SCHEMA`**
- No `sql_setup` (student builds their own tables)

```typescript
async dropSchema(schemaName: string): Promise<void>
```
- `DROP SCHEMA IF EXISTS ... CASCADE`
- Called when exercise is finalized or free study schema is cleared

**Private Helper:**

```typescript
private async garantirRoleExecucao(client: Client, usuarioId: string): Promise<string>
```
- Creates role `exec_<usuario_id>` with `NOSUPERUSER NOCREATEDB NOCREATEROLE NOLOGIN`
- Grants role to `sandbox_login` (enables `SET ROLE`)
- Returns role name for subsequent GRANTs

### 4. SandboxExecutionRepository

**Location:** `ide-web-backend/src/repositories/sandbox/SandboxExecutionRepository.ts`

**Implementation:** `PgSandboxExecutionRepository`

**Responsibilities:**
- Execute student SQL with protocol enforcement
- Classify errors as syntax vs. runtime
- Translate PostgreSQL errors to Portuguese
- Generate EXPLAIN plans

**Key Methods:**

```typescript
async executar(schemaName: string, usuarioId: string, sql: string, timeoutMs: number): Promise<SandboxExecucaoResultado>
```
1. Connects via execution connection (`SANDBOX_EXEC_DATABASE_URL`)
2. `SET ROLE "exec_<usuario_id>"` — assumes student identity
3. `SET search_path TO "<schemaName>"`
4. `SET statement_timeout = <timeoutMs>`
5. Executes SQL via **extended protocol** (`{text: sql, values: []}`)
   - PostgreSQL wire protocol restricts extended protocol to **single statement**
   - Blocks `SELECT 1; DROP TABLE x` injection
6. Returns `{status: 'sucesso', rows}` or error DTO

**Error Classification:**

```typescript
function classificarErro(error: unknown): SandboxExecucaoErro {
  const codigo = error?.code; // PostgreSQL SQLSTATE
  const status = codigo?.startsWith('42') ? 'erro_sintaxe' : 'erro_execucao';
  return {status, message: traduzirMensagem(error, codigo)};
}
```

- **42xxx**: Syntax and schema errors (`erro_sintaxe`)
- **23xxx, 22xxx, others**: Runtime and constraint errors (`erro_execucao`)

**Error Translation:**

The module translates common PostgreSQL errors to Portuguese for student-facing messages:

| SQLSTATE | English (from pg) | Portuguese (student sees) |
|----------|-------------------|---------------------------|
| 42601 | `syntax error at or near "x"` | `Erro de sintaxe na consulta perto de "x"` |
| 42P01 | `relation "x" does not exist` | `A tabela "x" não existe` |
| 42703 | `column "x" does not exist` | `A coluna "x" não existe` |
| 23505 | `duplicate key value violates...` | `Valor duplicado: já existe um registro...` |
| 23503 | `foreign key violation` | `Operação viola chave estrangeira...` |
| ... | | See code for full map |

```typescript
async explain(schemaName: string, usuarioId: string, sql: string, timeoutMs: number): Promise<unknown>
```
- **Precondition**: `sql` already validated via `executar()` (single statement)
- Runs `EXPLAIN (FORMAT JSON) <sql>` via simple protocol (EXPLAIN doesn't accept parameters)
- Returns parsed JSON plan or null

---

## Automatic Grading

**When it runs:**
- Only in `enviar()` (submit), never in `testar()` (test)
- Only if `exercise.sql_gabarito` exists
- Only if student query succeeded

**How it works:**

```mermaid
graph LR
    A[Student SQL] -->|Execute| B[Student Result Set]
    C[Exercise sql_gabarito] -->|Execute in same schema| D[Answer Key Result Set]
    B --> E[Normalize & Sort]
    D --> F[Normalize & Sort]
    E --> G{Row sets equal?}
    F --> G
    G -->|Yes| H[correta = true]
    G -->|No| I[correta = false]
    H --> J[Update resultado_exercicio<br/>IF revisado = false]
    I --> J
```

**Row Comparison Algorithm:**

1. **Count check**: Reject immediately if row counts differ
2. **Per-row normalization**:
   - Extract column names, sort alphabetically
   - Build `[key, value]` pairs in sorted order
   - Serialize to JSON string
3. **Set-level sort**: Sort all normalized row strings
4. **Element-wise comparison**: Check sorted arrays match

**Example:**

```javascript
// Student result (columns out of order, rows shuffled)
[
  {nome: "Alice", id: 2},
  {id: 1, nome: "Bob"}
]

// Answer key
[
  {id: 1, nome: "Bob"},
  {id: 2, nome: "Alice"}
]

// After normalization and sorting: MATCH ✓
```

**Persistence:**

```typescript
await resultadoRepository.upsertAcertoAutomatico(usuarioId, exercicioId, correta);
```

- Updates `ResultadoExercicio.sql_correto`
- **Never overwrites manual review**: `WHERE revisado = false`
- If professor already graded manually, automatic result is discarded

See [backend_resultado](backend_resultado.md) for full grading workflow.

---

## Free Study Mode

**Purpose:** Allow students to practice SQL without enrolling in a class.

**Key Differences from Exercise Mode:**

| Aspect | Exercise Mode | Free Study Mode |
|--------|---------------|-----------------|
| Schema name | `sandbox_<exercicio_id>_<usuario_id>` | `sandbox_livre_<usuario_id>` |
| Setup script | From `Exercicio.sql_setup` | None (empty schema) |
| Privileges | SELECT, INSERT, UPDATE, DELETE | + **CREATE** |
| Access control | Enrollment + class status checks | Authenticated user only |
| Persistence | Submissions saved to `SubmissaoSql` | No persistence |
| Grading | Automatic (if answer key) + manual | None |

**Endpoints:**

```typescript
// Execute SQL (idempotent, no side effects on schema lifecycle)
POST /api/v1/sandbox/livre/executar
{sql: "CREATE TABLE usuarios (id INT, nome TEXT); INSERT INTO usuarios VALUES (1, 'Alice');"}
→ {status: 'sucesso', rows: [...]}

// Reset schema (drop + recreate)
DELETE /api/v1/sandbox/livre
→ 204 No Content
```

**Frontend Integration:**

Students can:
1. Design data models in the modeling editor (see [frontend_modelagem](frontend_modelagem.md))
2. Generate SQL DDL from logical model
3. Click "Use in My Database" → sends DDL to `/sandbox/livre/executar`
4. Practice queries on their own schema

**Storage:** Each free study schema is tied to `usuario_id`, persists across sessions until explicitly cleared.

---

## Error Handling

### Error Types

```typescript
// From SandboxExecutionRepository
type SandboxExecucaoResultado = 
  | {status: 'sucesso', rows: Record<string, unknown>[]}
  | {status: 'erro_sintaxe', message: string}
  | {status: 'erro_execucao', message: string};
```

### Custom Errors (thrown upstream)

- `SandboxIndisponivelError`: Database connection failure (see [backend_errors](backend_errors.md))
- `ForbiddenError`: Access control violations (from `AcessoExercicioService`)
  - "Exercise is from a closed class"
  - "Exam questions cannot be tested"
  - "Single submission already used"
  - "Deadline passed"
- `ValidationError`: Invalid input (Zod validation in controller)

### Student-Facing Error Messages

All PostgreSQL errors are translated to Portuguese before reaching the client:

**Syntax errors (42xxx):**
- Clear indication of what's wrong
- Extracts problematic identifier from error message
- Example: `Erro de sintaxe na consulta perto de "SELEC"` (typo in SELECT)

**Runtime errors:**
- Constraint violations explained in domain terms
- Foreign key: "verifique se o registro relacionado existe"
- Unique violation: "já existe um registro com esse valor"
- Not null: "a coluna X não pode receber valor nulo"

**Graceful degradation:**
- Unknown error codes: `"Erro ao executar a consulta (código 22012)"`
- No code: `"Erro ao executar a consulta"`

See `TRADUCOES_POR_CODIGO` map in `SandboxExecutionRepository.ts`.

---

## Configuration & Setup

### Environment Variables

**Required in all environments:**

```bash
# Provisioning connection (creates schemas/roles)
SANDBOX_DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Execution connection (runs student SQL)
SANDBOX_EXEC_DATABASE_URL=postgresql://sandbox_login:pass@host:5432/dbname

# Execution timeout per query (milliseconds)
SANDBOX_STATEMENT_TIMEOUT_MS=5000
```

**Key Requirements:**
- **Separate Supabase project** from main database (see CLAUDE.md)
- Provisioning user must have **CREATEROLE** privilege
- `sandbox_login` role must exist (created by setup script)

### Manual Setup (Production)

On a fresh Supabase project for sandboxes:

```sql
-- Create the authentication role for execution connections
CREATE ROLE sandbox_login WITH 
  LOGIN 
  PASSWORD '<secure_password>'
  NOSUPERUSER 
  NOCREATEDB 
  NOCREATEROLE;
```

Set `SANDBOX_EXEC_DATABASE_URL` to this role's credentials.

### Automated Setup (Development)

**Docker Compose:** The `db_sandbox` service auto-runs `scripts/sandbox-init.sh` on first start:

```yaml
# docker-compose.yml
db_sandbox:
  image: postgres:16-alpine
  volumes:
    - ./ide-web-backend/scripts/sandbox-init.sh:/docker-entrypoint-initdb.d/init.sh
    - db_sandbox_data:/var/lib/postgresql/data
```

**Script:** `ide-web-backend/scripts/sandbox-init.sh`
- Checks if `sandbox_login` exists
- Creates it if missing
- **Runs only once** (volume `db_sandbox_data` must be empty)

**Rebuild trigger:** If upgrading from pre-Phase 12 codebase:

```bash
# Force script re-execution
docker compose down -v db_sandbox
docker compose up db_sandbox
```

### Configuration Object

**Location:** `ide-web-backend/src/config/index.ts`

```typescript
export const config = {
  sandbox: {
    statementTimeoutMs: parseInt(process.env.SANDBOX_STATEMENT_TIMEOUT_MS ?? '5000', 10),
  },
  // ...
};
```

Referenced in `SandboxSqlService` for timeout enforcement.

---

## Evolution & Design Decisions

### Phase 2: Initial Implementation
**Decision:** `docs/decisions/fase2-sandbox-sql-diagrama-mer.md`

- Separate Supabase database for sandboxes
- Schema-per-exercise-per-student isolation
- Shared `sandbox_exec` role (replaced in Phase 12)
- Basic CRUD privileges

### Phase 8: Free Study Mode
**Decision:** `docs/decisions/fase8-conta-do-aluno-matricula-estudo-livre.md`

- Added `sandbox_livre_<usuario_id>` schemas
- Granted CREATE privilege (unique to free study)
- Enabled DDL generation from modeling editor
- No persistence of queries (exploratory use)

### Phase 12: Per-User Execution Roles (Security Hardening)
**Decision:** `docs/decisions/fase12-sql-studio-bd2.md`

**Problem:** Single shared `sandbox_exec` role could theoretically access any schema if `search_path` was manipulated.

**Solution:**
- **Role per user**: `exec_<usuario_id>` with individual GRANTs
- **Membership model**: `sandbox_login` is granted membership in all execution roles
- **Runtime assumption**: `SET ROLE "exec_<usuario_id>"` at query time
- **Privilege isolation**: Student's role only has access to their own schemas

**Migration path:**
- Existing schemas receive GRANTs idempotently in `garantirSchema()`
- No downtime required
- New schemas get per-user roles from creation

**Pending (planned):**
- SQL parser (`libpg-query`) for command whitelisting
- Multi-statement script support (functions, procedures)
- Exam mode with verification probes
- Ephemeral sandboxes (pause/resume via script replay)

See decision doc for full roadmap.

---

## Related Modules

### Direct Dependencies

- **[backend_exercicios](backend_exercicios.md)**: Exercise data, `sql_setup`, `sql_gabarito`
  - `ExercicioRepository`: Fetch exercise details
  - `AcessoExercicioService`: Access control (enrollment, deadlines, exam mode)
- **[backend_resultado](backend_resultado.md)**: Submission persistence and grading
  - `SubmissaoSqlRepository`: Save attempts with execution logs
  - `ResultadoExercicioRepository`: Update automatic grades (`sql_correto`)
- **[backend_auth](backend_auth.md)**: User authentication
  - `requireAuth` middleware provides `req.usuario.id`
  - JWT validation

### Indirect Dependencies

- **[backend_turmas](backend_turmas.md)**: Enrollment validation (via `AcessoExercicioService`)
- **[backend_provas](backend_provas.md)**: Exam mode rules (single submission, no testing)

### Consumed By

- **[frontend_exercicios](frontend_exercicios.md)**: SQL editor UI
  - Sends student queries to `/sandbox/testar` and `/sandbox/enviar`
  - Displays results, errors, EXPLAIN plans
- **[frontend_modelagem](frontend_modelagem.md)**: Modeling editor
  - Generates SQL from logical model
  - Sends to `/sandbox/livre/executar` for free study
- **[backend_pacote](backend_pacote.md)**: PDF generation
  - Reads last submission from `SubmissaoSqlRepository`

### Infrastructure

- **[infrastructure](infrastructure.md)**: Docker Compose setup
  - `db_sandbox` service definition
  - Initialization script execution
- **Database schema**: See Prisma schema (main DB) and dynamic schema creation (sandbox DB)

---

## Summary

The **backend_sandbox_sql** module is the security-hardened execution environment for student SQL practice. It balances **safety** (isolation, privilege restrictions, timeout limits) with **usability** (Portuguese error messages, automatic grading, free experimentation). The Phase 12 per-user role architecture eliminates the last theoretical cross-student access path, making the sandbox production-ready for concurrent multi-class usage.

**Key Takeaways:**
- ✅ **Two-database architecture**: Main app data separated from volatile sandbox data
- ✅ **Per-user isolation**: Each student gets their own execution role and schemas
- ✅ **Protocol enforcement**: Extended protocol blocks multi-statement injection
- ✅ **Automatic grading**: Order-independent result set comparison
- ✅ **Free study support**: CREATE privileges for student-driven schema design
- ✅ **Error translation**: PostgreSQL errors converted to Portuguese learning aids

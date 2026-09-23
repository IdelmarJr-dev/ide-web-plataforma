# Backend Resultado Module

## Overview

The **backend_resultado** module manages exercise results, grading, and feedback in the IDE Web system. It handles both **automatic grading** (SQL queries compared against reference solutions) and **manual review** (conceptual/logical data modeling and essay questions). The module implements a sophisticated grading workflow that supports exam mode constraints, grade liberation mechanisms, and hybrid automatic-manual evaluation.

This module serves as the bridge between student submissions ([backend_sandbox_sql](backend_sandbox_sql.md), [backend_modelagem](backend_modelagem.md)) and performance visualization ([backend_painel](backend_painel.md)), ensuring that all exercise attempts are properly evaluated, stored, and made available to both students and professors according to visibility rules.

---

## Core Responsibilities

### 1. **Result Management**
- Store and retrieve exercise results (`ResultadoExercicio`)
- Track submission attempts and their outcomes
- Maintain grading history with timestamps and reviewer information
- Support result visibility based on `gabarito_liberado` flag

### 2. **Automatic Grading**
- Receive SQL correctness verdicts from sandbox execution
- Record automatic grading in `sql_correto` field
- Preserve automatic results unless overridden by manual review
- Update results without triggering unnecessary re-evaluations

### 3. **Manual Review**
- Enable professors to grade data modeling diagrams (`mer_avaliacao`)
- Support essay question evaluation (`dissertativa_avaliacao`)
- Allow comprehensive scoring with `acertos`, `erros`, `pontuacao` (0.0-10.0)
- Lock automatic results when manual review is performed (`revisado` flag)

### 4. **Exam Mode Support**
- Enforce single-submission constraint for exam questions
- Track exercise finalization (`finalizado_em`)
- Provide grade liberation mechanism (`envio_liberado_em`)
- Allow professors to grant extra submission attempts after errors

### 5. **Answer Template Management**
- Professors can release answer keys (`gabarito_liberado`)
- Students view their graded results only when answers are released
- Answer key release is reversible (can be hidden again)

---

## Architecture

### Component Structure

```mermaid
graph TB
    subgraph "HTTP Layer"
        RC[ResultadoController]
    end
    
    subgraph "Business Logic Layer"
        RES[ResultadoExercicioService]
    end
    
    subgraph "Data Access Layer"
        RER[ResultadoExercicioRepository]
        SSR[SubmissaoSqlRepository]
        ER[ExercicioRepository]
        TR[TurmaRepository]
        MR[MatriculaRepository]
        RDR[RespostaDissertativaRepository]
    end
    
    subgraph "Database"
        DB[(PostgreSQL/Supabase)]
    end
    
    RC -->|delegates| RES
    RES -->|manages results| RER
    RES -->|reads submissions| SSR
    RES -->|validates ownership| ER
    RES -->|checks permissions| TR
    RES -->|verifies enrollment| MR
    RES -->|reads essay answers| RDR
    
    RER -->|CRUD operations| DB
    SSR -->|read attempts| DB
    
    classDef controller fill:#e1f5ff,stroke:#0288d1
    classDef service fill:#fff9c4,stroke:#f57f17
    classDef repository fill:#c8e6c9,stroke:#388e3c
    classDef database fill:#ffccbc,stroke:#d84315
    
    class RC controller
    class RES service
    class RER,SSR,ER,TR,MR,RDR repository
    class DB database
```

### Layer Responsibilities

**ResultadoController** (HTTP Layer)
- Exposes REST endpoints for result operations
- Validates request parameters and authentication
- Transforms service responses to DTOs
- Handles HTTP status codes and error responses

**ResultadoExercicioService** (Business Logic Layer)
- Enforces authorization rules (professor owns exercise, student is enrolled)
- Coordinates between multiple repositories
- Implements grading business logic (automatic vs. manual precedence)
- Manages grade liberation workflow

**ResultadoExercicioRepository** (Data Access Layer)
- Performs CRUD operations on `ResultadoExercicio` table
- Implements upsert logic for automatic and manual grading
- Handles envio_liberado_em valve mechanism
- Enforces `revisado` flag protection

**SubmissaoSqlRepository** (Data Access Layer)
- Tracks all SQL submission attempts
- Maintains attempt numbering (`tentativa_numero`)
- Stores execution metadata (EXPLAIN plans, execution time)
- Provides summary views for reporting

---

## Data Model

```mermaid
erDiagram
    ResultadoExercicio ||--o{ SubmissaoSql : "tracks attempts"
    ResultadoExercicio }o--|| Exercicio : "evaluates"
    ResultadoExercicio }o--|| Usuario : "belongs to"
    Usuario ||--o{ MatriculaTurma : "enrolled in"
    Exercicio }o--|| Turma : "assigned to"
    SubmissaoSql }o--|| LogExecucaoSql : "has execution plan"
    
    ResultadoExercicio {
        uuid id PK
        uuid usuario_id FK
        uuid exercicio_id FK
        boolean sql_correto "automatic verdict"
        decimal mer_avaliacao "manual MER grade"
        decimal dissertativa_avaliacao "manual essay grade"
        int acertos "correct items count"
        int erros "error items count"
        decimal pontuacao "final score 0-10"
        boolean revisado "locked by manual review"
        timestamp revisado_em "when reviewed"
        uuid revisado_por FK "reviewer user_id"
        timestamp finalizado_em "when student finalized"
        timestamp envio_liberado_em "extra submission valve"
    }
    
    SubmissaoSql {
        uuid id PK
        uuid exercicio_id FK
        uuid usuario_id FK
        text query_sql "submitted query"
        enum resultado_status "SUCESSO/ERRO_SINTAXE/etc"
        int linhas_retornadas
        int tempo_execucao_ms
        boolean correta "matches reference"
        int tentativa_numero "attempt sequence"
        timestamp criado_em
    }
    
    LogExecucaoSql {
        uuid id PK
        uuid submissao_id FK
        jsonb explain_json "PostgreSQL EXPLAIN output"
    }
```

### Key Fields

**sql_correto** - Automatic SQL grading result set by sandbox comparison. Frozen when `revisado = true`.

**revisado** - Flag indicating manual review has occurred. Once set, automatic grading no longer updates `sql_correto`.

**envio_liberado_em** - Valve timestamp allowing ONE extra submission, bypassing deadline and single-submission constraints. Consumed on use.

**finalizado_em** - Timestamp when student clicked "Finalize" (separate from "Download PDF" since Fase 8). Triggers sandbox cleanup.

**tentativa_numero** - Sequential attempt counter per student-exercise pair, starting at 1.

---

## Component Interactions

### Grading Workflow

```mermaid
sequenceDiagram
    participant Student
    participant SandboxController
    participant SandboxService
    participant ResultadoRepo
    participant SubmissaoRepo
    participant DB
    
    Student->>SandboxController: POST /sandbox/enviar
    SandboxController->>SandboxService: enviar(query, exercicioId)
    
    SandboxService->>SubmissaoRepo: proximoNumeroTentativa()
    SubmissaoRepo->>DB: COUNT submissions
    DB-->>SubmissaoRepo: count
    SubmissaoRepo-->>SandboxService: tentativa_numero
    
    SandboxService->>SandboxService: execute in sandbox
    SandboxService->>SandboxService: compare with gabarito
    
    SandboxService->>SubmissaoRepo: criarComLog({correta, explain_json})
    SubmissaoRepo->>DB: INSERT SubmissaoSql + LogExecucaoSql
    
    alt Exercise has gabarito_sql
        SandboxService->>ResultadoRepo: upsertAcertoAutomatico(correta)
        ResultadoRepo->>DB: SELECT revisado flag
        DB-->>ResultadoRepo: revisado status
        
        alt NOT revisado
            ResultadoRepo->>DB: UPSERT sql_correto
            Note over ResultadoRepo: Automatic result recorded
        else revisado = true
            Note over ResultadoRepo: Skip - manual review locked
        end
    end
    
    SandboxService-->>SandboxController: result + plano
    SandboxController-->>Student: 200 OK {correta, plano}
```

### Manual Review Workflow

```mermaid
sequenceDiagram
    participant Professor
    participant ResultadoController
    participant ResultadoService
    participant ExercicioRepo
    participant MatriculaRepo
    participant ResultadoRepo
    participant DB
    
    Professor->>ResultadoController: PATCH /exercicios/:id/alunos/:userId/resultado
    ResultadoController->>ResultadoService: revisar(professorId, exercicioId, userId, input)
    
    ResultadoService->>ExercicioRepo: findById(exercicioId)
    ExercicioRepo->>DB: SELECT Exercicio
    DB-->>ResultadoService: exercicio
    
    ResultadoService->>ResultadoService: validate professor owns turma
    
    ResultadoService->>MatriculaRepo: findByAlunoETurma(userId, turmaId)
    MatriculaRepo->>DB: SELECT MatriculaTurma
    DB-->>ResultadoService: matricula
    
    alt Student not enrolled
        ResultadoService-->>Professor: 403 Forbidden
    else Enrolled
        ResultadoService->>ResultadoRepo: upsertRevisao({pontuacao, mer_avaliacao, ...})
        ResultadoRepo->>DB: UPSERT ResultadoExercicio<br/>SET revisado=true, revisado_em=NOW()
        DB-->>ResultadoRepo: resultado
        ResultadoRepo-->>Professor: 200 OK resultado
    end
    
    Note over DB: revisado=true locks automatic grading
```

### Grade Liberation Mechanism

```mermaid
sequenceDiagram
    participant Professor
    participant ResultadoController
    participant ResultadoService
    participant ResultadoRepo
    participant DB
    
    rect rgb(255, 240, 240)
        Note over Professor: Scenario: Student failed exam<br/>due to syntax error
    end
    
    Professor->>ResultadoController: POST /exercicios/:id/alunos/:userId/liberar-envio
    ResultadoController->>ResultadoService: liberarEnvio(professorId, exercicioId, userId)
    
    ResultadoService->>ResultadoService: validate ownership & enrollment
    
    ResultadoService->>ResultadoRepo: liberarEnvio(userId, exercicioId)
    ResultadoRepo->>DB: UPSERT ResultadoExercicio<br/>SET envio_liberado_em = NOW()
    
    Note over DB: Creates record if student<br/>never started exercise
    
    DB-->>Professor: 200 OK {liberado: true}
    
    rect rgb(240, 255, 240)
        Note over Professor,DB: Student can now submit ONE more time,<br/>bypassing deadline and single-submission
    end
    
    participant Student
    participant AcessoExercicioService
    
    Student->>AcessoExercicioService: exigirEntrega()
    AcessoExercicioService->>DB: check envio_liberado_em
    
    alt envio_liberado_em IS NOT NULL
        AcessoExercicioService-->>Student: ✓ Submission allowed
        Student->>Student: submits query
        AcessoExercicioService->>DB: SET envio_liberado_em = NULL
        Note over DB: Valve consumed
    else Normal constraints
        AcessoExercicioService->>AcessoExercicioService: check deadline, single-submission
    end
```

---

## API Endpoints

### Professor Operations

#### Review Student Work
```http
PATCH /api/v1/exercicios/:exercicioId/alunos/:usuarioId/resultado
Authorization: Bearer <token>
Content-Type: application/json

{
  "sqlCorreto": true,           // optional, override automatic
  "merAvaliacao": 8.5,          // optional, 0.0-10.0
  "dissertativaAvaliacao": 7.0, // optional, 0.0-10.0
  "acertos": 12,                // optional, item count
  "erros": 3,                   // optional, item count
  "pontuacao": 8.0              // optional, final grade 0.0-10.0
}
```

**Response:** `ResultadoResponseDto`
- Sets `revisado = true`, locking automatic grading
- Records `revisado_em` timestamp and `revisado_por` (professor ID)
- Creates `ResultadoExercicio` if student never submitted

**Authorization:** Professor must own the turma; student must be enrolled.

---

#### Release Answer Key
```http
POST /api/v1/exercicios/:id/liberar-gabarito
Authorization: Bearer <token>
```

**Response:** `ExercicioProfessorResponseDto` with `gabarito_liberado = true`

Reversible with:
```http
POST /api/v1/exercicios/:id/ocultar-gabarito
```

---

#### Grant Extra Submission
```http
POST /api/v1/exercicios/:id/alunos/:usuarioId/liberar-envio
Authorization: Bearer <token>
```

**Response:** `{liberado: true}`

**Effect:** Sets `envio_liberado_em`, allowing ONE more submission regardless of:
- Deadline (exercicio.prazo)
- Single-submission constraint (prova_id)
- Turma closure status

See [backend_exercicios](backend_exercicios.md) `AcessoExercicioService.exigirEntrega()` for consumption logic.

---

#### Get Student's Answers
```http
GET /api/v1/exercicios/:exercicioId/alunos/:usuarioId/respostas
Authorization: Bearer <token>
```

**Response:**
```json
{
  "ultimaSubmissaoSql": {
    "query": "SELECT * FROM ...",
    "correta": true,
    "criadoEm": "2026-09-15T10:30:00Z"
  },
  "dissertativa": {
    "texto": "A normalização consiste em...",
    "atualizadoEm": "2026-09-15T10:25:00Z"
  }
}
```

**Purpose:** Shows what the student submitted before professor grades it (added in Fase 9 after usability testing revealed "grading in the dark").

**Note:** Data modeling answers are retrieved via separate endpoint in [backend_modelagem](backend_modelagem.md).

---

#### Get Student's Result
```http
GET /api/v1/exercicios/:exercicioId/alunos/:usuarioId/resultado
Authorization: Bearer <token>
```

**Response:** `ResultadoResponseDto | null`

Returns full result regardless of `gabarito_liberado` status.

---

### Student Operations

#### Get My Result
```http
GET /api/v1/exercicios/:id/meu-resultado
Authorization: Bearer <token>
```

**Response:** `ResultadoResponseDto | null`

**Visibility Rules:**
- Returns `null` if `gabarito_liberado = false`
- Returns `null` if `revisado = false` (not yet graded)
- Returns result only when **both** answer key is released AND work has been reviewed

**Rationale:** Students should only see finalized feedback, not partial automatic results.

---

## Business Logic

### Automatic vs. Manual Grading Precedence

```mermaid
flowchart TD
    Start([SQL Submission]) --> AutoCheck{Exercise has<br/>gabarito_sql?}
    
    AutoCheck -->|No| NoAuto[correta = null<br/>sql_correto unchanged]
    AutoCheck -->|Yes| Compare[Compare result sets]
    
    Compare --> AutoResult[correta = true/false]
    
    AutoResult --> CheckRevisado{ResultadoExercicio<br/>revisado?}
    
    CheckRevisado -->|true| Skip[Skip update<br/>Manual review locked]
    CheckRevisado -->|false| Update[UPSERT sql_correto]
    
    Update --> Done([Automatic grading recorded])
    Skip --> Done
    NoAuto --> Done
    
    subgraph "Manual Review (later)"
        Prof[Professor reviews] --> SetRevisado[SET revisado=true<br/>SET pontuacao, mer_avaliacao, etc.]
        SetRevisado --> Lock[Future automatic updates blocked]
    end
    
    Done -.->|Professor later reviews| Prof
    
    classDef decision fill:#fff9c4,stroke:#f57f17
    classDef process fill:#e1f5ff,stroke:#0288d1
    classDef manual fill:#ffccbc,stroke:#d84315
    
    class AutoCheck,CheckRevisado decision
    class Compare,AutoResult,Update process
    class Prof,SetRevisado,Lock manual
```

**Key Principle:** Manual review always wins. Once `revisado = true`, automatic grading stops updating `sql_correto`.

**Rationale:** Professor may disagree with automatic verdict (e.g., query is semantically correct but uses different approach than reference solution).

---

### Exam Mode Constraints

The `backend_resultado` module participates in exam mode enforcement through the `envio_liberado_em` valve, but constraint checking happens in [backend_exercicios](backend_exercicios.md) `AcessoExercicioService.exigirEntrega()`:

**Check Order:**
1. Turma encerrada? → Block
2. Deadline passed (exercicio.prazo)? → Block
3. Single-submission consumed (prova_id + existing submission)? → Block
4. **envio_liberado_em set?** → Allow ONE submission, then clear valve

**Grade Liberation Use Case:**
```
Student in exam → Makes syntax error → Loses their one submission → Query never executed
Professor reviews → Sees error → Clicks "Liberar novo envio" → Student gets second chance
Student resubmits → envio_liberado_em cleared → Back to normal constraints
```

See `docs/decisions/fase10-professor-prova-sessao.md` for design rationale.

---

### Enrollment Validation

All operations involving student results verify **matricula** (enrollment):

```typescript
// From ResultadoExercicioService.exigirAlunoMatriculado()
const matricula = await this.matriculaRepository.findByAlunoETurma(usuarioId, turmaId);
if (!matricula) {
  throw new ForbiddenError('Este aluno não está matriculado na turma do exercício');
}
```

**Why this matters:**
- Before Fase 9, `revisar()` would create results for any UUID without checking enrollment
- Professor could grade students who weren't in the class
- Fixed by requiring `MatriculaTurma` record before allowing review

See [backend_turmas](backend_turmas.md) for enrollment management.

---

## Integration Points

### Dependencies

**[backend_exercicios](backend_exercicios.md)**
- Validates exercise ownership
- Provides gabarito_liberado toggle
- AcessoExercicioService consumes envio_liberado_em valve

**[backend_sandbox_sql](backend_sandbox_sql.md)**
- Executes SQL queries
- Compares results with gabarito_sql
- Calls `upsertAcertoAutomatico()` with verdict

**[backend_turmas](backend_turmas.md)**
- Validates professor ownership of turma
- Provides matricula records for enrollment checking
- Supplies turma closure status (affects result visibility)

**[backend_auth](backend_auth.md)**
- Provides `req.usuario` authentication context
- Enforces role-based access (professor vs. student endpoints)

**[backend_modelagem](backend_modelagem.md)**
- Provides diagrama MER for manual review
- Separate from SQL/essay grading flow

**[backend_painel](backend_painel.md)**
- Reads ResultadoExercicio for dashboard metrics
- Aggregates sql_correto, pontuacao for performance views
- Uses revisado flag to determine completion status

---

### Consumers

**[backend_painel](backend_painel.md)**
```typescript
// From PainelRepository.findAtividadesPorExercicio()
const resultados = await prisma.resultadoExercicio.findMany({
  where: { exercicio_id: { in: exercicioIds } },
  select: { 
    usuario_id: true, 
    exercicio_id: true, 
    sql_correto: true,
    pontuacao: true,
    finalizado_em: true,
    revisado: true
  }
});
```

**[backend_pesquisa](backend_pesquisa.md)** (TCC research module)
```typescript
// From PesquisaService.acertos()
// Reads SubmissaoSql for attempt counts and accuracy metrics
const submissoes = await submissaoRepository.findResumoPorExercicios(exercicioIds);
```

**Frontend** ([frontend_exercicios](frontend_exercicios.md), [frontend_painel](frontend_painel.md))
- Displays graded results to students
- Shows grading interface to professors
- Renders performance matrices and progress tracking

---

## Error Handling

### Custom Errors

**NotFoundError**
```typescript
throw new NotFoundError('Exercício');
// → 404 "Exercício não encontrado"
```

**ForbiddenError**
```typescript
throw new ForbiddenError('Você não é o professor deste exercício');
// → 403 with Portuguese message
```

**UnauthorizedError**
```typescript
throw new UnauthorizedError('Autenticação necessária');
// → 401
```

**ValidationError**
```typescript
throw new ValidationError('Dados de revisão inválidos', zodIssues);
// → 400 with Zod validation details
```

All errors inherit from `AppError` and are handled by global error middleware. See [backend_core](backend_core.md) for error handling architecture.

---

## Data Flow Diagrams

### Complete Result Lifecycle

```mermaid
stateDiagram-v2
    [*] --> NoResult: Exercise assigned
    
    NoResult --> Attempting: Student starts
    Attempting --> Attempting: Multiple test submissions
    Attempting --> Submitted: Student finalizes
    
    Submitted --> AutoGraded: Has SQL gabarito
    Submitted --> AwaitingReview: No automatic grading
    
    AutoGraded --> AwaitingReview: Professor reviews
    AutoGraded --> Released: Gabarito released<br/>(automatic only)
    
    AwaitingReview --> ManuallyGraded: Professor sets grades
    
    ManuallyGraded --> Released: Gabarito released
    
    Released --> [*]: Student views result
    
    state Attempting {
        [*] --> Testing
        Testing --> Testing: POST /sandbox/testar
        Testing --> Submitting: POST /sandbox/enviar
        Submitting --> [*]
    }
    
    state AutoGraded {
        sql_correto_set: sql_correto = true/false
        revisado_false: revisado = false
    }
    
    state ManuallyGraded {
        all_fields: sql_correto, mer_avaliacao,<br/>dissertativa_avaliacao, pontuacao
        revisado_true: revisado = true
        locked: Automatic grading locked
    }
    
    note right of Released
        Visible to student only when:
        - gabarito_liberado = true
        - revisado = true
    end note
```

### Submission Recording Flow

```mermaid
flowchart LR
    subgraph Student Actions
        Test[POST /sandbox/testar]
        Submit[POST /sandbox/enviar]
    end
    
    subgraph Sandbox Processing
        Exec[Execute query<br/>in schema]
        Compare[Compare with<br/>gabarito_sql]
    end
    
    subgraph Persistence
        SaveSub[(SubmissaoSql<br/>tentativa_numero++)]
        SaveLog[(LogExecucaoSql<br/>explain_json)]
        SaveRes[(ResultadoExercicio<br/>sql_correto)]
    end
    
    Test --> Exec
    Submit --> Exec
    
    Exec --> SaveSub
    Exec --> SaveLog
    
    Submit --> Compare
    Compare -->|has gabarito| SaveRes
    Compare -->|no gabarito| Skip[correta = null]
    
    SaveSub -.->|submission_id| SaveLog
    
    classDef action fill:#e1f5ff,stroke:#0288d1
    classDef process fill:#fff9c4,stroke:#f57f17
    classDef storage fill:#c8e6c9,stroke:#388e3c
    
    class Test,Submit action
    class Exec,Compare process
    class SaveSub,SaveLog,SaveRes storage
```

---

## Performance Considerations

### Database Queries

**Optimized Lookups**
```typescript
// Uses composite unique index
where: { 
  usuario_id_exercicio_id: { 
    usuario_id: usuarioId, 
    exercicio_id: exercicioId 
  } 
}
```

**Batch Reads** (from PainelRepository)
```typescript
// Single query for all exercises in turma
findMany({ 
  where: { exercicio_id: { in: exercicioIds } } 
})
```

**N+1 Prevention**
```typescript
// Service layer coordinates multiple repos
await Promise.all([
  submissaoRepository.findUltimaTentativa(...),
  respostaDissertativaRepository.findByExercicioEUsuario(...)
]);
```

### Upsert Strategy

**Why UPSERT instead of separate INSERT/UPDATE:**
- Student may not have started exercise when professor liberates submission
- Automatic grading may run before manual review record exists
- Simplifies client code (no need to check existence)

**Protection from Race Conditions:**
```typescript
// Fase 9 fix: Read-check-write in transaction
const existente = await prisma.resultadoExercicio.findUnique({ where: chave });
if (existente?.revisado) {
  return; // Skip automatic update if manually reviewed
}
await prisma.resultadoExercicio.upsert({ ... });
```

---

## Testing Considerations

### Unit Test Coverage

**Service Layer**
- Authorization enforcement (professor ownership, student enrollment)
- Grading precedence (automatic vs. manual)
- Valve consumption logic (envio_liberado_em)
- Answer key visibility rules

**Repository Layer**
- Upsert behavior with/without existing records
- Revisado flag protection
- Tentativa_numero sequencing
- Composite key lookups

### Integration Test Scenarios

**Happy Path**
1. Student submits → Automatic grading → Professor reviews → Answer key released → Student views result

**Exam Mode Recovery**
1. Student in exam → Syntax error → Professor liberates submission → Student resubmits successfully

**Manual Override**
1. Automatic grading marks wrong → Professor reviews, finds correct → Manual grade locks automatic

**Concurrent Grading**
1. Multiple submissions while professor reviews → Ensure no race conditions on revisado flag

### Test Data Setup

Requires:
- Professor with Turma
- Student with MatriculaTurma
- Exercicio with gabarito_sql
- Sandbox schema with reference data

See `ide-web-backend/src/__tests__/` for test patterns.

---

## Configuration

### Environment Variables

None specific to this module. Uses shared database connection:
- `DATABASE_URL` - Main Supabase connection (via Prisma)

See [Infrastructure_&_Build_Pipeline](Infrastructure_&_Build_Pipeline.md) for setup.

### Database Schema

Managed by Prisma migrations in `ide-web-backend/prisma/`:
- `schema.prisma` - Model definitions
- `migrations/` - SQL migration files

**Relevant Models:**
- `ResultadoExercicio` (table: `resultados_exercicio`)
- `SubmissaoSql` (table: `submissoes_sql`)
- `LogExecucaoSql` (table: `logs_execucao_sql`)

---

## Development Guidelines

### Adding New Grade Fields

**Example: Adding `tempo_total_gasto` field**

1. **Update Prisma schema:**
```prisma
model ResultadoExercicio {
  // existing fields...
  tempo_total_gasto Int? @map("tempo_total_gasto")
}
```

2. **Create migration:**
```bash
cd ide-web-backend
npx prisma migrate dev --name adiciona_tempo_total_gasto
```

3. **Update DTOs:**
```typescript
// dtos/resultado.dto.ts
export interface RevisarResultadoBodyDto {
  // existing fields...
  tempoTotalGasto?: number;
}

export const revisarResultadoBodySchema = z.object({
  // existing validations...
  tempoTotalGasto: z.number().int().positive().optional(),
});
```

4. **Update repository:**
```typescript
// repositories/ResultadoExercicioRepository.ts
export interface RevisarResultadoInput {
  // existing fields...
  tempo_total_gasto?: number;
}
```

5. **Update service:**
```typescript
// services/ResultadoExercicioService.ts
await this.resultadoRepository.upsertRevisao(usuarioId, exercicioId, professorId, {
  ...(input.tempoTotalGasto !== undefined ? { tempo_total_gasto: input.tempoTotalGasto } : {}),
  // existing fields...
});
```

### Following MSC Architecture

**Always flow through layers:**
```
Route → Controller → Service → Repository → Database
```

**Never skip layers:**
- ❌ Controller calling Repository directly
- ❌ Service accessing Prisma client directly
- ✅ Service coordinates multiple repositories

**See Also:** `backend-dev-guidelines` skill in project.

---

## Migration History

### Fase 2 (2026-08-23)
- Initial implementation
- Basic revisar/liberar-gabarito endpoints
- SQL submission tracking

### Fase 8 (2026-09-16)
- Split "Download PDF" from "Finalize exercise"
- `finalizado_em` no longer set by PDF generation
- PDF download is repeatable, finalization triggers cleanup

### Fase 9 (2026-09-17)
- **D14:** Automatic grading writes to `ResultadoExercicio.sql_correto` (previously only in `SubmissaoSql.correta`)
- **D14:** Manual review locks automatic updates via `revisado` flag
- **D16:** Enrollment validation in `revisar()` - fixes grading students not in class
- **D17:** `respostasDoAluno()` endpoint - fixes "grading in the dark" usability issue

### Fase 10 (2026-09-17)
- **D8:** `envio_liberado_em` valve for exam mode recovery
- **D10:** `liberarEnvio()` endpoint for professors
- Grades changed from integers to decimals (0.0-10.0)

See `docs/decisions/fase9-dashboards-professor-aluno.md` and `fase10-professor-prova-sessao.md` for full design rationale.

---

## Future Enhancements

### Planned (Fase 12+)

**Rubric-Based Grading**
- Define scoring rubrics per exercise
- Auto-populate acertos/erros from checklist
- Structured feedback instead of free-form

**Peer Review**
- Students review anonymized peer submissions
- Professor reviews student-reviewer performance
- Collaborative learning mode

**Grade Appeals**
- Student requests re-review with justification
- Professor sees original grade + appeal
- Audit trail of grade changes

**Batch Grading**
- Grade multiple students at once for same exercise
- Apply same feedback to similar errors
- Progress tracking in UI

### Technical Debt

**Extract Answer Key Logic**
- Currently in ResultadoExercicioService
- Should be in ExercicioService (closer to domain)
- Refactor after validating stability

**Normalize Grade Fields**
- Current: sql_correto (boolean) + mer_avaliacao (decimal) + dissertativa_avaliacao (decimal) + pontuacao (decimal)
- Future: Structured grading components with weights
- Requires schema redesign

---

## Related Documentation

- [backend_exercicios](backend_exercicios.md) - Exercise management and access control
- [backend_sandbox_sql](backend_sandbox_sql.md) - SQL execution and automatic comparison
- [backend_modelagem](backend_modelagem.md) - Data modeling diagram storage
- [backend_painel](backend_painel.md) - Dashboard aggregations using results
- [backend_turmas](backend_turmas.md) - Class enrollment and ownership
- [backend_auth](backend_auth.md) - Authentication and authorization
- [backend_core](backend_core.md) - Error handling and base controllers

---

## References

**Decision Records**
- `docs/decisions/fase2-turmas-exercicios-tcle.md` - Initial grading design
- `docs/decisions/fase8-conta-do-aluno-matricula-estudo-livre.md` - Finalization split
- `docs/decisions/fase9-dashboards-professor-aluno.md` - Automatic grading improvements
- `docs/decisions/fase10-professor-prova-sessao.md` - Exam mode and grade liberation

**Codebase**
- `ide-web-backend/src/controllers/ResultadoController.ts` - HTTP endpoints
- `ide-web-backend/src/services/ResultadoExercicioService.ts` - Business logic
- `ide-web-backend/src/repositories/ResultadoExercicioRepository.ts` - Data access
- `ide-web-backend/src/repositories/SubmissaoSqlRepository.ts` - Submission tracking
- `ide-web-backend/prisma/schema.prisma` - Database models

**Project Guidelines**
- `CLAUDE.md` - Project architecture overview
- `/backend-dev-guidelines` skill - Backend coding standards
- `/database-design` skill - Schema design patterns

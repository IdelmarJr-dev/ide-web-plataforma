# Backend Auth Module

## Introduction

The `backend_auth` module is the authentication and session management subsystem of the IDE Web backend. It provides secure user authentication using email/password credentials, JWT-based token management, and server-side session tracking with automatic expiration policies. The module supports three user roles (aluno, professor, pesquisador) and implements a stateful session model introduced in Phase 10, where logout truly revokes access and idle sessions expire after inactivity.

This module is built following the MSC (Model-Service-Controller) layered architecture and integrates with the [backend_core](backend_core.md) error handling system and Prisma ORM for data persistence.

---

## Architecture Overview

### Component Layers

The module follows the standard MSC pattern with clear separation of concerns:

```mermaid
graph TB
    subgraph "HTTP Layer"
        Routes[auth.routes.ts]
        Controller[AuthController]
        Middleware[requireAuth middleware]
    end
    
    subgraph "Business Logic Layer"
        AuthService[AuthService]
        SessaoService[SessaoAuthService]
    end
    
    subgraph "Data Access Layer"
        UsuarioRepo[UsuarioRepository]
        SessaoRepo[SessaoAuthRepository]
    end
    
    subgraph "Utilities"
        JWT[jwt.ts]
        Password[password.ts]
        Cookies[cookies.ts]
    end
    
    subgraph "Database"
        DB[(PostgreSQL via Prisma)]
    end
    
    Routes --> Controller
    Routes --> Middleware
    Controller --> AuthService
    Middleware --> SessaoService
    AuthService --> UsuarioRepo
    AuthService --> SessaoRepo
    SessaoService --> SessaoRepo
    UsuarioRepo --> DB
    SessaoRepo --> DB
    
    AuthService --> JWT
    AuthService --> Password
    Controller --> Cookies
    Middleware --> Cookies
    Middleware --> JWT
    
    style Controller fill:#e1f5ff
    style AuthService fill:#fff4e1
    style SessaoService fill:#fff4e1
    style UsuarioRepo fill:#f0e1ff
    style SessaoRepo fill:#f0e1ff
```

### Module Dependencies

```mermaid
graph LR
    backend_auth --> backend_core
    backend_auth --> backend_errors
    backend_auth --> Prisma[Prisma Client]
    
    backend_core -.provides.-> BaseController
    backend_errors -.provides.-> UnauthorizedError
    backend_errors -.provides.-> ConflictError
    backend_errors -.provides.-> NotFoundError
    backend_errors -.provides.-> ValidationError
```

**External Dependencies:**
- **bcryptjs**: Password hashing with 10 salt rounds
- **jsonwebtoken**: JWT token signing and verification
- **zod**: Input validation schemas

---

## Core Components

### AuthController

**Location:** `ide-web-backend/src/controllers/AuthController.ts`

HTTP request handler that orchestrates authentication operations. Extends `BaseController` from [backend_core](backend_core.md).

**Responsibilities:**
- Validate incoming request payloads using Zod schemas
- Delegate business logic to `AuthService`
- Manage HTTP-only authentication cookies
- Return standardized JSON responses

**Key Methods:**
- `registrar()`: Creates new user account (aluno or professor only)
- `login()`: Authenticates user and issues tokens
- `refresh()`: Renews access token within existing session
- `logout()`: Revokes server-side session and clears cookies
- `me()`: Returns authenticated user profile

**Cookie Management:**
```typescript
// Sets both access and refresh tokens as httpOnly cookies
setAuthCookies(res, accessToken, refreshToken);

// Clears all auth cookies on logout
clearAuthCookies(res);
```

### AuthService

**Location:** `ide-web-backend/src/services/AuthService.ts`

Core authentication business logic orchestrator.

**Responsibilities:**
- User registration with duplicate email prevention
- Credential validation during login
- Token issuance and renewal
- Session lifecycle management

**Key Operations:**

1. **Registration Flow:**
   - Check for existing email (`ConflictError` if duplicate)
   - Hash password with bcrypt (10 rounds)
   - Create user record via repository
   - Create new session
   - Issue access + refresh tokens

2. **Login Flow:**
   - Find user by email
   - Verify password hash
   - Create new session
   - Issue tokens

3. **Token Refresh:**
   - Verify refresh token signature
   - Check session is still valid (not revoked)
   - Issue new access token **within same session**
   - Revoked sessions cannot be refreshed (enforces true logout)

**Token Issuance:**
```typescript
private async issueTokens(usuario: Usuario): Promise<AuthTokens> {
  const sessao = await this.sessaoRepository.criar(usuario.id);
  
  return {
    accessToken: signAccessToken(usuario.id, usuario.papel, sessao.id),
    refreshToken: signRefreshToken(usuario.id, usuario.papel, sessao.id),
  };
}
```

### SessaoAuthService

**Location:** `ide-web-backend/src/services/SessaoAuthService.ts`

Enforces session validation rules and lifecycle policies introduced in Phase 10.

**Session Policies:**
- **Maximum Lifetime:** 6 hours from creation (`DURACAO_MAXIMA_MS`)
- **Idle Timeout:** 1 hour of inactivity (`OCIOSIDADE_MAXIMA_MS`)
- **Activity Tracking:** Updates `ultima_atividade_em` every 5 minutes (`INTERVALO_REGISTRO_ATIVIDADE_MS`)

**Validation Process:**
```mermaid
graph TD
    Start[Session Validation] --> Exists{Session exists?}
    Exists -->|No| Error1[SessaoInvalidaError: inexistente]
    Exists -->|Yes| Revoked{Revoked?}
    Revoked -->|Yes| Error2[SessaoInvalidaError: revogada]
    Revoked -->|No| MaxAge{> 6 hours?}
    MaxAge -->|Yes| Error3[SessaoInvalidaError: expirada]
    MaxAge -->|No| Idle{> 1 hour idle?}
    Idle -->|Yes| Error4[SessaoInvalidaError: ociosa]
    Idle -->|No| ShouldUpdate{> 5 min since last update?}
    ShouldUpdate -->|Yes| Update[Update ultima_atividade_em]
    ShouldUpdate -->|No| Valid[Session Valid]
    Update --> Valid
```

**Error Messages:**
Each `SessaoInvalidaError` carries a specific `motivo` for clear user feedback:
- `revogada`: "Sua sessão foi encerrada. Entre novamente."
- `expirada`: "Sua sessão passou de 6 horas. Entre novamente."
- `ociosa`: "Sua sessão expirou por inatividade. Entre novamente."
- `inexistente`: "Sessão inválida ou expirada"

### Repositories

#### UsuarioRepository

**Location:** `ide-web-backend/src/repositories/UsuarioRepository.ts`

Handles user data persistence with minimal Prisma queries.

**Interface:**
```typescript
interface UsuarioRepository {
  findByEmail(email: string): Promise<Usuario | null>;
  findById(id: string): Promise<Usuario | null>;
  create(input: CreateUsuarioInput): Promise<Usuario>;
}
```

**Note on Registration Roles:**
- Public registration (`POST /auth/registrar`) only accepts `aluno` and `professor`
- The `pesquisador` role is exclusive to the research period and created manually via `scripts/seed-pesquisador.ts`
- See [backend_pesquisa](backend_pesquisa.md) for research-specific authentication

#### SessaoAuthRepository

**Location:** `ide-web-backend/src/repositories/SessaoAuthRepository.ts`

Manages session lifecycle in database.

**Interface:**
```typescript
interface SessaoAuthRepository {
  criar(usuarioId: string): Promise<SessaoAuth>;
  findById(id: string): Promise<SessaoAuth | null>;
  registrarAtividade(id: string, em: Date): Promise<void>;
  revogar(id: string): Promise<void>;
  revogarTodasDoUsuario(usuarioId: string): Promise<void>;
}
```

**Key Operations:**
- `criar()`: Initializes session with `ultima_atividade_em = now()`
- `registrarAtividade()`: Updates activity timestamp (called every 5 minutes)
- `revogar()`: Sets `revogada_em = now()`, making token refresh fail
- `revogarTodasDoUsuario()`: Mass revocation (useful for security events)

### JWT Utilities

**Location:** `ide-web-backend/src/utils/jwt.ts`

Token generation and validation with two distinct token types.

#### Standard Authentication Tokens

**Access Token:**
```typescript
interface JwtPayload {
  sub: string;        // User ID
  papel: Papel;       // User role (aluno/professor/pesquisador)
  type: 'access';     // Token type discriminator
  sid: string;        // Session ID (for server-side validation)
}
```
- **Expiration:** 15 minutes (configured via `JWT_ACCESS_EXPIRES_IN`)
- **Purpose:** Authorizes individual API requests
- **Storage:** HTTP-only cookie named `access_token`

**Refresh Token:**
- Same payload structure with `type: 'refresh'`
- **Expiration:** 7 days (configured via `JWT_REFRESH_EXPIRES_IN`)
- **Purpose:** Renews access token without re-login
- **Storage:** HTTP-only cookie named `refresh_token`

**Critical Feature:** Both tokens carry `sid` (session ID), enabling server-side revocation when `SessaoAuth.revogada_em` is set.

#### Research Tokens

**Location:** Same file, separate secret

```typescript
interface ResearchJwtPayload {
  usuario_id: string;
  papel: Papel;
  turma_ids: string[];  // Multiple classes since Phase 8
}
```

- **Purpose:** Authenticates frontend → Python research backend calls
- **Secret:** `RESEARCH_JWT_SECRET` (shared only between Node backend and self-hosted Docker)
- **Expiration:** Short-lived (15 minutes)
- **Data Minimization:** No `nome` or `email` for privacy compliance
- **Issued by:** `GET /pesquisa/token` endpoint (see [backend_pesquisa](backend_pesquisa.md))
- **Usage:** Sent as Bearer token in direct frontend → Python FastAPI requests

**Architecture Note:** The research backend is self-hosted and **not** in this repository—it's maintained separately for TCC data collection compliance (see CLAUDE.md).

### Middleware: requireAuth

**Location:** `ide-web-backend/src/middlewares/requireAuth.ts`

Express middleware that protects authenticated routes.

**Execution Flow:**
```mermaid
sequenceDiagram
    participant Client
    participant Middleware as requireAuth
    participant JWT as jwt.ts
    participant SessaoService
    participant DB as Database
    participant Next as Next Handler
    
    Client->>Middleware: Request + Cookies
    Middleware->>Middleware: Extract access_token cookie
    alt No token
        Middleware->>Client: 401 UnauthorizedError
    end
    
    Middleware->>JWT: verifyToken(token, 'access')
    alt Invalid signature/expired
        JWT-->>Middleware: Error
        Middleware->>Client: 401 Sessão inválida
    end
    JWT-->>Middleware: JwtPayload {sub, papel, sid}
    
    Middleware->>SessaoService: validar(sid)
    SessaoService->>DB: findById(sid)
    SessaoService->>SessaoService: Check revoked/expired/idle
    alt Session invalid
        SessaoService-->>Middleware: SessaoInvalidaError
        Middleware->>Client: 401 with specific message
    end
    
    SessaoService->>DB: registrarAtividade() if needed
    SessaoService-->>Middleware: Valid session
    
    Middleware->>Middleware: req.usuario = {id, papel, sessaoId}
    Middleware->>Next: next()
```

**Cost:** One database read per authenticated request (validates session state)

**Attached to Request:**
```typescript
// Type definition in src/types/express.d.ts
req.usuario = {
  id: string;
  papel: Papel;
  sessaoId: string;  // Used by logout to revoke
};
```

---

## Authentication Flows

### Registration Flow

```mermaid
sequenceDiagram
    participant Client
    participant AuthController
    participant AuthService
    participant UsuarioRepo
    participant SessaoRepo
    participant DB
    
    Client->>AuthController: POST /auth/registrar<br/>{nome, email, senha, papel}
    AuthController->>AuthController: Validate with Zod schema
    alt Invalid payload
        AuthController-->>Client: 400 ValidationError
    end
    
    AuthController->>AuthService: register(data)
    AuthService->>UsuarioRepo: findByEmail(email)
    UsuarioRepo->>DB: SELECT * FROM usuario WHERE email=?
    alt Email exists
        DB-->>UsuarioRepo: Usuario
        UsuarioRepo-->>AuthService: Usuario
        AuthService-->>Client: 409 ConflictError
    end
    
    DB-->>UsuarioRepo: null
    AuthService->>AuthService: hashPassword(senha)<br/>bcrypt with 10 rounds
    AuthService->>UsuarioRepo: create({nome, email, senha_hash, papel})
    UsuarioRepo->>DB: INSERT INTO usuario
    DB-->>UsuarioRepo: Usuario
    
    AuthService->>SessaoRepo: criar(usuario.id)
    SessaoRepo->>DB: INSERT INTO sessoes_auth
    DB-->>SessaoRepo: SessaoAuth
    
    AuthService->>AuthService: signAccessToken()<br/>signRefreshToken()
    AuthService-->>AuthController: {usuario, accessToken, refreshToken}
    
    AuthController->>AuthController: setAuthCookies(res, tokens)
    AuthController-->>Client: 201 Created<br/>{id, nome, email, papel}<br/>+ httpOnly cookies
```

**Registration Constraints:**
- Only `papel: 'aluno'` or `papel: 'professor'` allowed in DTO validation
- Minimum password length: 8 characters
- Email must be unique (enforced at DB level with unique constraint)

### Login Flow

```mermaid
sequenceDiagram
    participant Client
    participant AuthController
    participant AuthService
    participant UsuarioRepo
    participant SessaoRepo
    participant DB
    
    Client->>AuthController: POST /auth/login<br/>{email, senha}
    AuthController->>AuthService: login(credentials)
    AuthService->>UsuarioRepo: findByEmail(email)
    UsuarioRepo->>DB: SELECT * FROM usuario WHERE email=?
    
    alt User not found or no senha_hash
        DB-->>UsuarioRepo: null or Usuario without senha_hash
        AuthService-->>Client: 401 Credenciais inválidas
    end
    
    DB-->>UsuarioRepo: Usuario
    AuthService->>AuthService: comparePassword(senha, senha_hash)
    alt Password mismatch
        AuthService-->>Client: 401 Credenciais inválidas
    end
    
    AuthService->>SessaoRepo: criar(usuario.id)
    SessaoRepo->>DB: INSERT INTO sessoes_auth
    DB-->>SessaoRepo: SessaoAuth
    
    AuthService->>AuthService: signAccessToken()<br/>signRefreshToken()
    AuthService-->>AuthController: {usuario, tokens}
    AuthController->>AuthController: setAuthCookies(res, tokens)
    AuthController-->>Client: 200 OK<br/>{id, nome, email, papel}<br/>+ httpOnly cookies
```

**Security Notes:**
- Identical error message for "user not found" and "wrong password" (prevents email enumeration)
- Users without `senha_hash` treated as non-existent (database consistency protection)

### Token Refresh Flow

```mermaid
sequenceDiagram
    participant Client
    participant AuthController
    participant AuthService
    participant UsuarioRepo
    participant SessaoRepo
    participant DB
    
    Client->>AuthController: POST /auth/refresh<br/>Cookie: refresh_token
    AuthController->>AuthController: Extract refresh_token from cookies
    alt No refresh token
        AuthController-->>Client: 401 Refresh token ausente
    end
    
    AuthController->>AuthService: refresh(refreshToken)
    AuthService->>AuthService: verifyToken(token, 'refresh')
    alt Invalid signature or expired
        AuthService-->>Client: 401 Token inválido ou expirado
    end
    
    AuthService->>UsuarioRepo: findById(payload.sub)
    AuthService->>SessaoRepo: findById(payload.sid)
    
    par Parallel checks
        UsuarioRepo->>DB: SELECT * FROM usuario WHERE id=?
    and
        SessaoRepo->>DB: SELECT * FROM sessoes_auth WHERE id=?
    end
    
    alt User deleted or session revoked
        AuthService-->>Client: 401 Token inválido ou expirado
    end
    
    AuthService->>AuthService: signAccessToken(usuario.id, papel, sessao.id)
    AuthService-->>AuthController: {accessToken}
    
    AuthController->>AuthController: setAccessCookie(res, accessToken)
    AuthController-->>Client: 200 OK<br/>{renewed: true}<br/>+ updated access_token cookie
```

**Critical Behavior:**
- Refresh **does not** create a new session—it renews the access token within the existing session
- If the session was revoked (logout), refresh will fail with 401
- This enforces true server-side logout (Phase 10 requirement)

### Logout Flow

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as requireAuth
    participant AuthController
    participant AuthService
    participant SessaoRepo
    participant DB
    
    Client->>Middleware: POST /auth/logout<br/>Cookie: access_token
    Middleware->>Middleware: Validate token & session
    Middleware->>AuthController: next() with req.usuario
    
    AuthController->>AuthService: logout(req.usuario.sessaoId)
    AuthService->>SessaoRepo: revogar(sessaoId)
    SessaoRepo->>DB: UPDATE sessoes_auth<br/>SET revogada_em = now()<br/>WHERE id = ?
    DB-->>SessaoRepo: Updated
    
    AuthController->>AuthController: clearAuthCookies(res)
    AuthController-->>Client: 200 OK<br/>{loggedOut: true}<br/>Cleared cookies
```

**Effect of Revocation:**
- Future `requireAuth` middleware calls fail for this session
- `POST /auth/refresh` with the refresh token fails
- Access token still validates (JWT signature), but session check blocks it
- This is true stateful logout (contrast with Phase 1's stateless approach)

---

## Session Management

### Session Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Active: Login/Register<br/>(criar)
    
    Active --> Active: Request within 5min<br/>(no DB write)
    Active --> ActivityUpdated: Request after 5min<br/>(registrarAtividade)
    ActivityUpdated --> Active
    
    Active --> Revoked: Logout<br/>(revogar)
    Active --> Expired: 6 hours elapsed
    Active --> Idle: 1 hour no activity
    
    Revoked --> [*]
    Expired --> [*]
    Idle --> [*]
    
    note right of Active
        ultima_atividade_em
        updated every 5 minutes
    end note
    
    note right of Revoked
        revogada_em != null
    end note
```

### Database Schema

**SessaoAuth Table:**
```sql
CREATE TABLE sessoes_auth (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id          UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  criada_em           TIMESTAMP NOT NULL DEFAULT now(),
  ultima_atividade_em TIMESTAMP NOT NULL DEFAULT now(),
  revogada_em         TIMESTAMP NULL
);

CREATE INDEX idx_sessoes_auth_usuario_id ON sessoes_auth(usuario_id);
```

**Relationships:**
- One user can have multiple sessions (multi-device support)
- Sessions cascade delete when user is deleted
- No unique constraint—concurrent logins create separate sessions

### Activity Tracking Strategy

**Goal:** Balance accuracy vs. database write load

**Implementation:**
```typescript
// In SessaoAuthService.validar()
const agora = new Date();
const tempoDesdeUltimaAtualizacao = 
  agora.getTime() - sessao.ultima_atividade_em.getTime();

if (tempoDesdeUltimaAtualizacao > INTERVALO_REGISTRO_ATIVIDADE_MS) {
  await this.sessaoRepository.registrarAtividade(sessao.id, agora);
}
```

**Trade-off:**
- **Write frequency:** At most once per 5 minutes per session
- **Accuracy:** Idle timeout effective range is 1h–1h5min (acceptable variance)
- **Benefit:** Dramatically reduces DB writes for active users (12 writes/hour → 1 write/5min)

---

## Security Features

### Password Security

**Hashing Algorithm:** bcrypt via `bcryptjs`
- **Salt Rounds:** 10 (2^10 = 1024 iterations)
- **Location:** `ide-web-backend/src/utils/password.ts`

```typescript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export function comparePassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}
```

**Storage:** Only `senha_hash` persisted; plaintext never stored

### Token Security

**JWT Secret Management:**
- **Main Secret:** `JWT_SECRET` environment variable (signs access/refresh tokens)
- **Research Secret:** `RESEARCH_JWT_SECRET` (signs research backend tokens)
- Both secrets must be cryptographically random (recommended: 256+ bits)

**Token Expiration:**
```typescript
// From config (environment variables)
config.jwt.accessExpiresIn   // Default: '15m'
config.jwt.refreshExpiresIn  // Default: '7d'
config.researchJwt.expiresIn // Default: '15m'
```

**Signature Verification:**
- Every token validated before trusting payload
- Invalid signatures rejected with 401
- Expired tokens rejected with 401

### Cookie Security

**Location:** `ide-web-backend/src/utils/cookies.ts`

**Cookie Configuration:**
```typescript
const baseCookieOptions = (maxAge: number): CookieOptions => ({
  httpOnly: true,      // Prevents JavaScript access (XSS protection)
  secure: IS_PRODUCTION, // HTTPS-only in production
  sameSite: 'strict',  // CSRF protection
  maxAge,              // Milliseconds until expiration
  path: '/',           // Available site-wide
});
```

**Cookie Names:**
- `access_token`: Carries access JWT
- `refresh_token`: Carries refresh JWT

**Security Properties:**
- **HttpOnly:** Protects against XSS attacks (JavaScript cannot read cookies)
- **Secure (production):** Prevents transmission over unencrypted HTTP
- **SameSite=strict:** Blocks cookies in cross-site requests (CSRF defense)

### HTTPS Requirement

**Production Environment:**
- `secure: true` flag requires HTTPS
- Hosting: Backend on Render (automatic HTTPS)
- See `docker-compose.yml` and deployment configs in infrastructure documentation

---

## API Endpoints

**Route Registration:** `ide-web-backend/src/routes/auth.routes.ts`

**Base Path:** `/api/v1/auth` (prefix configured in main app)

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| `POST` | `/registrar` | No | Create new user account (aluno/professor only) |
| `POST` | `/login` | No | Authenticate and receive tokens |
| `POST` | `/refresh` | No* | Renew access token using refresh token |
| `POST` | `/logout` | Yes | Revoke session and clear cookies |
| `GET` | `/me` | Yes | Get current user profile |

**\*Note on /refresh:** Does not require `requireAuth` middleware (uses refresh token from cookie), but still requires valid refresh token.

### Endpoint Details

#### POST /auth/registrar

**Request Body:**
```typescript
{
  nome: string;         // Minimum 1 character
  email: string;        // Valid email format
  senha: string;        // Minimum 8 characters
  papel: 'aluno' | 'professor';  // Enum validation
}
```

**Response (201 Created):**
```typescript
{
  data: {
    id: string;
    nome: string;
    email: string;
    papel: 'aluno' | 'professor';
  }
}
// + Set-Cookie: access_token, refresh_token
```

**Error Cases:**
- `400 ValidationError`: Invalid payload (e.g., email format, short password)
- `409 ConflictError`: Email already registered

#### POST /auth/login

**Request Body:**
```typescript
{
  email: string;
  senha: string;
}
```

**Response (200 OK):**
```typescript
{
  data: {
    id: string;
    nome: string;
    email: string;
    papel: 'aluno' | 'professor' | 'pesquisador';
  }
}
// + Set-Cookie: access_token, refresh_token
```

**Error Cases:**
- `400 ValidationError`: Missing fields
- `401 UnauthorizedError`: Invalid credentials (same message for wrong email or password)

#### POST /auth/refresh

**Request:** Requires `refresh_token` cookie

**Response (200 OK):**
```typescript
{
  data: {
    renewed: true
  }
}
// + Set-Cookie: access_token (updated)
```

**Error Cases:**
- `401 UnauthorizedError`: No refresh token in cookies
- `401 UnauthorizedError`: Invalid/expired refresh token
- `401 UnauthorizedError`: Session was revoked (logout occurred)

#### POST /auth/logout

**Request:** Requires valid `access_token` cookie

**Response (200 OK):**
```typescript
{
  data: {
    loggedOut: true
  }
}
// + Set-Cookie: access_token=; Max-Age=0
// + Set-Cookie: refresh_token=; Max-Age=0
```

**Effect:**
- Sets `sessoes_auth.revogada_em = now()` in database
- Clears both auth cookies
- Subsequent requests with same tokens will fail

#### GET /auth/me

**Request:** Requires valid `access_token` cookie

**Response (200 OK):**
```typescript
{
  data: {
    id: string;
    nome: string;
    email: string;
    papel: 'aluno' | 'professor' | 'pesquisador';
  }
}
```

**Error Cases:**
- `401 UnauthorizedError`: No access token / invalid token
- `404 NotFoundError`: User was deleted (edge case)

---

## Data Model

### Usuario Table

**Schema Location:** `ide-web-backend/prisma/schema.prisma`

```prisma
model Usuario {
  id         String   @id @default(uuid()) @db.Uuid
  nome       String
  email      String?  @unique
  senha_hash String?
  papel      Papel
  matricula  String?
  criado_em  DateTime @default(now())

  sessoes                 SessaoAuth[]
  matriculas_turma        MatriculaTurma[]
  turmas_lecionadas       Turma[]                @relation("TurmaProfessor")
  diagramas_mer           DiagramaMer[]
  submissoes_sql          SubmissaoSql[]
  // ... other relations
}

enum Papel {
  aluno
  professor
  pesquisador
}
```

**Field Notes:**
- `email` and `senha_hash` are nullable in schema (legacy from Phase 8 migration) but **enforced as required by DTO validation**
- `papel` enum has three values, but `pesquisador` is not publicly registrable
- `matricula` field unused in auth module (reserved for future integration)

### SessaoAuth Table

```prisma
model SessaoAuth {
  id                  String    @id @default(uuid()) @db.Uuid
  usuario_id          String    @db.Uuid
  criada_em           DateTime  @default(now())
  ultima_atividade_em DateTime  @default(now())
  revogada_em         DateTime?

  usuario Usuario @relation(fields: [usuario_id], references: [id], onDelete: Cascade)

  @@index([usuario_id])
  @@map("sessoes_auth")
}
```

**Indexes:**
- Primary key on `id` (UUID)
- Index on `usuario_id` for efficient user-session lookups

**Cascade Behavior:**
- When user deleted, all sessions deleted automatically

### Entity Relationship Diagram

```mermaid
erDiagram
    Usuario ||--o{ SessaoAuth : "has sessions"
    
    Usuario {
        uuid id PK
        string nome
        string email UK "nullable in schema"
        string senha_hash "nullable in schema"
        enum papel "aluno|professor|pesquisador"
        string matricula "nullable"
        timestamp criado_em
    }
    
    SessaoAuth {
        uuid id PK
        uuid usuario_id FK
        timestamp criada_em
        timestamp ultima_atividade_em
        timestamp revogada_em "null = active"
    }
```

---

## Configuration

### Environment Variables

**Required for Authentication:**

```bash
# JWT Configuration
JWT_SECRET=<256-bit-random-secret>           # Signs access/refresh tokens
JWT_ACCESS_EXPIRES_IN=15m                    # Access token lifetime
JWT_REFRESH_EXPIRES_IN=7d                    # Refresh token lifetime

# Research Backend Authentication
RESEARCH_JWT_SECRET=<separate-256-bit-secret> # Signs research tokens
RESEARCH_JWT_EXPIRES_IN=15m                   # Research token lifetime

# Database
DATABASE_URL=postgresql://user:pass@host:port/db  # Main Supabase project

# Environment
NODE_ENV=production|development               # Affects cookie.secure flag
```

**Configuration Loading:**
Centralized in `ide-web-backend/src/config/index.ts` (not shown in core components but referenced by jwt.ts)

### Cookie Lifetimes

**Access Token Cookie:**
- Max-Age: Matches JWT expiration (15 minutes default)
- Renewed on refresh

**Refresh Token Cookie:**
- Max-Age: Matches JWT expiration (7 days default)
- Renewed only on new login

**Security Note:** Cookie max-age and JWT exp claim should match to prevent timing attacks.

---

## Integration Points

### Frontend Integration

**Expected Frontend Behavior:**
1. **Login/Register:** Call endpoint, receive cookies automatically
2. **Authenticated Requests:** Send cookies on every request (browser automatic)
3. **Token Refresh on 401:**
   - Frontend intercepts 401 responses
   - Calls `POST /auth/refresh`
   - Retries original request with new access token
   - Implementation in `ide-web-front/src/lib/httpClient.ts` (see [frontend_auth](frontend_auth.md))

4. **Logout:** Call endpoint, clear local state

### Other Backend Modules

**Usage Pattern:**
```typescript
// In any protected route
import { requireAuth } from '../middlewares/requireAuth';

router.get('/protected', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.usuario.id;        // Always available after middleware
  const userRole = req.usuario.papel;   // For role-based access control
  const sessionId = req.usuario.sessaoId; // For session-specific operations
  // ... business logic
}));
```

**Modules Using Auth:**
- [backend_exercicios](backend_exercicios.md): Exercise ownership validation
- [backend_turmas](backend_turmas.md): Class membership checks
- [backend_sandbox_sql](backend_sandbox_sql.md): User-scoped SQL sandboxes
- [backend_painel](backend_painel.md): Role-specific dashboard data
- [backend_pesquisa](backend_pesquisa.md): Research token issuance

### Research Backend Communication

**Flow:**
```mermaid
sequenceDiagram
    participant Frontend
    participant NodeBackend as Node Backend<br/>(this module)
    participant PythonBackend as Python Backend<br/>(self-hosted)
    
    Frontend->>NodeBackend: GET /pesquisa/token<br/>Cookie: access_token
    NodeBackend->>NodeBackend: requireAuth validates session
    NodeBackend->>NodeBackend: signResearchToken({usuario_id, papel, turma_ids})
    NodeBackend-->>Frontend: {token: "eyJ..."}
    
    Frontend->>PythonBackend: POST /pesquisa/...<br/>Authorization: Bearer eyJ...
    PythonBackend->>PythonBackend: Verify JWT with RESEARCH_JWT_SECRET
    PythonBackend-->>Frontend: Research data
```

**Security Isolation:**
- Research backend has separate JWT secret
- Research tokens **do not** grant access to main Node backend
- Main access tokens **do not** work with Python backend
- See [backend_pesquisa](backend_pesquisa.md) for full research flow

---

## Error Handling

### Error Types

All errors extend classes from [backend_errors](backend_errors.md):

| Error Class | HTTP Status | When Thrown |
|-------------|-------------|-------------|
| `ValidationError` | 400 | Invalid request payload (Zod validation failure) |
| `UnauthorizedError` | 401 | Missing/invalid token, session revoked/expired |
| `SessaoInvalidaError` | 401 | Session-specific failures (extends UnauthorizedError) |
| `NotFoundError` | 404 | User not found in `me()` endpoint |
| `ConflictError` | 409 | Email already registered |

### Error Response Format

**Standard Error Response:**
```typescript
{
  error: string;           // Human-readable message in Portuguese
  status: number;          // HTTP status code
  details?: Array<{        // Present for ValidationError
    path: string[];
    message: string;
  }>;
}
```

**Example - Validation Error:**
```json
{
  "error": "Dados de registro inválidos",
  "status": 400,
  "details": [
    {
      "path": ["senha"],
      "message": "String must contain at least 8 character(s)"
    }
  ]
}
```

**Example - Session Invalid Error:**
```json
{
  "error": "Sua sessão expirou por inatividade. Entre novamente.",
  "status": 401
}
```

---

## Testing Considerations

### Unit Testing

**Test Targets:**
- `AuthService`: Mock repositories, verify business logic
- `SessaoAuthService`: Test timing calculations, edge cases for 6h/1h/5min intervals
- JWT utilities: Verify token signing/verification, expiration handling

**Example Test Case:**
```typescript
describe('SessaoAuthService.validar', () => {
  it('should throw SessaoInvalidaError when session idle > 1 hour', async () => {
    const sessao = {
      id: 'session-123',
      ultima_atividade_em: new Date(Date.now() - 61 * 60 * 1000), // 61 minutes ago
      revogada_em: null,
      criada_em: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    };
    
    mockSessaoRepo.findById.mockResolvedValue(sessao);
    
    await expect(service.validar('session-123'))
      .rejects
      .toThrow(SessaoInvalidaError);
  });
});
```

### Integration Testing

**Database Requirements:**
- Test database with `usuario` and `sessoes_auth` tables
- Use Docker Compose test service (see `docker-compose.yml`)

**E2E Test Scenarios:**
1. Registration → Login → Authenticated request
2. Login → Logout → Attempt authenticated request (should fail)
3. Login → Refresh token → Logout → Refresh token (should fail)
4. Login → Wait 61 minutes → Request (should fail with idle timeout)

---

## Migration History

### Phase 1 (Stateless JWT)
- Initial implementation with JWT-only authentication
- No server-side session tracking
- Logout only cleared client cookies (tokens remained valid until expiration)

### Phase 8 (Multi-Class Enrollment)
- Removed lightweight student sessions (no email/password)
- All users now register with email/password
- Added `MatriculaTurma` for multi-class enrollment
- Research tokens now carry `turma_ids[]` instead of single `turma_id`

### Phase 10 (Stateful Sessions) - **Current Implementation**
- Added `SessaoAuth` table for server-side session tracking
- Implemented true logout via session revocation
- Added session policies: 6h max lifetime, 1h idle timeout
- `requireAuth` middleware now validates session state on every request
- Activity tracking with 5-minute write interval optimization

**Migration File:** `ide-web-backend/prisma/migrations/.../add_sessoes_auth.sql`

---

## Performance Considerations

### Database Load

**Per Authenticated Request:**
- 1 read: `SessaoAuth.findById()` in `requireAuth` middleware
- 1 write (conditional): `registrarAtividade()` if > 5min since last update

**Optimization:**
- Activity updates batched by 5-minute interval
- Reduces writes from O(requests) to O(requests / 12) per hour
- Index on `usuario_id` speeds up session lookups

### Token Verification

**In-Memory Operations:**
- JWT signature verification (cryptographic, ~1ms)
- No database hit for signature validation
- Database only consulted for session state

### Cookie Overhead

**Minimal:**
- JWTs compressed (typical size: ~200 bytes per token)
- Sent automatically by browser (no manual header management)
- HttpOnly prevents JavaScript access (no XSS attack surface)

---

## Security Audit Checklist

- [x] Passwords hashed with bcrypt (10 rounds)
- [x] JWTs signed with strong secret (256+ bits)
- [x] Tokens include expiration claims
- [x] Cookies are httpOnly (XSS protection)
- [x] Cookies are secure in production (HTTPS-only)
- [x] Cookies use sameSite=strict (CSRF protection)
- [x] Session revocation enforced server-side
- [x] Idle timeout prevents indefinite sessions
- [x] Maximum session lifetime enforced (6 hours)
- [x] Research tokens use separate secret (isolation)
- [x] Email enumeration prevented (same error for wrong email/password)
- [x] No plaintext passwords logged or stored

---

## Troubleshooting

### Common Issues

**"Sessão inválida ou expirada" on every request**
- **Cause:** JWT_SECRET changed between token issuance and verification
- **Solution:** Verify environment variable is consistent; users must re-login after secret rotation

**"Sua sessão expirou por inatividade" after short period**
- **Cause:** System clock skew between application servers
- **Solution:** Ensure all servers use NTP time synchronization

**Refresh token fails immediately after login**
- **Cause:** Session record not committed before refresh call
- **Solution:** Check database transaction isolation; ensure session creation commits before returning tokens

**Cookie not sent on requests**
- **Cause:** Domain/path mismatch or SameSite policy blocking
- **Solution:** Verify frontend/backend on same domain in production; check CORS configuration

### Debug Logging

**Enable Debug Mode:**
```typescript
// In requireAuth middleware (for development)
console.log('Access token:', accessToken);
console.log('JWT payload:', payload);
console.log('Session:', sessao);
```

**Session State Inspection:**
```sql
-- Check active sessions for user
SELECT id, criada_em, ultima_atividade_em, revogada_em
FROM sessoes_auth
WHERE usuario_id = 'user-uuid'
ORDER BY criada_em DESC;
```

---

## Future Improvements

### Potential Enhancements

1. **Session List for Users:**
   - Show active sessions in user profile
   - Allow users to revoke specific sessions (e.g., "logout other devices")

2. **Rate Limiting:**
   - Limit login attempts per IP/email
   - Prevent brute-force password attacks

3. **Password Policies:**
   - Require password complexity (uppercase, numbers, symbols)
   - Password expiration for compliance

4. **Two-Factor Authentication (2FA):**
   - TOTP-based (e.g., Google Authenticator)
   - Backup codes for account recovery

5. **OAuth Integration:**
   - Social login (Google, GitHub)
   - Institutional SSO (for IFPI integration)

6. **Audit Logging:**
   - Log all authentication events (login, logout, refresh)
   - Detect suspicious activity patterns

---

## References

### Related Modules
- [backend_core](backend_core.md) - BaseController, health checks
- [backend_errors](backend_errors.md) - Error class hierarchy
- [backend_pesquisa](backend_pesquisa.md) - Research token issuance and usage
- [frontend_auth](frontend_auth.md) - Frontend authentication state management

### Decision Documents
- `docs/decisions/fase1-setup-tecnico.md` - Initial JWT authentication design
- `docs/decisions/fase8-conta-do-aluno-matricula-estudo-livre.md` - Multi-class enrollment
- `docs/decisions/fase10-professor-prova-sessao.md` - Stateful session implementation

### External Documentation
- [JWT.io](https://jwt.io/) - JWT specification and debugger
- [bcryptjs npm](https://www.npmjs.com/package/bcryptjs) - Password hashing library
- [Prisma Client](https://www.prisma.io/docs/concepts/components/prisma-client) - ORM documentation

---

**Module Owner:** Backend team  
**Last Updated:** Phase 10 (Stateful Sessions)  
**Status:** ✅ Production Ready

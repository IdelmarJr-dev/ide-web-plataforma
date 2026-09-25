# Módulo Backend Auth

## Introdução

O módulo `backend_auth` é o subsistema de autenticação e de gestão de sessões do backend da IDE Web. Ele oferece autenticação segura de usuários com e-mail e senha, gestão de tokens baseada em JWT e acompanhamento de sessões no servidor, com políticas de expiração automática. O módulo dá suporte a três papéis de usuário (aluno, professor, pesquisador) e implementa um modelo de sessão com estado, introduzido na Fase 10, em que o logout revoga o acesso de verdade e as sessões ociosas expiram por inatividade.

Este módulo é construído segundo a arquitetura em camadas MSC (Model-Service-Controller) e se integra ao sistema de tratamento de erros do [backend_core](backend_core.md) e ao ORM Prisma para a persistência de dados.

---

## Visão geral da arquitetura

### Camadas de componentes

O módulo segue o padrão MSC, com uma separação clara de responsabilidades:

```mermaid
graph TB
    subgraph "Camada HTTP"
        Routes[auth.routes.ts]
        Controller[AuthController]
        Middleware[middleware requireAuth]
    end
    
    subgraph "Camada de lógica de negócio"
        AuthService[AuthService]
        SessaoService[SessaoAuthService]
    end
    
    subgraph "Camada de acesso a dados"
        UsuarioRepo[UsuarioRepository]
        SessaoRepo[SessaoAuthRepository]
    end
    
    subgraph "Utilitários"
        JWT[jwt.ts]
        Password[password.ts]
        Cookies[cookies.ts]
    end
    
    subgraph "Banco de dados"
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

### Dependências do módulo

```mermaid
graph LR
    backend_auth --> backend_core
    backend_auth --> backend_errors
    backend_auth --> Prisma[Cliente Prisma]
    
    backend_core -.fornece.-> BaseController
    backend_errors -.fornece.-> UnauthorizedError
    backend_errors -.fornece.-> ConflictError
    backend_errors -.fornece.-> NotFoundError
    backend_errors -.fornece.-> ValidationError
```

**Dependências externas:**
- **bcryptjs**: hash de senhas com 10 rodadas de salt
- **jsonwebtoken**: assinatura e verificação de tokens JWT
- **zod**: schemas de validação de entrada

---

## Componentes principais

### AuthController

**Localização:** `ide-web-backend/src/controllers/AuthController.ts`

Tratador de requisições HTTP que orquestra as operações de autenticação. Estende o `BaseController` do [backend_core](backend_core.md).

**Responsabilidades:**
- Validar os payloads recebidos com schemas Zod
- Delegar a lógica de negócio ao `AuthService`
- Gerenciar os cookies de autenticação HTTP-only
- Devolver respostas JSON padronizadas

**Métodos principais:**
- `registrar()`: cria uma nova conta de usuário (apenas aluno ou professor)
- `login()`: autentica o usuário e emite os tokens
- `refresh()`: renova o token de acesso dentro da sessão existente
- `logout()`: revoga a sessão no servidor e limpa os cookies
- `me()`: devolve o perfil do usuário autenticado

**Gestão de cookies:**
```typescript
// Define os tokens de acesso e de renovação como cookies httpOnly
setAuthCookies(res, accessToken, refreshToken);

// Limpa todos os cookies de autenticação no logout
clearAuthCookies(res);
```

### AuthService

**Localização:** `ide-web-backend/src/services/AuthService.ts`

Orquestrador da lógica de negócio central da autenticação.

**Responsabilidades:**
- Cadastro de usuários com prevenção de e-mails duplicados
- Validação de credenciais durante o login
- Emissão e renovação de tokens
- Gestão do ciclo de vida da sessão

**Operações principais:**

1. **Fluxo de cadastro:**
   - Verifica se já existe o e-mail (`ConflictError` se duplicado)
   - Faz o hash da senha com bcrypt (10 rodadas)
   - Cria o registro do usuário pelo repositório
   - Cria uma nova sessão
   - Emite os tokens de acesso e de renovação

2. **Fluxo de login:**
   - Busca o usuário pelo e-mail
   - Verifica o hash da senha
   - Cria uma nova sessão
   - Emite os tokens

3. **Renovação do token:**
   - Verifica a assinatura do token de renovação
   - Confere que a sessão ainda é válida (não foi revogada)
   - Emite um novo token de acesso **dentro da mesma sessão**
   - Sessões revogadas não podem ser renovadas (garante o logout de verdade)

**Emissão de tokens:**
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

**Localização:** `ide-web-backend/src/services/SessaoAuthService.ts`

Aplica as regras de validação de sessão e as políticas de ciclo de vida introduzidas na Fase 10.

**Políticas de sessão:**
- **Vida máxima:** 6 horas a partir da criação (`DURACAO_MAXIMA_MS`)
- **Tempo de inatividade:** 1 hora sem atividade (`OCIOSIDADE_MAXIMA_MS`)
- **Acompanhamento de atividade:** atualiza `ultima_atividade_em` a cada 5 minutos (`INTERVALO_REGISTRO_ATIVIDADE_MS`)

**Processo de validação:**
```mermaid
graph TD
    Start[Validação da sessão] --> Exists{A sessão existe?}
    Exists -->|Não| Error1[SessaoInvalidaError: inexistente]
    Exists -->|Sim| Revoked{Revogada?}
    Revoked -->|Sim| Error2[SessaoInvalidaError: revogada]
    Revoked -->|Não| MaxAge{> 6 horas?}
    MaxAge -->|Sim| Error3[SessaoInvalidaError: expirada]
    MaxAge -->|Não| Idle{> 1 hora ociosa?}
    Idle -->|Sim| Error4[SessaoInvalidaError: ociosa]
    Idle -->|Não| ShouldUpdate{> 5 min desde a última atualização?}
    ShouldUpdate -->|Sim| Update[Atualiza ultima_atividade_em]
    ShouldUpdate -->|Não| Valid[Sessão válida]
    Update --> Valid
```

**Mensagens de erro:**
Cada `SessaoInvalidaError` carrega um `motivo` específico, para uma devolutiva clara ao usuário:
- `revogada`: "Sua sessão foi encerrada. Entre novamente."
- `expirada`: "Sua sessão passou de 6 horas. Entre novamente."
- `ociosa`: "Sua sessão expirou por inatividade. Entre novamente."
- `inexistente`: "Sessão inválida ou expirada"

### Repositórios

#### UsuarioRepository

**Localização:** `ide-web-backend/src/repositories/UsuarioRepository.ts`

Trata da persistência dos dados de usuário, com o mínimo de consultas Prisma.

**Interface:**
```typescript
interface UsuarioRepository {
  findByEmail(email: string): Promise<Usuario | null>;
  findById(id: string): Promise<Usuario | null>;
  create(input: CreateUsuarioInput): Promise<Usuario>;
}
```

**Nota sobre os papéis no cadastro:**
- O cadastro público (`POST /auth/registrar`) só aceita `aluno` e `professor`
- O papel `pesquisador` é exclusivo do período de pesquisa e é criado manualmente por meio do `scripts/seed-pesquisador.ts`
- Veja [backend_pesquisa](backend_pesquisa.md) para a autenticação específica da pesquisa

#### SessaoAuthRepository

**Localização:** `ide-web-backend/src/repositories/SessaoAuthRepository.ts`

Gerencia o ciclo de vida da sessão no banco de dados.

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

**Operações principais:**
- `criar()`: inicializa a sessão com `ultima_atividade_em = now()`
- `registrarAtividade()`: atualiza o horário de atividade (chamado a cada 5 minutos)
- `revogar()`: define `revogada_em = now()`, fazendo a renovação do token falhar
- `revogarTodasDoUsuario()`: revogação em massa (útil em eventos de segurança)

### Utilitários de JWT

**Localização:** `ide-web-backend/src/utils/jwt.ts`

Geração e validação de tokens, com dois tipos distintos.

#### Tokens de autenticação padrão

**Token de acesso:**
```typescript
interface JwtPayload {
  sub: string;        // ID do usuário
  papel: Papel;       // Papel do usuário (aluno/professor/pesquisador)
  type: 'access';     // Discriminador do tipo de token
  sid: string;        // ID da sessão (para a validação no servidor)
}
```
- **Expiração:** 15 minutos (configurada por `JWT_ACCESS_EXPIRES_IN`)
- **Finalidade:** autoriza cada requisição individual à API
- **Armazenamento:** cookie HTTP-only chamado `access_token`

**Token de renovação:**
- Mesma estrutura de payload, com `type: 'refresh'`
- **Expiração:** 7 dias (configurada por `JWT_REFRESH_EXPIRES_IN`)
- **Finalidade:** renova o token de acesso sem novo login
- **Armazenamento:** cookie HTTP-only chamado `refresh_token`

**Recurso crítico:** os dois tokens carregam o `sid` (id da sessão), o que permite a revogação no servidor quando `SessaoAuth.revogada_em` é definido.

#### Tokens de pesquisa

**Localização:** o mesmo arquivo, com um segredo separado

```typescript
interface ResearchJwtPayload {
  usuario_id: string;
  papel: Papel;
  turma_ids: string[];  // Várias turmas desde a Fase 8
}
```

- **Finalidade:** autentica as chamadas do frontend ao backend Python de pesquisa
- **Segredo:** `RESEARCH_JWT_SECRET` (compartilhado apenas entre o backend Node e o Docker self-hosted)
- **Expiração:** vida curta (15 minutos)
- **Minimização de dados:** sem `nome` nem `email`, por conformidade com a privacidade
- **Emitido por:** endpoint `GET /pesquisa/token` (veja [backend_pesquisa](backend_pesquisa.md))
- **Uso:** enviado como token Bearer nas requisições diretas do frontend ao FastAPI em Python

**Nota de arquitetura:** o backend de pesquisa é self-hosted e **não** está neste repositório: é mantido à parte, por conformidade com a coleta de dados do TCC (veja o CLAUDE.md).

### Middleware: requireAuth

**Localização:** `ide-web-backend/src/middlewares/requireAuth.ts`

Middleware do Express que protege as rotas autenticadas.

**Fluxo de execução:**
```mermaid
sequenceDiagram
    participant Client as Cliente
    participant Middleware as requireAuth
    participant JWT as jwt.ts
    participant SessaoService
    participant DB as Banco de dados
    participant Next as Próximo handler
    
    Client->>Middleware: Requisição + Cookies
    Middleware->>Middleware: Extrai o cookie access_token
    alt Sem token
        Middleware->>Client: 401 UnauthorizedError
    end
    
    Middleware->>JWT: verifyToken(token, 'access')
    alt Assinatura inválida/expirado
        JWT-->>Middleware: Erro
        Middleware->>Client: 401 Sessão inválida
    end
    JWT-->>Middleware: JwtPayload {sub, papel, sid}
    
    Middleware->>SessaoService: validar(sid)
    SessaoService->>DB: findById(sid)
    SessaoService->>SessaoService: Verifica revogada/expirada/ociosa
    alt Sessão inválida
        SessaoService-->>Middleware: SessaoInvalidaError
        Middleware->>Client: 401 com mensagem específica
    end
    
    SessaoService->>DB: registrarAtividade() se necessário
    SessaoService-->>Middleware: Sessão válida
    
    Middleware->>Middleware: req.usuario = {id, papel, sessaoId}
    Middleware->>Next: next()
```

**Custo:** uma leitura de banco de dados por requisição autenticada (valida o estado da sessão)

**Anexado à requisição:**
```typescript
// Definição de tipo em src/types/express.d.ts
req.usuario = {
  id: string;
  papel: Papel;
  sessaoId: string;  // Usado pelo logout para revogar
};
```

---

## Fluxos de autenticação

### Fluxo de cadastro

```mermaid
sequenceDiagram
    participant Client as Cliente
    participant AuthController
    participant AuthService
    participant UsuarioRepo
    participant SessaoRepo
    participant DB
    
    Client->>AuthController: POST /auth/registrar<br/>{nome, email, senha, papel}
    AuthController->>AuthController: Valida com o schema Zod
    alt Payload inválido
        AuthController-->>Client: 400 ValidationError
    end
    
    AuthController->>AuthService: register(data)
    AuthService->>UsuarioRepo: findByEmail(email)
    UsuarioRepo->>DB: SELECT * FROM usuario WHERE email=?
    alt O e-mail existe
        DB-->>UsuarioRepo: Usuario
        UsuarioRepo-->>AuthService: Usuario
        AuthService-->>Client: 409 ConflictError
    end
    
    DB-->>UsuarioRepo: null
    AuthService->>AuthService: hashPassword(senha)<br/>bcrypt com 10 rodadas
    AuthService->>UsuarioRepo: create({nome, email, senha_hash, papel})
    UsuarioRepo->>DB: INSERT INTO usuario
    DB-->>UsuarioRepo: Usuario
    
    AuthService->>SessaoRepo: criar(usuario.id)
    SessaoRepo->>DB: INSERT INTO sessoes_auth
    DB-->>SessaoRepo: SessaoAuth
    
    AuthService->>AuthService: signAccessToken()<br/>signRefreshToken()
    AuthService-->>AuthController: {usuario, accessToken, refreshToken}
    
    AuthController->>AuthController: setAuthCookies(res, tokens)
    AuthController-->>Client: 201 Created<br/>{id, nome, email, papel}<br/>+ cookies httpOnly
```

**Restrições do cadastro:**
- Apenas `papel: 'aluno'` ou `papel: 'professor'` permitidos na validação do DTO
- Tamanho mínimo da senha: 8 caracteres
- O e-mail precisa ser único (imposto no banco por uma restrição de unicidade)

### Fluxo de login

```mermaid
sequenceDiagram
    participant Client as Cliente
    participant AuthController
    participant AuthService
    participant UsuarioRepo
    participant SessaoRepo
    participant DB
    
    Client->>AuthController: POST /auth/login<br/>{email, senha}
    AuthController->>AuthService: login(credentials)
    AuthService->>UsuarioRepo: findByEmail(email)
    UsuarioRepo->>DB: SELECT * FROM usuario WHERE email=?
    
    alt Usuário não encontrado ou sem senha_hash
        DB-->>UsuarioRepo: null ou Usuario sem senha_hash
        AuthService-->>Client: 401 Credenciais inválidas
    end
    
    DB-->>UsuarioRepo: Usuario
    AuthService->>AuthService: comparePassword(senha, senha_hash)
    alt Senha não confere
        AuthService-->>Client: 401 Credenciais inválidas
    end
    
    AuthService->>SessaoRepo: criar(usuario.id)
    SessaoRepo->>DB: INSERT INTO sessoes_auth
    DB-->>SessaoRepo: SessaoAuth
    
    AuthService->>AuthService: signAccessToken()<br/>signRefreshToken()
    AuthService-->>AuthController: {usuario, tokens}
    AuthController->>AuthController: setAuthCookies(res, tokens)
    AuthController-->>Client: 200 OK<br/>{id, nome, email, papel}<br/>+ cookies httpOnly
```

**Notas de segurança:**
- Mensagem de erro idêntica para "usuário não encontrado" e "senha errada" (impede a enumeração de e-mails)
- Usuários sem `senha_hash` são tratados como inexistentes (proteção da consistência do banco)

### Fluxo de renovação do token

```mermaid
sequenceDiagram
    participant Client as Cliente
    participant AuthController
    participant AuthService
    participant UsuarioRepo
    participant SessaoRepo
    participant DB
    
    Client->>AuthController: POST /auth/refresh<br/>Cookie: refresh_token
    AuthController->>AuthController: Extrai o refresh_token dos cookies
    alt Sem token de renovação
        AuthController-->>Client: 401 Refresh token ausente
    end
    
    AuthController->>AuthService: refresh(refreshToken)
    AuthService->>AuthService: verifyToken(token, 'refresh')
    alt Assinatura inválida ou expirado
        AuthService-->>Client: 401 Token inválido ou expirado
    end
    
    AuthService->>UsuarioRepo: findById(payload.sub)
    AuthService->>SessaoRepo: findById(payload.sid)
    
    par Verificações em paralelo
        UsuarioRepo->>DB: SELECT * FROM usuario WHERE id=?
    and
        SessaoRepo->>DB: SELECT * FROM sessoes_auth WHERE id=?
    end
    
    alt Usuário excluído ou sessão revogada
        AuthService-->>Client: 401 Token inválido ou expirado
    end
    
    AuthService->>AuthService: signAccessToken(usuario.id, papel, sessao.id)
    AuthService-->>AuthController: {accessToken}
    
    AuthController->>AuthController: setAccessCookie(res, accessToken)
    AuthController-->>Client: 200 OK<br/>{renewed: true}<br/>+ cookie access_token atualizado
```

**Comportamento crítico:**
- A renovação **não** cria uma nova sessão: ela renova o token de acesso dentro da sessão existente
- Se a sessão foi revogada (logout), a renovação falha com 401
- Isso impõe o logout de verdade no servidor (requisito da Fase 10)

### Fluxo de logout

```mermaid
sequenceDiagram
    participant Client as Cliente
    participant Middleware as requireAuth
    participant AuthController
    participant AuthService
    participant SessaoRepo
    participant DB
    
    Client->>Middleware: POST /auth/logout<br/>Cookie: access_token
    Middleware->>Middleware: Valida o token e a sessão
    Middleware->>AuthController: next() com req.usuario
    
    AuthController->>AuthService: logout(req.usuario.sessaoId)
    AuthService->>SessaoRepo: revogar(sessaoId)
    SessaoRepo->>DB: UPDATE sessoes_auth<br/>SET revogada_em = now()<br/>WHERE id = ?
    DB-->>SessaoRepo: Atualizado
    
    AuthController->>AuthController: clearAuthCookies(res)
    AuthController-->>Client: 200 OK<br/>{loggedOut: true}<br/>Cookies limpos
```

**Efeito da revogação:**
- As chamadas futuras do middleware `requireAuth` falham para esta sessão
- O `POST /auth/refresh` com o token de renovação falha
- O token de acesso ainda valida (assinatura JWT), mas a verificação da sessão o bloqueia
- Este é um logout com estado de verdade (em contraste com a abordagem sem estado da Fase 1)

---

## Gestão de sessões

### Ciclo de vida da sessão

```mermaid
stateDiagram-v2
    [*] --> Active: Login/Cadastro<br/>(criar)
    
    Active --> Active: Requisição dentro de 5min<br/>(sem escrita no banco)
    Active --> ActivityUpdated: Requisição depois de 5min<br/>(registrarAtividade)
    ActivityUpdated --> Active
    
    Active --> Revoked: Logout<br/>(revogar)
    Active --> Expired: 6 horas se passaram
    Active --> Idle: 1 hora sem atividade
    
    Revoked --> [*]
    Expired --> [*]
    Idle --> [*]
    
    note right of Active
        ultima_atividade_em
        atualizada a cada 5 minutos
    end note
    
    note right of Revoked
        revogada_em != null
    end note
```

### Schema do banco de dados

**Tabela SessaoAuth:**
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

**Relacionamentos:**
- Um usuário pode ter várias sessões (suporte a vários dispositivos)
- As sessões são excluídas em cascata quando o usuário é excluído
- Sem restrição de unicidade: logins simultâneos criam sessões separadas

### Estratégia de acompanhamento de atividade

**Objetivo:** equilibrar a precisão com a carga de escrita no banco de dados

**Implementação:**
```typescript
// Em SessaoAuthService.validar()
const agora = new Date();
const tempoDesdeUltimaAtualizacao = 
  agora.getTime() - sessao.ultima_atividade_em.getTime();

if (tempoDesdeUltimaAtualizacao > INTERVALO_REGISTRO_ATIVIDADE_MS) {
  await this.sessaoRepository.registrarAtividade(sessao.id, agora);
}
```

**Compromisso:**
- **Frequência de escrita:** no máximo uma vez a cada 5 minutos por sessão
- **Precisão:** a faixa efetiva do tempo de inatividade é de 1h a 1h05min (variação aceitável)
- **Benefício:** reduz drasticamente as escritas no banco para usuários ativos (12 escritas/hora → 1 escrita/5min)

---

## Recursos de segurança

### Segurança das senhas

**Algoritmo de hash:** bcrypt, por meio do `bcryptjs`
- **Rodadas de salt:** 10 (2^10 = 1024 iterações)
- **Localização:** `ide-web-backend/src/utils/password.ts`

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

**Armazenamento:** só o `senha_hash` é persistido; a senha em texto puro nunca é guardada

### Segurança dos tokens

**Gestão dos segredos JWT:**
- **Segredo principal:** variável de ambiente `JWT_SECRET` (assina os tokens de acesso e de renovação)
- **Segredo da pesquisa:** `RESEARCH_JWT_SECRET` (assina os tokens do backend de pesquisa)
- Os dois segredos precisam ser criptograficamente aleatórios (recomendado: 256+ bits)

**Expiração dos tokens:**
```typescript
// Da configuração (variáveis de ambiente)
config.jwt.accessExpiresIn   // Padrão: '15m'
config.jwt.refreshExpiresIn  // Padrão: '7d'
config.researchJwt.expiresIn // Padrão: '15m'
```

**Verificação da assinatura:**
- Todo token é validado antes de confiar no payload
- Assinaturas inválidas são rejeitadas com 401
- Tokens expirados são rejeitados com 401

### Segurança dos cookies

**Localização:** `ide-web-backend/src/utils/cookies.ts`

**Configuração dos cookies:**
```typescript
const baseCookieOptions = (maxAge: number): CookieOptions => ({
  httpOnly: true,      // Impede o acesso por JavaScript (proteção contra XSS)
  secure: IS_PRODUCTION, // Apenas HTTPS em produção
  sameSite: 'strict',  // Proteção contra CSRF
  maxAge,              // Milissegundos até expirar
  path: '/',           // Disponível em todo o site
});
```

**Nomes dos cookies:**
- `access_token`: carrega o JWT de acesso
- `refresh_token`: carrega o JWT de renovação

**Propriedades de segurança:**
- **HttpOnly:** protege contra ataques XSS (o JavaScript não consegue ler os cookies)
- **Secure (produção):** impede a transmissão por HTTP sem criptografia
- **SameSite=strict:** bloqueia cookies em requisições entre sites (defesa contra CSRF)

### Exigência de HTTPS

**Ambiente de produção:**
- A marca `secure: true` exige HTTPS
- Hospedagem: backend no Render (HTTPS automático)
- Veja o `docker-compose.yml` e as configurações de implantação na documentação de infraestrutura

---

## Endpoints da API

**Registro das rotas:** `ide-web-backend/src/routes/auth.routes.ts`

**Caminho base:** `/api/v1/auth` (prefixo configurado na aplicação principal)

| Método | Caminho | Autenticação exigida | Descrição |
|--------|------|---------------|-------------|
| `POST` | `/registrar` | Não | Cria uma nova conta de usuário (apenas aluno/professor) |
| `POST` | `/login` | Não | Autentica e recebe os tokens |
| `POST` | `/refresh` | Não* | Renova o token de acesso usando o token de renovação |
| `POST` | `/logout` | Sim | Revoga a sessão e limpa os cookies |
| `GET` | `/me` | Sim | Obtém o perfil do usuário atual |

**\*Nota sobre o /refresh:** não exige o middleware `requireAuth` (usa o token de renovação do cookie), mas ainda exige um token de renovação válido.

### Detalhes dos endpoints

#### POST /auth/registrar

**Corpo da requisição:**
```typescript
{
  nome: string;         // Mínimo de 1 caractere
  email: string;        // Formato de e-mail válido
  senha: string;        // Mínimo de 8 caracteres
  papel: 'aluno' | 'professor';  // Validação de enum
}
```

**Resposta (201 Created):**
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

**Casos de erro:**
- `400 ValidationError`: payload inválido (por exemplo, formato do e-mail, senha curta)
- `409 ConflictError`: e-mail já cadastrado

#### POST /auth/login

**Corpo da requisição:**
```typescript
{
  email: string;
  senha: string;
}
```

**Resposta (200 OK):**
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

**Casos de erro:**
- `400 ValidationError`: campos ausentes
- `401 UnauthorizedError`: credenciais inválidas (mesma mensagem para e-mail ou senha errados)

#### POST /auth/refresh

**Requisição:** exige o cookie `refresh_token`

**Resposta (200 OK):**
```typescript
{
  data: {
    renewed: true
  }
}
// + Set-Cookie: access_token (atualizado)
```

**Casos de erro:**
- `401 UnauthorizedError`: sem token de renovação nos cookies
- `401 UnauthorizedError`: token de renovação inválido/expirado
- `401 UnauthorizedError`: a sessão foi revogada (houve logout)

#### POST /auth/logout

**Requisição:** exige um cookie `access_token` válido

**Resposta (200 OK):**
```typescript
{
  data: {
    loggedOut: true
  }
}
// + Set-Cookie: access_token=; Max-Age=0
// + Set-Cookie: refresh_token=; Max-Age=0
```

**Efeito:**
- Define `sessoes_auth.revogada_em = now()` no banco de dados
- Limpa os dois cookies de autenticação
- As requisições seguintes com os mesmos tokens vão falhar

#### GET /auth/me

**Requisição:** exige um cookie `access_token` válido

**Resposta (200 OK):**
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

**Casos de erro:**
- `401 UnauthorizedError`: sem token de acesso / token inválido
- `404 NotFoundError`: o usuário foi excluído (caso limite)

---

## Modelo de dados

### Tabela Usuario

**Localização do schema:** `ide-web-backend/prisma/schema.prisma`

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
  // ... demais relações
}

enum Papel {
  aluno
  professor
  pesquisador
}
```

**Notas sobre os campos:**
- `email` e `senha_hash` são anuláveis no schema (herança da migração da Fase 8), mas são **exigidos pela validação dos DTOs**
- O enum `papel` tem três valores, mas o `pesquisador` não pode ser cadastrado publicamente
- O campo `matricula` não é usado no módulo de autenticação (reservado para integração futura)

### Tabela SessaoAuth

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

**Índices:**
- Chave primária em `id` (UUID)
- Índice em `usuario_id` para buscas eficientes de sessões por usuário

**Comportamento em cascata:**
- Quando um usuário é excluído, todas as suas sessões são excluídas automaticamente

### Diagrama entidade-relacionamento

```mermaid
erDiagram
    Usuario ||--o{ SessaoAuth : "tem sessões"
    
    Usuario {
        uuid id PK
        string nome
        string email UK "anulável no schema"
        string senha_hash "anulável no schema"
        enum papel "aluno|professor|pesquisador"
        string matricula "anulável"
        timestamp criado_em
    }
    
    SessaoAuth {
        uuid id PK
        uuid usuario_id FK
        timestamp criada_em
        timestamp ultima_atividade_em
        timestamp revogada_em "null = ativa"
    }
```

---

## Configuração

### Variáveis de ambiente

**Necessárias para a autenticação:**

```bash
# Configuração do JWT
JWT_SECRET=<segredo-aleatório-de-256-bits>   # Assina os tokens de acesso e de renovação
JWT_ACCESS_EXPIRES_IN=15m                    # Vida do token de acesso
JWT_REFRESH_EXPIRES_IN=7d                    # Vida do token de renovação

# Autenticação do backend de pesquisa
RESEARCH_JWT_SECRET=<segredo-separado-de-256-bits> # Assina os tokens de pesquisa
RESEARCH_JWT_EXPIRES_IN=15m                   # Vida do token de pesquisa

# Banco de dados
DATABASE_URL=postgresql://user:pass@host:port/db  # Projeto Supabase principal

# Ambiente
NODE_ENV=production|development               # Afeta a marca cookie.secure
```

**Carregamento da configuração:**
Centralizado em `ide-web-backend/src/config/index.ts` (não mostrado nos componentes principais, mas referenciado pelo jwt.ts)

### Vida dos cookies

**Cookie do token de acesso:**
- Max-Age: coincide com a expiração do JWT (padrão de 15 minutos)
- Renovado no refresh

**Cookie do token de renovação:**
- Max-Age: coincide com a expiração do JWT (padrão de 7 dias)
- Renovado apenas em um novo login

**Nota de segurança:** o max-age do cookie e o claim exp do JWT devem coincidir, para evitar ataques de temporização.

---

## Pontos de integração

### Integração com o frontend

**Comportamento esperado do frontend:**
1. **Login/Cadastro:** chama o endpoint e recebe os cookies automaticamente
2. **Requisições autenticadas:** envia os cookies em toda requisição (automático no navegador)
3. **Renovação do token em caso de 401:**
   - O frontend intercepta as respostas 401
   - Chama `POST /auth/refresh`
   - Refaz a requisição original com o novo token de acesso
   - Implementação em `ide-web-front/src/lib/httpClient.ts` (veja [frontend_auth](frontend_auth.md))

4. **Logout:** chama o endpoint e limpa o estado local

### Outros módulos do backend

**Padrão de uso:**
```typescript
// Em qualquer rota protegida
import { requireAuth } from '../middlewares/requireAuth';

router.get('/protected', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.usuario.id;        // Sempre disponível depois do middleware
  const userRole = req.usuario.papel;   // Para o controle de acesso por papel
  const sessionId = req.usuario.sessaoId; // Para operações específicas da sessão
  // ... lógica de negócio
}));
```

**Módulos que usam a autenticação:**
- [backend_exercicios](backend_exercicios.md): validação da posse do exercício
- [backend_turmas](backend_turmas.md): verificações de participação na turma
- [backend_sandbox_sql](backend_sandbox_sql.md): sandboxes de SQL por usuário
- [backend_painel](backend_painel.md): dados de painel específicos por papel
- [backend_pesquisa](backend_pesquisa.md): emissão do token de pesquisa

### Comunicação com o backend de pesquisa

**Fluxo:**
```mermaid
sequenceDiagram
    participant Frontend
    participant NodeBackend as Backend Node<br/>(este módulo)
    participant PythonBackend as Backend Python<br/>(self-hosted)
    
    Frontend->>NodeBackend: GET /pesquisa/token<br/>Cookie: access_token
    NodeBackend->>NodeBackend: requireAuth valida a sessão
    NodeBackend->>NodeBackend: signResearchToken({usuario_id, papel, turma_ids})
    NodeBackend-->>Frontend: {token: "eyJ..."}
    
    Frontend->>PythonBackend: POST /pesquisa/...<br/>Authorization: Bearer eyJ...
    PythonBackend->>PythonBackend: Verifica o JWT com RESEARCH_JWT_SECRET
    PythonBackend-->>Frontend: Dados da pesquisa
```

**Isolamento de segurança:**
- O backend de pesquisa tem um segredo JWT separado
- Os tokens de pesquisa **não** dão acesso ao backend Node principal
- Os tokens de acesso principais **não** funcionam no backend Python
- Veja [backend_pesquisa](backend_pesquisa.md) para o fluxo completo da pesquisa

---

## Tratamento de erros

### Tipos de erro

Todos os erros estendem classes do [backend_errors](backend_errors.md):

| Classe de erro | Status HTTP | Quando é lançada |
|-------------|-------------|-------------|
| `ValidationError` | 400 | Payload da requisição inválido (falha de validação do Zod) |
| `UnauthorizedError` | 401 | Token ausente/inválido, sessão revogada/expirada |
| `SessaoInvalidaError` | 401 | Falhas específicas da sessão (estende UnauthorizedError) |
| `NotFoundError` | 404 | Usuário não encontrado no endpoint `me()` |
| `ConflictError` | 409 | E-mail já cadastrado |

### Formato da resposta de erro

**Resposta de erro padrão:**
```typescript
{
  error: string;           // Mensagem legível por pessoas, em português
  status: number;          // Código de status HTTP
  details?: Array<{        // Presente no ValidationError
    path: string[];
    message: string;
  }>;
}
```

**Exemplo - erro de validação:**
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

**Exemplo - erro de sessão inválida:**
```json
{
  "error": "Sua sessão expirou por inatividade. Entre novamente.",
  "status": 401
}
```

---

## Considerações sobre testes

### Testes unitários

**Alvos de teste:**
- `AuthService`: simular (mock) os repositórios e verificar a lógica de negócio
- `SessaoAuthService`: testar os cálculos de tempo e os casos limite dos intervalos de 6h/1h/5min
- Utilitários de JWT: verificar a assinatura e a verificação dos tokens e o tratamento da expiração

**Exemplo de caso de teste:**
```typescript
describe('SessaoAuthService.validar', () => {
  it('should throw SessaoInvalidaError when session idle > 1 hour', async () => {
    const sessao = {
      id: 'session-123',
      ultima_atividade_em: new Date(Date.now() - 61 * 60 * 1000), // 61 minutos atrás
      revogada_em: null,
      criada_em: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 horas atrás
    };
    
    mockSessaoRepo.findById.mockResolvedValue(sessao);
    
    await expect(service.validar('session-123'))
      .rejects
      .toThrow(SessaoInvalidaError);
  });
});
```

### Testes de integração

**Requisitos de banco de dados:**
- Banco de teste com as tabelas `usuario` e `sessoes_auth`
- Use o serviço de teste do Docker Compose (veja o `docker-compose.yml`)

**Cenários de teste E2E:**
1. Cadastro → Login → Requisição autenticada
2. Login → Logout → Tentativa de requisição autenticada (deve falhar)
3. Login → Renovar token → Logout → Renovar token (deve falhar)
4. Login → Esperar 61 minutos → Requisição (deve falhar por inatividade)

---

## Histórico de migrações

### Fase 1 (JWT sem estado)
- Implementação inicial com autenticação apenas por JWT
- Sem acompanhamento de sessão no servidor
- O logout apenas limpava os cookies do cliente (os tokens continuavam válidos até expirar)

### Fase 8 (matrícula em várias turmas)
- Removidas as sessões leves de alunos (sem e-mail/senha)
- Todos os usuários agora se cadastram com e-mail e senha
- Acrescentada a `MatriculaTurma` para a matrícula em várias turmas
- Os tokens de pesquisa passam a carregar `turma_ids[]` em vez de um único `turma_id`

### Fase 10 (sessões com estado) - **implementação atual**
- Acrescentada a tabela `SessaoAuth` para o acompanhamento de sessões no servidor
- Implementado o logout de verdade por meio da revogação de sessão
- Acrescentadas as políticas de sessão: vida máxima de 6h, inatividade de 1h
- O middleware `requireAuth` agora valida o estado da sessão em toda requisição
- Acompanhamento de atividade com a otimização de intervalo de escrita de 5 minutos

**Arquivo de migração:** `ide-web-backend/prisma/migrations/.../add_sessoes_auth.sql`

---

## Considerações de desempenho

### Carga no banco de dados

**Por requisição autenticada:**
- 1 leitura: `SessaoAuth.findById()` no middleware `requireAuth`
- 1 escrita (condicional): `registrarAtividade()` se passaram mais de 5min desde a última atualização

**Otimização:**
- As atualizações de atividade são agrupadas em intervalos de 5 minutos
- Reduz as escritas de O(requisições) para O(requisições / 12) por hora
- O índice em `usuario_id` acelera as buscas de sessão

### Verificação de tokens

**Operações em memória:**
- Verificação da assinatura do JWT (criptográfica, ~1ms)
- Nenhum acesso ao banco para validar a assinatura
- O banco só é consultado para o estado da sessão

### Sobrecarga dos cookies

**Mínima:**
- JWTs compactos (tamanho típico: ~200 bytes por token)
- Enviados automaticamente pelo navegador (sem gestão manual de cabeçalhos)
- O HttpOnly impede o acesso por JavaScript (sem superfície de ataque XSS)

---

## Lista de verificação de auditoria de segurança

- [x] Senhas com hash bcrypt (10 rodadas)
- [x] JWTs assinados com segredo forte (256+ bits)
- [x] Tokens incluem claims de expiração
- [x] Cookies httpOnly (proteção contra XSS)
- [x] Cookies secure em produção (apenas HTTPS)
- [x] Cookies com sameSite=strict (proteção contra CSRF)
- [x] Revogação de sessão imposta no servidor
- [x] O tempo de inatividade impede sessões indefinidas
- [x] Vida máxima da sessão imposta (6 horas)
- [x] Tokens de pesquisa usam segredo separado (isolamento)
- [x] Enumeração de e-mails impedida (mesmo erro para e-mail ou senha errados)
- [x] Nenhuma senha em texto puro registrada em log ou guardada

---

## Solução de problemas

### Problemas comuns

**"Sessão inválida ou expirada" em toda requisição**
- **Causa:** o JWT_SECRET mudou entre a emissão e a verificação do token
- **Solução:** verifique se a variável de ambiente é consistente; os usuários precisam entrar de novo depois da troca do segredo

**"Sua sessão expirou por inatividade" depois de pouco tempo**
- **Causa:** defasagem dos relógios do sistema entre os servidores da aplicação
- **Solução:** garanta que todos os servidores usem sincronização de horário por NTP

**O token de renovação falha logo depois do login**
- **Causa:** o registro da sessão não foi confirmado (commit) antes da chamada de renovação
- **Solução:** verifique o isolamento de transações do banco; garanta que a criação da sessão seja confirmada antes de devolver os tokens

**O cookie não é enviado nas requisições**
- **Causa:** incompatibilidade de domínio/caminho ou bloqueio pela política SameSite
- **Solução:** verifique se frontend e backend estão no mesmo domínio em produção; confira a configuração do CORS

### Log de depuração

**Habilitar o modo de depuração:**
```typescript
// No middleware requireAuth (para desenvolvimento)
console.log('Access token:', accessToken);
console.log('JWT payload:', payload);
console.log('Session:', sessao);
```

**Inspeção do estado das sessões:**
```sql
-- Verifica as sessões ativas de um usuário
SELECT id, criada_em, ultima_atividade_em, revogada_em
FROM sessoes_auth
WHERE usuario_id = 'user-uuid'
ORDER BY criada_em DESC;
```

---

## Melhorias futuras

### Possíveis melhorias

1. **Lista de sessões para os usuários:**
   - Mostrar as sessões ativas no perfil do usuário
   - Permitir que os usuários revoguem sessões específicas (por exemplo, "sair dos outros dispositivos")

2. **Limitação de taxa:**
   - Limitar as tentativas de login por IP/e-mail
   - Impedir ataques de força bruta contra senhas

3. **Políticas de senha:**
   - Exigir complexidade da senha (maiúsculas, números, símbolos)
   - Expiração de senha por conformidade

4. **Autenticação em dois fatores (2FA):**
   - Baseada em TOTP (por exemplo, Google Authenticator)
   - Códigos de reserva para recuperação de conta

5. **Integração com OAuth:**
   - Login social (Google, GitHub)
   - SSO institucional (para a integração com o IFPI)

6. **Log de auditoria:**
   - Registrar todos os eventos de autenticação (login, logout, refresh)
   - Detectar padrões de atividade suspeita

---

## Referências

### Módulos relacionados
- [backend_core](backend_core.md) - BaseController, verificações de saúde
- [backend_errors](backend_errors.md) - hierarquia de classes de erro
- [backend_pesquisa](backend_pesquisa.md) - emissão e uso do token de pesquisa
- [frontend_auth](frontend_auth.md) - gestão do estado de autenticação no frontend

### Documentos de decisão
- `docs/decisions/fase1-setup-tecnico.md` - projeto inicial da autenticação JWT
- `docs/decisions/fase8-conta-do-aluno-matricula-estudo-livre.md` - matrícula em várias turmas
- `docs/decisions/fase10-professor-prova-sessao.md` - implementação da sessão com estado

### Documentação externa
- [JWT.io](https://jwt.io/) - especificação e depurador de JWT
- [bcryptjs npm](https://www.npmjs.com/package/bcryptjs) - biblioteca de hash de senhas
- [Prisma Client](https://www.prisma.io/docs/concepts/components/prisma-client) - documentação do ORM

---

**Responsável pelo módulo:** equipe de backend  
**Última atualização:** Fase 10 (sessões com estado)  
**Estado:** ✅ Pronto para produção

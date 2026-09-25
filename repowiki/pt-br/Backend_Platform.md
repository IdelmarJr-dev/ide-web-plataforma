# Módulo Backend Platform

**Localização**: `ide-web-backend/src`  
**Finalidade**: Camada de plataforma que fornece os padrões arquiteturais, o tratamento de erros e o monitoramento operacional da aplicação backend da IDE Web.

---

## Sumário

- [Visão geral](#visão-geral)
- [Arquitetura do módulo](#arquitetura-do-módulo)
- [Subsistemas principais](#subsistemas-principais)
- [Padrões de projeto](#padrões-de-projeto)
- [Padrões de integração](#padrões-de-integração)
- [Referência dos componentes](#referência-dos-componentes)
- [Módulos relacionados](#módulos-relacionados)

---

## Visão geral

### Finalidade

O módulo `Backend_Platform` é a base arquitetural de todo o backend da IDE Web. Ele estabelece:

1. **Padrões arquiteturais**: a organização em camadas MSC (Model-Service-Controller), usada em todos os serviços do backend
2. **Gestão de erros**: tratamento de erros tipado e compatível com HTTP, com mensagens ao usuário em português
3. **Monitoramento operacional**: sistema de verificação de saúde (health check) para a orquestração de contêineres e a confiabilidade do serviço
4. **Camada de consistência**: formato de resposta e propagação de erros uniformes em todos os endpoints da API

### Stack tecnológica

- **Runtime**: Node.js 20+ (Alpine Linux nos contêineres Docker)
- **Framework**: Express 4.x
- **Linguagem**: TypeScript com verificação estrita de tipos
- **Arquitetura**: padrão MSC (Model-Service-Controller)
- **ORM**: Prisma com adaptador PostgreSQL
- **Implantação**: contêineres Docker com monitoramento de saúde

### Características principais

- **Arquitetura em camadas**: separação clara entre HTTP, lógica de negócio e acesso a dados
- **Segurança de tipos**: tipagem TypeScript abrangente, dos DTOs aos modelos de domínio
- **Português em primeiro lugar**: todas as mensagens voltadas ao usuário em português do Brasil
- **Falhar rápido (fail-fast)**: distinção clara entre falhas transitórias e permanentes
- **Extensível**: oferece classes base abstratas para padrões de implementação consistentes

---

## Arquitetura do módulo

### Estrutura da camada de plataforma

```mermaid
graph TB
    subgraph "Camada de plataforma do backend"
        subgraph "backend_core"
            BC[BaseController]
            HS[Sistema de health check]
            MSC[Referência do padrão MSC]
        end
        
        subgraph "backend_errors"
            AE[Hierarquia AppError]
            EM[Middleware de erros]
            EC[Códigos de erro]
        end
    end
    
    subgraph "Serviços de aplicação"
        AUTH[backend_auth]
        EXER[backend_exercicios]
        SAND[backend_sandbox_sql]
        TURM[backend_turmas]
        PROV[backend_provas]
        REST[Outros serviços...]
    end
    
    subgraph "Infraestrutura"
        EXPRESS[Aplicação Express]
        ROUTER[Registro de rotas]
        DB[(PostgreSQL)]
    end
    
    BC -.serve de base para.-> AUTH
    BC -.serve de base para.-> EXER
    BC -.serve de base para.-> SAND
    BC -.serve de base para.-> TURM
    BC -.serve de base para.-> PROV
    BC -.serve de base para.-> REST
    
    AE -.lançado por.-> AUTH
    AE -.lançado por.-> EXER
    AE -.lançado por.-> SAND
    AE -.lançado por.-> TURM
    AE -.lançado por.-> PROV
    AE -.lançado por.-> REST
    
    HS --> ROUTER
    EM --> ROUTER
    
    ROUTER --> EXPRESS
    EXPRESS --> DB
    
    style BC fill:#e1f5ff
    style AE fill:#ff6b6b
    style HS fill:#a8dadc
    style EM fill:#4ecdc4
```

### Fluxo de requisição e resposta

```mermaid
sequenceDiagram
    autonumber
    
    participant Client as Cliente
    participant Express
    participant Middleware
    participant Controller
    participant Service
    participant Repository
    participant Database as Banco de dados
    participant ErrorHandler as Tratador de erros
    
    Client->>Express: Requisição HTTP
    Express->>Middleware: CORS, Body Parser, Cookie Parser
    Middleware->>Controller: Roteia para o controller específico
    
    alt Caminho de sucesso
        Controller->>Service: Operação de negócio
        Service->>Repository: Operação de dados
        Repository->>Database: Consulta/Mutação
        Database-->>Repository: Resultado
        Repository-->>Service: Objeto de domínio
        Service-->>Controller: Objeto de domínio
        Controller->>Controller: Converte para DTO
        Controller->>Controller: BaseController.handleSuccess()
        Controller-->>Client: 200 {data: {...}}
    else Caminho de erro
        Service->>Service: A validação falha
        Service--xController: lança uma subclasse de AppError
        Controller--xErrorHandler: Exceção não tratada
        ErrorHandler->>ErrorHandler: Verifica instanceof AppError
        ErrorHandler->>ErrorHandler: Extrai statusCode e code
        ErrorHandler-->>Client: 4xx/5xx {error: "...", code: "..."}
    end
```

---

## Subsistemas principais

O módulo `Backend_Platform` é composto por dois subsistemas principais:

### 1. backend_core: a base arquitetural

**Finalidade**: fornece os padrões estruturais e o monitoramento de saúde sobre os quais todos os serviços do backend são construídos.

**Componentes principais**:
- **BaseController**: classe base abstrata para um tratamento uniforme das respostas HTTP
- **Sistema de health check**: monitoramento de processo sem estado, para a orquestração de contêineres
- **Referência do padrão MSC**: implementação completa que demonstra a organização em camadas

**Integração**: todo controller de domínio do sistema estende o `BaseController`, herdando a formatação padronizada das respostas e estabelecendo um contrato de API consistente.

**Documentação**: veja [backend_core.md](backend_core.md) para as especificações detalhadas dos componentes.

### 2. backend_errors: a gestão de erros

**Finalidade**: hierarquia de erros centralizada, que oferece um tratamento de erros tipado e compatível com HTTP, com mensagens ao usuário em português.

**Componentes principais**:
- **Hierarquia AppError**: classe base com subclasses especializadas para cada categoria de erro
- **Códigos de erro**: identificadores legíveis por máquina, para o tratamento programático de erros
- **Middleware de erros**: tratador global que transforma exceções em respostas HTTP

**Integração**: todos os serviços do backend lançam subclasses de `AppError`, que são capturadas automaticamente e transformadas em respostas de erro HTTP bem formatadas.

**Documentação**: veja [backend_errors.md](backend_errors.md) para a referência completa dos tipos de erro.

---

## Padrões de projeto

### Padrão MSC (Model-Service-Controller)

A plataforma impõe uma organização em camadas estrita em todos os serviços do backend:

```mermaid
graph TD
    A[Requisição HTTP] --> B[Camada de roteamento]
    B --> C[Camada de controller<br/>tratamento do protocolo HTTP]
    C --> D[Camada de serviço<br/>lógica de negócio]
    D --> E[Camada de repositório<br/>acesso a dados]
    E --> F[Fonte de dados<br/>PostgreSQL via Prisma]
    
    C -.herda.-> G[BaseController<br/>backend_core]
    C -.lança.-> H[Subclasses de AppError<br/>backend_errors]
    C -.usa.-> I[DTO/Validação<br/>schemas Zod]
    D -.lança.-> H
    E -.lança.-> H
    
    H -.capturado por.-> J[Middleware de erros<br/>backend_errors]
    J --> K[Resposta de erro HTTP]
    
    style G fill:#e1f5ff
    style H fill:#ff6b6b
    style J fill:#4ecdc4
    style C fill:#fff4e1
    style D fill:#ffe1f5
    style E fill:#e1ffe1
```

**Responsabilidades das camadas**:

| Camada | Responsabilidade | Tratamento de erros | Exemplo |
|-------|---------------|----------------|---------|
| **Controller** | Protocolo HTTP, mapeamento de requisição e resposta | Propaga `AppError` | `ExercicioController.buscar()` |
| **Service** | Lógica de negócio, orquestração | Lança `ValidationError`, `ForbiddenError` | `ExercicioService.criar()` |
| **Repository** | Acesso a dados, construção de consultas | Lança `NotFoundError`, `SandboxIndisponivelError` | `ExercicioRepository.findById()` |
| **Model** | Entidades de domínio, objetos de valor | Sem lógica de erro | `Exercicio`, `HealthStatus` |
| **DTO** | Contratos da API, validação com Zod | Erros de validação → `ValidationError` | `CreateExercicioDto` |

### Padrão de injeção de dependências

**Injeção manual por construtor**:

```typescript
// Padrão dos arquivos de rota (aplicado em todas as rotas de domínio)
const repository = new ConcreteRepository();
const service = new ConcreteService(repository);
const controller = new ConcreteController(service);

export const routes = Router();
routes.get('/resource', asyncHandler((req, res) => controller.method(req, res)));
```

**Benefícios**:
- Grafo de dependências explícito (sem contêiner de DI "mágico")
- Fácil de testar (mocks das interfaces em qualquer camada)
- Ordem de inicialização clara
- Rastreável por análise estática

### Estratégia de propagação de erros

```mermaid
graph TD
    A[Camada de repositório] -->|lança NotFoundError| B[Camada de serviço]
    B -->|propaga sem alterar| C[Camada de controller]
    
    D[Camada de serviço] -->|lança ValidationError| C
    E[Middleware requireAuth] -->|lança UnauthorizedError| C
    
    C -->|exceção não tratada| F[Middleware de erros do Express]
    
    F -->|instanceof AppError?| G{Verifica o tipo}
    G -->|Sim| H[Extrai statusCode, code, message]
    G -->|Não| I[500 Internal Server Error]
    
    H --> J["Formata a resposta JSON<br/>{error, code, details?}"]
    I --> K[Registra a pilha + resposta genérica]
    
    J --> L[Resposta HTTP ao cliente]
    K --> L
    
    style F fill:#4ecdc4
    style G fill:#ffe66d
    style H fill:#a8dadc
    style I fill:#ffe1e1
```

**Princípios principais**:

1. **Nunca capturar internamente**: serviços e repositórios lançam os erros, não os capturam
2. **Roteamento por tipo**: o middleware de erros roteia por `instanceof AppError`
3. **Mapeamento automático de status**: cada classe de erro define o seu status HTTP
4. **Mensagens em português**: todas as mensagens de erro chegam ao usuário final em português
5. **Códigos estruturados**: códigos legíveis por máquina para o tratamento programático no frontend

---

## Padrões de integração

### Sequência de inicialização da aplicação

```mermaid
sequenceDiagram
    autonumber
    
    participant Compose as Docker Compose
    participant DB as PostgreSQL
    participant App as Aplicação Express
    participant Platform as Backend Platform
    participant Services as Serviços de aplicação
    participant Health as Endpoint de saúde
    
    Compose->>DB: Inicia os contêineres dos bancos
    loop A cada 5s (até 10 tentativas)
        DB->>DB: Verificação de saúde pg_isready
    end
    DB-->>Compose: A verificação de saúde passa
    
    Compose->>App: Inicia o contêiner do backend
    App->>Platform: Inicializa a camada de plataforma
    Platform->>Platform: Registra o BaseController
    Platform->>Platform: Registra o middleware de erros
    Platform->>Platform: Inicializa o sistema de saúde
    
    App->>Services: Inicializa os serviços de domínio
    Services->>Services: Cria os repositórios
    Services->>Services: Cria as instâncias dos serviços
    Services->>Services: Cria os controllers
    
    App->>App: Registra as rotas
    App-->>Compose: Servidor ouvindo em :3000
    
    Note over Health: As verificações de saúde agora estão ativas
    Health-->>Compose: GET /api/v1/health → "up"
```

### Ordem da pilha de middlewares

Em `ide-web-backend/src/app.ts`:

```mermaid
graph TD
    A[Requisição recebida] --> B[1. Middleware CORS]
    B --> C[2. Body Parser express.json]
    C --> D[3. Cookie Parser]
    D --> E[4. Rotas da aplicação]
    
    E -->|/api/v1/health| F[Rota de saúde<br/>Sem autenticação]
    E -->|/api/v1/auth/*| G[Rotas de autenticação]
    E -->|/api/v1/*| H[Rotas protegidas<br/>middleware requireAuth]
    E -->|Nenhuma corresponde| I[5. notFoundHandler]
    
    F --> J[Resposta]
    G --> J
    H --> J
    I --> K[6. errorHandler]
    
    H -.lança AppError.-> K
    G -.lança AppError.-> K
    K --> J
    
    style F fill:#e1ffe1
    style K fill:#4ecdc4
    style I fill:#fff4e1
```

**Justificativa**:
- **Saúde primeiro**: o `/api/v1/health` é registrado antes da autenticação para permitir o monitoramento sem autenticação
- **Tratador de erros por último**: captura todos os erros não tratados dos middlewares e rotas anteriores
- **Not found antes dos erros**: garante que rotas desconhecidas recebam 404, e não 500

---

## Referência dos componentes

### BaseController (backend_core)

**Finalidade**: classe base abstrata que oferece uma formatação de resposta uniforme.

**Contrato**:
```typescript
abstract class BaseController {
  protected handleSuccess(res: Response, data: unknown, statusCode: number = 200): void;
}
```

**Uso**:
```typescript
export class ExercicioController extends BaseController {
  buscar = async (req: Request, res: Response): Promise<void> => {
    const exercicio = await this.exercicioService.buscar(req.params.id);
    this.handleSuccess(res, toExercicioDto(exercicio));
  };
}
```

**Formato da resposta**: todas as respostas de sucesso seguem o envelope `{ data: T }`.

**Documentação**: [backend_core.md § BaseController](backend_core.md#basecontroller)

---

### Sistema de health check (backend_core)

**Finalidade**: endpoint de saúde sem dependências, para a orquestração de contêineres.

**Endpoint**: `GET /api/v1/health`

**Resposta**:
```json
{
  "data": {
    "status": "up" | "degraded" | "down",
    "uptimeSeconds": 127.483,
    "checkedAt": "2026-09-22T14:32:15.823Z"
  }
}
```

**Lógica de estados**:
- `degraded`: tempo de atividade do processo < 5 segundos (fase de inicialização)
- `up`: tempo de atividade do processo ≥ 5 segundos (operacional)
- `down`: reservado para uso futuro (verificações de conectividade com o banco)

**Dependências**: nenhuma (usa apenas `process.uptime()`)

**Documentação**: [backend_core.md § Sistema de health check](backend_core.md#sistema-de-health-check)

---

### Hierarquia AppError (backend_errors)

**Finalidade**: classes de erro tipadas que mapeiam falhas de domínio para respostas HTTP.

**Classe base**:
```typescript
abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
}
```

**Subclasses**:

| Classe | Status | Código | Caso de uso |
|-------|--------|------|----------|
| `ValidationError` | 400 | `VALIDATION_ERROR` | Validação de entrada, erros do Zod |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` | JWT inválido ou ausente, sessão expirada |
| `ForbiddenError` | 403 | `FORBIDDEN` | Violações de papel ou de permissão |
| `NotFoundError` | 404 | `NOT_FOUND` | Recurso não encontrado no banco |
| `ConflictError` | 409 | `CONFLICT` | Recursos duplicados, conflitos de estado |
| `TooManyRequestsError` | 429 | `TOO_MANY_REQUESTS` | Limitação de taxa, cota esgotada |
| `SandboxIndisponivelError` | 503 | `SANDBOX_UNAVAILABLE` | Falha de conexão com o banco do sandbox SQL |
| `LlmIndisponivelError` | 503 | `LLM_UNAVAILABLE` | Falha transitória do provedor de LLM |
| `LlmNaoConfiguradoError` | 503 | `LLM_NAO_CONFIGURADO` | `LLM_API_KEY` ausente (permanente) |

**Documentação**: [backend_errors.md § Hierarquia de classes de erro](backend_errors.md#hierarquia-de-classes-de-erro)

---

### Middleware de erros (backend_errors)

**Finalidade**: tratador global de erros que transforma exceções em respostas HTTP.

**Localização**: `ide-web-backend/src/middlewares/errorHandler.ts`

**Fluxo lógico**:

```mermaid
graph TD
    A[Erro não tratado] --> B{instanceof AppError?}
    B -->|Sim| C[Extrai statusCode e code]
    B -->|Não| D[Assume 500]
    
    C --> E{ValidationError com details?}
    E -->|Sim| F[Inclui o campo details]
    E -->|Não| G[Formato de erro padrão]
    
    F --> H[res.status.json]
    G --> H
    D --> I[Registra a pilha de execução]
    I --> J[Resposta 500 genérica]
    J --> H
    
    style B fill:#ffe66d
    style C fill:#a8dadc
    style D fill:#ffe1e1
```

**Formato da resposta**:
```typescript
// Sucesso (vindo do BaseController)
{ data: T }

// Erro (vindo do errorHandler)
{ error: string, code: string, details?: unknown }
```

**Documentação**: [backend_errors.md § Middleware de erros](backend_errors.md#fluxo-do-erro-pela-aplicação)

---

## Módulos relacionados

### Serviços de aplicação dependentes

Todos os serviços de aplicação do backend são construídos sobre a camada de plataforma:

- **[backend_auth](backend_auth.md)**: gestão de sessão, validação de JWT
  - Usa: `BaseController`, `UnauthorizedError`, `ForbiddenError`
  
- **[backend_exercicios](backend_exercicios.md)**: CRUD de exercícios, regras de visibilidade
  - Usa: `BaseController`, `NotFoundError`, `ValidationError`, `ForbiddenError`
  
- **[backend_sandbox_sql](backend_sandbox_sql.md)**: sandbox de execução de SQL
  - Usa: `BaseController`, `SandboxIndisponivelError`, `ValidationError`
  
- **[backend_turmas](backend_turmas.md)**: gestão de turmas, matrícula
  - Usa: `BaseController`, `NotFoundError`, `ConflictError`
  
- **[backend_provas](backend_provas.md)**: criação de provas, atribuição a alunos
  - Usa: `BaseController`, `NotFoundError`, `ConflictError`
  
- **[backend_resultado](backend_resultado.md)**: correção de exercícios, devolutiva
  - Usa: `BaseController`, `NotFoundError`, `ForbiddenError`
  
- **[backend_painel](backend_painel.md)**: agregação dos painéis
  - Usa: `BaseController`, `NotFoundError`, `ForbiddenError`
  
- **[backend_dica_ia](backend_dica_ia.md)**: dicas geradas por LLM
  - Usa: `BaseController`, `LlmNaoConfiguradoError`, `LlmIndisponivelError`, `TooManyRequestsError`
  
- **[backend_pacote](backend_pacote.md)**: geração de relatório em PDF
  - Usa: `BaseController`, `NotFoundError`, `ForbiddenError`
  
- **[backend_modelagem](backend_modelagem.md)**: persistência de diagramas ER
  - Usa: `BaseController`, `NotFoundError`, `ValidationError`
  
- **[backend_pesquisa](backend_pesquisa.md)**: coleta de dados da pesquisa
  - Usa: `BaseController`, `NotFoundError`, `ForbiddenError`

### Dependências de infraestrutura

- **[infrastructure](infrastructure.md)**: orquestração com Docker Compose
  - As verificações de saúde da plataforma se integram às condições `depends_on`
  
- **[backend_build_config](backend_build_config.md)**: configuração do TypeScript
  - A verificação estrita de tipos faz valer os contratos da plataforma

---

## Resumo

O módulo `Backend_Platform` estabelece a base arquitetural do backend da IDE Web:

✅ **Padrões consistentes**: organização em camadas MSC imposta pelo `BaseController` e pela injeção de dependências  
✅ **Erros tipados**: hierarquia de erros abrangente, com códigos de status compatíveis com HTTP  
✅ **Experiência em português**: todas as mensagens voltadas ao usuário em português do Brasil gramaticalmente correto  
✅ **Confiabilidade operacional**: verificações de saúde sem dependências para a orquestração de contêineres  
✅ **Experiência do desenvolvedor**: abstrações claras que evitam erros comuns e garantem a consistência da API  

Todo serviço do backend é construído sobre esta base, resultando numa base de código sustentável e previsível, alinhada às diretrizes arquiteturais do projeto (veja o `CLAUDE.md` para a documentação completa da arquitetura).

---

**Versão do documento**: 1.0  
**Última atualização**: 2026-09-22  
**Cobertura do módulo**: completa até a Fase 10 (plataforma totalmente implementada)

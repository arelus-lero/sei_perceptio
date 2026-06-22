# RNF-005 — Pool de conexões e teste de carga

Requisito: **≥ 100 usuários simultâneos** sem degradação significativa ([RNF-005](../docs/requisitos_sei_perceptio.md)).

## 1. Configuração do pooler Supabase

### Local (`supabase/config.toml`)

| Parâmetro | Valor | Motivo |
|-----------|-------|--------|
| `[db.pooler].enabled` | `true` | Validar pool localmente antes do deploy |
| `pool_mode` | `transaction` | Compatível com PostgREST / queries curtas |
| `default_pool_size` | `25` | Conexões reais ao Postgres por tenant DB |
| `max_client_conn` | **`150`** | Margem ~50% acima de 100 VUs (cada instância Next abre várias conexões HTTP ao PostgREST, não 1:1 ao pool) |

Após alterar:

```bash
supabase stop && supabase start
```

Conexão via pooler local (porta **54329**):

```bash
postgresql://postgres:postgres@127.0.0.1:54329/postgres
```

### Produção (Supabase Dashboard)

1. **Project Settings → Database → Connection pooling**
2. Mode: **Transaction**
3. **Pool size**: 25–40 (ajustar ao compute; Micro ≈ 15, Small ≈ 25)
4. **Max client connections**: **≥ 150** (nunca ≤ 100 se alvo = 100 VUs)
5. App Next.js: usar URI **pooler** (`*.pooler.supabase.com:6543`), não a conexão direta `:5432`

Variáveis recomendadas:

```env
# Drizzle / scripts server-side (pooler)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

## 2. Teste de carga (100 VUs)

### Pré-requisitos

- App em execução (`npm run build && npm run start`)
- Usuário de teste com notebook indexado
- [k6](https://k6.io/docs/get-started/installation/) **ou** Node 20+ (autocannon)

### Variáveis (`.env.local`)

```env
LOAD_TEST_EMAIL=analista@example.com
LOAD_TEST_PASSWORD=...
LOAD_TEST_NOTEBOOK_ID=<uuid-notebook-com-fontes>
LOAD_TEST_BASE_URL=http://localhost:3000
# Opcional: nome exato do cookie Supabase (dev tools → Application)
# LOAD_TEST_COOKIE_NAME=sb-<project-ref>-auth-token
```

### Passo 1 — Autenticação

```bash
node scripts/load/prepare-auth.mjs
```

Gera `scripts/load/.env.loadtest` (gitignored).

### Passo 2a — k6 (recomendado)

```bash
k6 run --env-file scripts/load/.env.loadtest scripts/load/rnf-005-k6.js
```

Cenário padrão:

- **100 VUs** constantes por **2 min**
- ~50% `GET /dashboard` + API processos; ~50% `POST /api/chat` (SSE)
- Thresholds: dashboard **P95 ≤ 3s**, chat **P95 ≤ 15s** (RNF-001 / RNF-004)

Customizar:

```bash
k6 run --env-file scripts/load/.env.loadtest \
  -e VUS=100 \
  -e LOAD_TEST_DURATION=3m \
  -e DASHBOARD_WEIGHT=0.6 \
  scripts/load/rnf-005-k6.js
```

Saída: JSON no stdout + `docs/rnf-005-load-test-results.md` (sobrescreve após cada run).

### Passo 2b — autocannon (alternativa)

```bash
npm install -D autocannon   # uma vez
node scripts/load/rnf-005-autocannon.mjs
```

100 conexões simultâneas por 30s em dashboard e API; chat se `NOTEBOOK_ID` estiver definido.

## 3. Resultados de referência

> Execute localmente ou em staging e preencha após cada baseline. Valores abaixo são **template** até a primeira execução documentada.

| Data | Ambiente | VUs | Dashboard P95 | Chat P95 | Erros | Pool max_client |
|------|----------|-----|-----------------|----------|-------|-----------------|
| _YYYY-MM-DD_ | local / staging | 100 | _ms_ | _ms_ | _%_ | 150 |

### Critérios de aceite

| Métrica | Alvo |
|---------|------|
| Dashboard (`GET /dashboard` ou RPC) | P95 ≤ **3s** (RNF-004) |
| Chat (`POST /api/chat`, SSE completo) | P95 ≤ **15s** (RNF-001) |
| Taxa de erro HTTP | < **5%** |
| Pooler | `max_client_conn` ≥ **150** com 100 VUs |

### Interpretação

- **Dashboard lento**: verificar `get_dashboard_stats` (EXPLAIN em `scripts/perf/dashboard-explain.sql`), índice `idx_processo_orgao`.
- **Chat lento**: retrieval/embed/LLM — ver `CHAT_PIPELINE_TIMEOUT_MS`, cache RAG (RNF-001).
- **Erros 401**: cookie Supabase inválido — refazer `prepare-auth.mjs` ou ajustar `LOAD_TEST_COOKIE_NAME`.
- **Pool exhausted**: aumentar `max_client_conn` ou `default_pool_size`; reduzir conexões diretas `:5432`.

## 4. Arquivos relacionados

| Arquivo | Descrição |
|---------|-----------|
| `supabase/config.toml` | Pooler local |
| `scripts/load/rnf-005-k6.js` | Cenário k6 principal |
| `scripts/load/rnf-005-autocannon.mjs` | Alternativa autocannon |
| `scripts/load/prepare-auth.mjs` | Sessão de teste |
| `docs/rnf-005-load-test-results.md` | Último relatório gerado |

# SEI-Perceptio — Cursor Rules Setup

## Versão 2.1 otimizada para Cursor Agent Mode (2026)

Este pacote contém as regras de contexto para o editor Cursor (AI-powered IDE) gerar código consistente e correto para o projeto **SEI-Perceptio** — uma plataforma tipo NotebookLM para análise inteligente de processos do SEI (ANEEL) usando RAG.

---

## 📁 Estrutura dos Arquivos

### Formato Moderno (Recomendado): `.cursor/rules/*.mdc`

O Cursor 2.6+ usa o formato `.mdc` (Markdown with YAML frontmatter) para regras com controle de ativação inteligente:

| Arquivo | Modo de Ativação | Descrição |
|---------|-----------------|-----------|
| `01-meta-rules.mdc` | `alwaysApply: true` | Comportamento do agente, segurança, meta-regras |
| `02-stack.mdc` | `alwaysApply: true` | Stack fixo, versões, APIs proibidas |
| `03-architecture.mdc` | `alwaysApply: true` | Estrutura de diretórios, nomenclatura |
| `04-react-components.mdc` | `globs: ["src/**/*.tsx"]` | Regras de componentes React |
| `05-api-routes.mdc` | `globs: ["src/app/api/**/*.ts"]` | Regras de API Routes |
| `06-database.mdc` | Intelligent | Drizzle ORM, schema, RLS |
| `07-rag-pipeline.mdc` | Intelligent | Chunking, embeddings, retrieval, generation |
| `08-ingestion-seed.mdc` | Intelligent | Pipeline de ingestão, seed data |
| `09-auth-rbac.mdc` | Intelligent | Autenticação, autorização, middleware |
| `10-governance.mdc` | Intelligent | LGPD, governança, conformidade |
| `11-roadmap.mdc` | Manual | Roadmap de implementação, checklist |

### Formato Legado (Compatibilidade): `.cursorrules`

Arquivo monolítico para compatibilidade com versões antigas do Cursor. É ignorado pelo Agent Mode moderno.

---

## 🚀 Como Usar

### 1. Copiar para o projeto

```bash
# Copiar a pasta .cursor/ para a raiz do projeto
cp -r .cursor/ /caminho/do/sei-perceptio/

# Copiar o .cursorrules legado (opcional)
cp .cursorrules /caminho/do/sei-perceptio/
```

### 2. Verificar no Cursor

- As regras `.mdc` são carregadas automaticamente pelo Cursor 2.6+
- Vá em **Settings > General > Rules for AI** para verificar
- Regras `alwaysApply` são injetadas em TODA interação
- Regras com `globs` ativam apenas quando arquivos correspondentes estão em contexto
- Regras "Intelligent" são incluídas quando o agente julga relevante
- Regras "Manual" são ativadas com `@nome-da-regra` no chat

### 3. Ordem de Precedência

```
Team Rules (highest) > Project Rules (.cursor/rules/) > User Rules (Settings)
```

---

## 🧠 Design das Regras

### Por que dividir em múltiplos arquivos?

Seguindo as melhores práticas de 2026 citeweb_search:12#0:

1. **Token Budget**: Cada regra consome tokens da janela de contexto. Regras `alwaysApply` devem ficar abaixo de ~2.000 tokens combinadas.
2. **Escopo Preciso**: Regras com `globs` ativam apenas quando relevantes, evitando instruções desnecessárias.
3. **Manutenibilidade**: Arquivos focados são mais fáceis de atualizar quando o projeto evolui.
4. **Colaboração**: `.cursor/rules/` deve estar no Git para o time compartilhar padrões.

### Estratégia de Ativação

| Tipo | Uso | Exemplo |
|------|-----|---------|
| Always Apply | Convenções universais | TypeScript strict, versões fixas |
| Glob Scoping | Padrões por tipo de arquivo | Regras React para `.tsx`, API para `api/**/*.ts` |
| Intelligent | Decisões arquiteturais | Quando usar server vs client components |
| Manual (@mention) | Guias raramente usados | Roadmap completo, debugging checklists |

---

## 🔒 Regras de Segurança Críticas

As seguintes regras são **absolutas** e nunca devem ser violadas:

1. **NUNCA** usar `service_role` key no client-side
2. **NUNCA** criar tabelas adicionais sem approval
3. **NUNCA** usar ORM diferente de Drizzle
4. **NUNCA** armazenar embeddings via API externa
5. **NUNCA** omitir políticas RLS
6. **NUNCA** usar `any` em TypeScript
7. **SEMPRE** incluir selo de IA nas respostas do chat
8. **SEMPRE** validar inputs com Zod

---

## 📋 Checklist de Verificação Pós-Código

Após o Cursor gerar qualquer arquivo, verifique:

- [ ] Inputs validados com Zod?
- [ ] `createServerClient` nas API Routes?
- [ ] `createBrowserClient` nos componentes client?
- [ ] `orgao_id` verificado do JWT?
- [ ] Streaming SSE para respostas do chat?
- [ ] `cn()` em todos os componentes?
- [ ] Named exports (exceto pages)?
- [ ] Erros tratados com try/catch?
- [ ] Selo de IA presente?
- [ ] RLS habilitado em novas tabelas?

---

## 📚 Stack Tecnológico

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework | Next.js (App Router) | 15+ |
| Linguagem | TypeScript | 5.6+ |
| UI | shadcn/ui + Tailwind CSS | latest / 4 |
| Banco | Supabase (PostgreSQL 16 + pgvector) | managed |
| ORM | Drizzle ORM | 0.36+ |
| Auth | Supabase Auth (JWT + RLS) | built-in |
| Storage | Supabase Storage | built-in |
| Realtime | Supabase Realtime | built-in |
| Embeddings | gte-small (384d) | Edge Function |
| LLM | Modelo nacional PBIA ou OpenAI-compatible | API Route |
| OCR | Tesseract.js | API Route |
| Anonimização | Presidio / spaCy NER | API Route |
| Agendamento | Inngest | 3.22+ |

---

## 📝 Referências

- [Cursor Rules Best Practices 2026](https://www.morphllm.com/cursor-rules-best-practices) citeweb_search:12#0
- [The Best Cursor Rules for Every Framework](https://www.neura.market/directories/cursor/blog/devto-3324538) citeweb_search:12#1
- [Cursor AI Best Practices Guide 2026](https://www.vibecodingacademy.ai/blog/cursor-ai-best-practices-guide-2026) citeweb_search:12#2
- [cursorrules 2026 Best Practices (GitHub)](https://github.com/murataslan1/cursor-ai-tips/blob/main/rules/cursorrules-2026-best-practices.md) citeweb_search:12#3

---

**Versão**: 2.1 | **Data**: 2026-06-16 | **Baseado em**: Especificação Técnica SEI-Perceptio v2.0

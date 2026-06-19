# SEI-Perceptio — Requisitos para Ferramenta de Análise, Monitoramento e Consulta de Processos SEI via RAG

> **Versão**: 1.5
> **Data**: 15/06/2026
> **Alteração**: Substituição do serviço autônomo de web-scraping por dados mocados (seed data). Atualização das seções 1.2, 2.1, 2.2, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, UC-02, Fase 2, Riscos e Critérios de Aceitação. Remoção de instruções de parsing HTML e referências a scraper.
> **Histórico**: v1.5 — Substituição de web-scraping por dados mocados (seed data); v1.4 — Validação cruzada com regras de negócio v3.1; v1.3 — Validação lógica e de integração cruzada; v1.2 — Ajuste da stack para Supabase + Next.js; v1.1 — Web-scraping independente (substituído na v1.5)
> **Classificação**: Requisitos Funcionais e Não Funcionais
> **Projeto**: SEI-Perceptio
> **Escopo**: Plataforma tipo NotebookLM para análise inteligente, monitoramento contínuo e consulta preditiva de processos do Sistema Eletrônico de Informações (SEI) — ANEEL

---

## 1. Visão Geral e Justificativa

### 1.1 Objetivo

Especificar os requisitos para a construção do **SEI-Perceptio**, plataforma nacional e soberana, inspirada no Google NotebookLM, destinada à análise inteligente, ao monitoramento contínuo e à consulta preditiva de processos administrativos eletrônicos do Sistema Eletrônico de Informações (SEI), utilizando a arquitetura de Retrieval-Augmented Generation (RAG). O SEI-Perceptio deve permitir que servidores públicos ingiram documentos processuais, realizem consultas em linguagem natural, gerem sínteses analíticas e monitorem automaticamente andamentos de processos, eliminando a dependência de plataformas de nuvem estrangeiras e garantindo a soberania dos dados governamentais.

### 1.2 Contexto e Motivação

O SEI consolidou-se como a infraestrutura tecnológica central para a gestão de processos e documentos administrativos na Administração Pública brasileira, sob coordenação do Ministério da Gestão e da Inovação em Serviços Públicos (MGI). Contudo, o SEI é um ecossistema nativamente fechado, projetado para garantir a integridade e o sigilo de dados governamentais, o que dificulta a análise inteligente em larga escala de seus processos.

A emergência de ferramentas de IA Generativa como o Google NotebookLM demonstrou o potencial da arquitetura RAG para mitigar a sobrecarga de trabalho dos agentes públicos, permitindo o processamento célere de extensos volumes documentais. O NotebookLM diferencia-se de assistentes genéricos por ancorar todas as interações nas fontes informadas pelo usuário, minimizando alucinações. Contudo, sua utilização no contexto do SEI apresenta limitações críticas: inexistência de integração direta, fluxo manual de exportação/ingestão, dependência de infraestrutura de nuvem estrangeira e restrições legais impostas pela LGPD e pela Portaria MGI nº 3.485/2026.

O SEI-Perceptio soluciona esses problemas ao oferecer uma plataforma nativa alimentada por **dados mocados** (seed data) que replicam fielmente a estrutura de processos do SEI, sem necessidade de integração direta com a aplicação do SEI. Os dados são carregados diretamente no banco de dados (PostgreSQL do Supabase) por meio de scripts de seed, refletindo processos, documentos, andamentos, anexações e consultas públicas com base nas regras de negócio validadas. Sobre esses dados, o módulo de RAG do SEI-Perceptio opera para consultas em linguagem natural, sínteses analíticas e monitoramento. Todo o processamento ocorre em infraestrutura soberana, conforme diretrizes do Plano Brasileiro de Inteligência Artificial (PBIA).

### 1.3 Partes Interessadas

| Papel | Descrição | Interesse Principal |
|-------|-----------|---------------------|
| **Gestor de TIC (CIO)** | Responsável pela infraestrutura tecnológica do órgão | Segurança, soberania, custo, integração com SEI |
| **Encarregado de Dados (DPO)** | Responsável pela proteção de dados pessoais | Conformidade LGPD, anonimização, DPIA |
| **Servidor Público (Analista)** | Usuário final do SEI-Perceptio | Produtividade, precisão analítica, facilidade de uso |
| **Procurador Jurídico** | Responsável pela conformidade legal | Aderência normativa, rastreabilidade, supervisão humana |
| **Administrador do SEI** | Gestor do sistema SEI no órgão | Integridade dos dados mocados fornecidos para alimentação da plataforma |

---

## 2. Arquitetura de Alto Nível

### 2.1 Visão Arquitetural

O SEI-Perceptio deve seguir uma arquitetura em camadas, com módulos independentes e desacoplados, permitindo substituição de componentes sem impacto sistêmico. A arquitetura prevê cinco camadas principais: ingestão, processamento, armazenamento vetorial, geração augmentada e apresentação.

```
┌─────────────────────────────────────────────────────────────────┐
│                  DADOS MOCADOS (SEM DEPENDÊNCIA DO SEI)                │
│   Script Seed SQL │ Supabase Migration │ Dados Estruturados      │
│   (carga inicial de processos, documentos, andamentos → Supabase)       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ Dados já persistidos no Supabase (sem contato com o SEI)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                       NEXT.JS (Full-Stack)                        │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  App Router (React)                                       │   │
│  │  Interface Web │ Dashboard │ Chat RAG │ Notebook           │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  API Routes (Route Handlers)                               │   │
│  │  RAG Pipeline │ Embeddings │ Chunking │ LLM Orquestrador   │   │
│  │  OCR │ Anonimização │ Geração de Relatórios               │   │
│  └───────────────────────┬──────────────────────────────────┘   │
└──────────────────────────┼────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE                                  │
│                                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ PostgreSQL  │ │   pgvector   │ │   Auth      │ │  Storage    │   │
│  │ (dados SEI) │ │ (embeddings)│ │ (usuarios)  │ │ (arquivos)  │   │
│  │ + RLS       │ │ + HNSW/IVF  │ │ + RBAC      │ │ + CDN       │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                     │
│  ┌────────────┐ ┌────────────┐                                     │
│  │ Realtime   │ │  Edge Fxns  │ (opcional para tarefas pesadas)     │
│  │ (notificações)│ │            │                                     │
│  └────────────┘ └────────────┘                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Princípios Arquiteturais

| Princípio | Descrição |
|-----------|-----------|
| **Soberania** | Toda infraestrutura de processamento deve estar sob jurisdição brasileira (PBIA) |
| **Privacidade por Concepção** | Anonimização automática de dados pessoais antes da ingestão |
| **Modularidade** | Componentes intercambiáveis (LLM, fonte de dados). A fonte de dados (seed script) é independente do Next.js e pode ser substituída por integração real com o SEI no futuro. Supabase serve como camada de dados unificada (PostgreSQL + pgvector + Auth + Storage). |
| **Rastreabilidade** | Todas as operações devem gerar trilhas de auditoria completas |
| **Resiliência** | Funcionamento em modo degradado sem dependência de serviços externos |
| **Interoperabilidade** | Compatível com SEI 4.0+, padrões e-PING e IN SGD/ME nº 1/2019 |

---

## 3. Requisitos Funcionais

### 3.1 Módulo de Ingestão de Documentos

| ID | Requisito | Prioridade | Descrição Detalhada |
|----|-----------|------------|---------------------|
| **RF-001** | Upload manual de documentos | Alta | Permitir upload de arquivos PDF, DOCX, TXT, MD, XLSX, PPTX, imagens (JPG/PNG/TIFF) e arquivos de áudio (MP3/WAV) via **Supabase Storage**. Limite individual de 500 MB por arquivo. Validação de formato e integridade (checksum) antes da ingestão. Os arquivos são armazenados em buckets do Supabase Storage com controle de acesso via políticas (RLS). |
| **RF-002** | Carga de dados mocados (seed data) do SEI | Alta | Script de seed (SQL/TypeScript) que popula o **PostgreSQL do Supabase** com dados realistas de processos SEI, incluindo: (a) processos completos (cabeçalho, lista de documentos e histórico de andamentos); (b) detalhes de cada documento (número SEI, tipo, unidade geradora, datas, conteúdo textual); (c) andamentos com data/hora, unidade e descrição; (d) anexações e desanexações entre processos; (e) consultas públicas com prorrogações. Os dados devem ser consistentes com as regras de negócio validadas (v3.3) e cobrir múltiplos cenários (processos em tramitação, concluídos, com consulta pública, anexados, distribuídos). O script de seed deve ser idempotente (executável múltiplas vezes sem duplicação). Acesso ao Supabase via chave de serviço (service_role key). |
| **RF-003** | Importação de URLs públicas | Média | Permitir a ingestão de fontes externas via URL, como legislações federais, editais publicados, manuais de tribunais de contas e orientações normativas, desde que publicamente acessíveis (sem autenticação). |
| **RF-004** | Detecção e processamento de OCR | Média | Para PDFs digitalizados por imagem (sem camada de texto), executar automaticamente reconhecimento óptico de caracteres (OCR) com suporte a idioma português, preservando tabulações e formatação estrutural do documento original. |
| **RF-005** | Extração estruturada de metadados SEI | Alta | Extrair e armazenar os campos estruturados do processo SEI: número NUP (`NNNNN.NNNNNN/AAAA-NN`), tipo de processo (código e descrição), interessados, unidade geradora, data de geração, data de inclusão, classificação hierárquica (Área > Categoria > Subcategoria), status do processo e lista de andamentos com data/hora e unidade. |
| **RF-006** | Saneamento e anonimização automática | Alta | Aplicar pipeline de anonimização baseada em Tecnologias de Proteção da Privacidade (PETs): identificação e mascaramento de CPFs, CNPJs, e-mails pessoais, telefones, dados bancários, endereços residenciais, dados sensíveis (saúde, biometria, filiação política). Oferecer modo de "tarja preta definitiva" para exportação. O DPO deve poder configurar regras de anonimização por unidade. |
| **RF-007** | Detecção de duplicidade de fontes | Média | Identificar automaticamente documentos duplicados ou com sobreposição de conteúdo superior a 80% (usando hash simhash ou jaccard similarity), alertando o usuário antes da ingestão. |
| **RF-008** | Versionamento de estados do processo | Média | Manter snapshot versionado dos estados anteriores do processo para consulta temporal. Quando novos dados forem carregados via script de seed ou upload manual, o sistema deve preservar o estado anterior em `SnapshotProcesso`. |

### 3.2 Módulo de Processamento e Indexação

| ID | Requisito | Prioridade | Descrição Detalhada |
|----|-----------|------------|---------------------|
| **RF-009** | Chunking inteligente por estrutura documental | Alta | Dividir documentos em segmentos (chunks) respeitando a estrutura semântica: (a) limites por seção/capítulo em documentos longos; (b) limites por parágrafo em documentos curtos; (c) janela de sobreposição configurável (padrão: 200 tokens); (d) preservação dos metadados de origem em cada chunk (número do documento SEI, tipo, unidade geradora, data). Tamanho máximo recomendado por chunk: 512 tokens. |
| **RF-010** | Geração de embeddings | Alta | Gerar embeddings vetoriais para cada chunk via **Supabase Edge Function** `embed` utilizando `Supabase.ai.Session('gte-small')` (modelo multilíngue, suporta PT-BR). Dimensão fixa do vetor: **384 dimensões** (mean_pool + normalize). A mesma Edge Function gera embeddings de chunks na ingestão e da query do usuário no chat. Sem API externa, sem custo por chamada. Na Fase 5, transição para modelo nacional de embeddings do PBIA mantendo a mesma interface (`POST /functions/v1/embed`). Suporte a reindexação incremental quando novos documentos forem adicionados. |
| **RF-011** | Indexação em banco vetorial | Alta | Armazenar vetores e metadados na extensão **pgvector** do Supabase (habilitada no PostgreSQL do projeto). Suporte a índices HNSW ou IVF para busca aproximada via funções nativas do pgvector (`<=>`, `<->`). O banco deve suportar filtragem híbrida (vetorial + metadados estruturados como tipo de documento, data, unidade), utilizando consultas SQL combinadas com operadores de similaridade vetorial. |
| **RF-012** | Indexação full-text complementar | Média | Manter índice de texto completo (BM25) como estratégia de fallback para buscas por termos exatos, números de processo ou palavras-chave específicas que o embedding possa suavizar. |
| **RF-013** | Classificação automática por tipo documental SEI | Média | Classificar automaticamente os documentos ingeridos conforme a tipologia do SEI (300+ tipos), utilizando o campo estruturado quando disponível ou inferência por IA quando ausente. A classificação deve alimentar filtros de busca e agrupamentos analíticos. |

### 3.3 Módulo de Consulta via RAG (Chat Inteligente)

| ID | Requisito | Prioridade | Descrição Detalhada |
|----|-----------|------------|---------------------|
| **RF-014** | Chat em linguagem natural | Alta | Interface de chat conversacional que permita ao usuário formular perguntas em linguagem natural sobre os processos ingeridos. O sistema deve recuperar os chunks relevantes do banco vetorial, passá-los como contexto ao LLM e gerar respostas fundamentadas exclusivamente nas fontes carregadas. |
| **RF-015** | Citação de fontes com rastreabilidade | Alta | Cada resposta do chat deve incluir referências explícitas às fontes utilizadas, indicando: (a) número do documento SEI de origem; (b) tipo documental; (c) unidade geradora; (d) trecho citado com destaque visual; (e) link ou indicação de navegação até o ponto exato no documento original. O usuário deve poder clicar na referência e ser levado ao trecho específico no documento. |
| **RF-016** | Seleção dinâmica de fontes por consulta | Alta | Permitir ao usuário ativar/desativar fontes específicas no painel lateral antes ou durante a conversa, de forma análoga ao NotebookLM. A retrieval deve considerar apenas as fontes ativas, melhorando a precisão e reduzindo ruído. A recomendação é manter ativas apenas 4 a 5 fontes cruciais por pergunta. |
| **RF-017** | Histórico de conversa com contexto | Alta | Manter o histórico completo da sessão de conversa, preservando o contexto de interações anteriores para consultas follow-up (ex.: "E sobre o parecer técnico mencionado anteriormente?"). Limite configurável de turns (padrão: 20). |
| **RF-018** | Consultas estruturadas com templates | Média | Oferecer templates de prompts pré-configurados para casos de uso comuns, como: (a) análise de conformidade licitatória; (b) verificação de prazos legais; (c) resumo de andamentos por período; (d) cruzamento entre processos anexados; (e) identificação de lacunas instrucionais. |
| **RF-019** | Busca híbrida (vetorial + estruturada) | Alta | Combinar busca semântica (embedding) com filtros estruturados: por número de processo, tipo de documento, unidade, intervalo de datas, interessado. Permitir consultas como: "Quais notas técnicas emitidas pela STD entre jan/2025 e jun/2025 abordam GD?" |
| **RF-020** | Geração de relatórios e sínteses | Alta | Permitir ao usuário solicitar a geração de: (a) resumos executivos de processos; (b) relatórios comparativos entre processos; (c) tabelas analíticas (divergências, conformidades, prazos); (d) linhas do tempo cronológicas de andamentos; (e) minutas de pareceres e instruções. Todas as gerações devem ser marcadas com a declaração de uso de IA. |
| **RF-021** | Geração de áudio (Briefing) | Baixa | Permitir a síntese em áudio (text-to-speech) de resumos ou briefing de processos, em português brasileiro, para consumo em reuniões ou deslocamento. Duração configurável (resumo de 5 minutos a briefing detalhado de 20 minutos). |
| **RF-022** | Verificação de alucinações | Alta | Implementar mecanismo de auto-verificação: após gerar resposta, o sistema deve comparar cada afirmação factual com os chunks recuperados e sinalizar com indicador de confiança (alto/médio/baixo). Afirmações com baixa confiança devem ser destacadas visualmente e acompanhadas de alerta ao usuário. |

### 3.4 Módulo de Monitoramento de Processos

| ID | Requisito | Prioridade | Descrição Detalhada |
|----|-----------|------------|---------------------|
| **RF-023** | Monitoramento de andamentos | Alta | Permitir ao usuário registrar processos SEI para monitoramento. O SEI-Perceptio deve exibir o estado atual dos processos acompanhados, com detecção de novos andamentos ou alterações de status quando os dados forem atualizados via script de seed ou upload manual. A aplicação principal detecta as mudanças no banco e gera notificações. |
| **RF-024** | Alertas e notificações | Alta | Disparar notificações (in-app, e-mail ou webhook) quando eventos configurados ocorrerem: (a) novo andamento em processo monitorado; (b) alteração de status (aberto → em tramitação → concluído/arquivado); (c) prazos legais próximos do vencimento; (d) anexação ou desanexação de processos; (e) distribuição para nova unidade ou relatoria. |
| **RF-025** | Dashboard de visão consolidada | Alta | Painel visual com visão agregada dos processos monitorados: (a) contagem por status; (b) processos por unidade atual; (c) tempo médio de tramitação; (d) próximos prazos; (e) processos com atividade recente; (f) distribuição por tipo processual (gráfico de barras ou treemap). |
| **RF-026** | Análise de SLA e prazos | Média | Calcular e exibir indicadores de tempo: (a) tempo total do processo (abertura até conclusão); (b) tempo em cada unidade; (c) tempo entre andamentos consecutivos; (d) identificação de prazos próximos ou vencidos com base em regras configuráveis por tipo de processo. |
| **RF-027** | Linha do tempo interativa | Média | Gerar visualização cronológica interativa de andamentos de um processo, com zoom por período, filtro por unidade e destaque de marcos relevantes (distribuição, conclusão, anexação, consulta pública). Permitir comparação temporal entre múltiplos processos. |
| **RF-028** | Acompanhamento de processos anexados | Média | Quando um processo principal tiver processos anexados, o sistema deve monitorar automaticamente a hierarquia completa: processo pai e todos os filhos anexados. Alterações em qualquer nível da hierarquia devem gerar alertas consolidados. |
| **RF-029** | Monitoramento de Consultas Públicas vinculadas | Média | Detectar e acompanhar automaticamente consultas públicas vinculadas a processos monitorados, incluindo: data de abertura, data de encerramento, prorrogações (quando houver) e status inferido (em andamento / encerrada). |

### 3.5 Módulo de Gestão de Notebooks (Espaços de Trabalho)

| ID | Requisito | Prioridade | Descrição Detalhada |
|----|-----------|------------|---------------------|
| **RF-030** | Criação de notebooks temáticos | Alta | Permitir ao usuário criar notebooks dedicados (espaços de trabalho isolados) para organizar fontes por tema, processo ou projeto. Cada notebook deve ter nome, descrição, lista de fontes próprias e histórico de conversa independente. |
| **RF-031** | Compartilhamento de notebooks | Média | Permitir o compartilhamento de notebooks entre usuários do mesmo órgão, com controle de permissões: (a) leitura; (b) comentário; (c) edição. O compartilhamento deve respeitar a classificação de sigilo dos processos envolvidos. |
| **RF-032** | Etiquetagem e categorização de fontes | Média | Permitir ao usuário aplicar tags/etiquetas personalizadas nas fontes (ex.: "prioridade alta", "revisão pendente", "auditoria 2025"). Filtros de busca por tags devem estar disponíveis no chat e no painel de fontes. |
| **RF-033** | Exportação de notebook | Média | Permitir a exportação de todo o conteúdo de um notebook: (a) fontes originais; (b) histórico de conversas (formato Markdown ou PDF); (c) sínteses geradas; (d) relatórios produzidos. A exportação deve incluir metadados de rastreabilidade. |
| **RF-034** | Limite de fontes por notebook | Média | Suportar no mínimo 300 fontes por notebook e 500 notebooks por conta organizacional, com possibilidade de configuração pelo administrador conforme recursos de infraestrutura disponíveis. |

### 3.6 Módulo de Relações e Análise Cruzada

| ID | Requisito | Prioridade | Descrição Detalhada |
|----|-----------|------------|---------------------|
| **RF-035** | Mapeamento de relações entre processos | Alta | Identificar e visualizar automaticamente as relações entre processos: (a) processos anexados (hierarquia pai-filho); (b) processos referenciados em andamentos; (c) processos do mesmo interessado; (d) processos do mesmo tipo processual. Apresentar em formato de grafo interativo. |
| **RF-036** | Análise de fluxo de tramitação | Média | Reconstruir e visualizar o fluxo completo de tramitação de um processo: quais unidades participaram, ordem cronológica, tempo de permanência em cada unidade, padrões de remessa e conclusão. Identificar gargalos e unidades com maior tempo de permanência. |
| **RF-037** | Busca por semelhança processual | Média | Dado um processo de referência, identificar processos similares com base em: (a) tipo processual; (b) conteúdo documental (embeddings); (c) fluxo de tramitação; (d) interessados comuns. Útil para identificar precedentes e jurisprudência administrativa. |
| **RF-038** | Análise de distribuição e relatoria | Baixa | Para processos que passaram por distribuição/sorteio, mapear o Diretor-Relator responsável, a sessão de distribuição e o resultado deliberativo. Permitir agregação estatística por relator. |

### 3.7 Módulo de Governança e Conformidade

| ID | Requisito | Prioridade | Descrição Detalhada |
|----|-----------|------------|---------------------|
| **RF-039** | Declaração automática de uso de IA | Alta | Toda resposta gerada pelo SEI-Perceptio deve incluir automaticamente o selo/declaração: *"Conteúdo elaborado com auxílio de inteligência artificial sob supervisão humana, em conformidade com a Portaria MGI nº 3.485/2026"*. O selo deve ser configurável pelo administrador para adequação normativa local. |
| **RF-040** | Rastreabilidade completa de operações | Alta | Registrar em log imutável todas as operações: (a) ingestão de fontes (quem, quando, quê); (b) consultas realizadas (pergunta, fontes utilizadas, resposta gerada, timestamp); (c) modificações em notebooks; (d) exportações. Os logs devem estar disponíveis para auditoria por período mínimo de 5 anos. |
| **RF-041** | Controle de acesso baseado em função (RBAC) | Alta | Implementar controle de acesso via **Supabase Auth** com perfis: (a) Administrador (gestão completa); (b) Analista (criação de notebooks, consultas, monitoramento); (c) Consultor (somente leitura). Os perfis são armazenados nos metadados do usuário no Supabase Auth (`app_metadata.role`). A proteção em nível de linha (Row-Level Security — RLS) no PostgreSQL do Supabase deve aplicar as políticas de acesso a cada tabela (processos, notebooks, fontes, chunks), garantindo que cada usuário acesse apenas seus dados e os compartilhados com seu perfil. O acesso a processos sigilosos deve ser restrito e rastreado. |
| **RF-042** | Bloqueio de dados sigilosos | Alta | O sistema deve impedir a ingestão de documentos marcados como sigilosos no SEI (código 100001101 — "Processo Sigiloso"), a menos que o órgão configure explicitamente uma exceção com autorização do DPO e justificativa documentada. A detecção deve ocorrer na fase de ingestão. |
| **RF-043** | Configuração de políticas de retenção | Média | Permitir ao administrador definir políticas de retenção e exclusão de dados ingeridos: (a) retenção por período (ex.: 2 anos após conclusão do processo); (b) exclusão manual com aprovação; (c) anonimização irreversível após expiração. |

---

## 4. Requisitos Não Funcionais

### 4.1 Desempenho

| ID | Requisito | Especificação |
|----|-----------|---------------|
| **RNF-001** | Tempo de resposta de consulta | Consultas ao chat devem retornar em até 15 segundos (P95) para notebooks com até 50 fontes ativas. |
| **RNF-002** | Tempo de ingestão | Ingestão de documento PDF de 100 páginas deve completar em até 60 segundos, incluindo OCR quando necessário. |
| **RNF-003** | Tempo de indexação | Geração de embeddings (gte-small 384d via Edge Function nativa) e indexação de 2.000 páginas deve completar em até 5 minutos. |
| **RNF-004** | Consulta síncrona | Consulta a processos e andamentos de até 500 processos deve completar em até 3 segundos por requisição. |
| **RNF-005** | Concorrência | Suportar no mínimo 100 usuários simultâneos sem degradação significativa de performance. |

### 4.2 Segurança

| ID | Requisito | Especificação |
|----|-----------|---------------|
| **RNF-006** | Criptografia em trânsito | Todas as comunicações devem utilizar TLS 1.3. |
| **RNF-007** | Criptografia em repouso | Dados armazenados devem ser criptografados com AES-256. Suporte a chaves gerenciadas pelo cliente (CMEK). |
| **RNF-008** | Residência de dados | Todos os dados devem residir exclusivamente em infraestrutura localizada no Brasil, conforme LGPD e PBIA. |
| **RNF-009** | Autenticação | Autenticação gerenciada pelo **Supabase Auth**, com suporte nativo a: (a) e-mail/senha; (b) magic link (sem senha); (c) OAuth (Google, Microsoft, GitHub); (d) SAML 2.0 / OIDC para integração com ID Gov.br ou equivalente corporativo (via Supabase SSO). Todas as operações autenticadas utilizam o JWT emitido pelo Supabase Auth para validação nas API Routes do Next.js e nas políticas RLS do PostgreSQL. |
| **RNF-010** | Sessão segura | Timeout de sessão configurável (padrão: 30 minutos de inatividade). Tokens JWT emitidos pelo Supabase Auth com expiração curta (configurável via `JWT_EXPIRY`) e refresh tokens rotativos com `ROTATING_REFRESH_TOKENS` habilitado. |
| **RNF-011** | Proteção contra injeção | Sanitização de todas as entradas do usuário (prompts, uploads, parâmetros de busca) para prevenir prompt injection e ataques de injeção. |
| **RNF-012** | Isolamento de dados por órgão | Dados de diferentes órgãos devem ser isolados via **Row-Level Security (RLS)** do Supabase, com políticas que restringem o acesso por `orgao_id` (tenant). Cada request autenticado tem o `orgao_id` extraído do JWT, garantindo isolamento lógico (multi-tenant) sem possibilidade de vazamento entre tenants. |

### 4.3 Disponibilidade e Resiliência

| ID | Requisito | Especificação |
|----|-----------|---------------|
| **RNF-013** | Disponibilidade | SLA mínimo de 99,5% de uptime (excluindo janelas de manutenção programada). |
| **RNF-014** | Backup automático | Backup gerenciado pelo **Supabase**: backup pontual diário automático do PostgreSQL (incluindo dados relacionais e vetoriais pgvector) e armazenamento de objetos (Supabase Storage). Retenção de backups por 7 dias no plano gratuito e até 30 dias no plano Pro. Complementar com pg_dump programado para retenção estendida se necessário. |
| **RNF-015** | Modo degradado | Em caso de indisponibilidade do LLM, o sistema deve permitir busca vetorial e full-text manual como fallback. O upload manual e os dados já persistidos (seed data) devem continuar acessíveis para consulta. |
| **RNF-016** | Recuperação de desastre | RTO (Recovery Time Objective) máximo de 4 horas; RPO (Recovery Point Objective) máximo de 1 hora. |

### 4.4 Usabilidade

| ID | Requisito | Especificação |
|----|-----------|---------------|
| **RNF-017** | Interface responsiva | Interface web responsiva compatível com navegadores modernos (Chrome, Firefox, Edge, Safari — últimas 2 versões). Layout adaptável para desktop, tablet e mobile. |
| **RNF-018** | Acessibilidade | Conformidade com WCAG 2.1 nível AA. Suporte a navegação por teclado, leitores de tela e contraste adequado. |
| **RNF-019** | Onboarding guiado | Tutorial interativo para primeiros acessos, explicando: criação de notebook, ingestão de fontes, realização de consultas e interpretação de citações. |
| **RNF-020** | Idioma | Interface integralmente em português brasileiro. Suporte a glossário de termos do domínio SEI (NUP, tramitação, anexação, distribute, etc.) com tooltips explicativos. |

### 4.5 Escalabilidade e Manutenibilidade

| ID | Requisito | Especificação |
|----|-----------|---------------|
| **RNF-021** | Escalabilidade horizontal | A arquitetura deve permitir escalabilidade horizontal: o **Next.js** pode ser implantado em múltiplas instâncias (Vercel, container Docker ou orquestração como K8s) com load balancing; o **Supabase** escala automaticamente o pool de conexões PostgreSQL, compute e Storage conforme a demanda. Tarefas pesadas de ingestão e embeddings devem ser executadas via API Routes do Next.js com processamento em background (streaming ou fila gerenciada via **Inngest** — vide stack 7.1). |
| **RNF-022** | Atualização contínua de modelos | Suporte a substituição do modelo de embeddings e do LLM. A Edge Function `embed` permite trocar o modelo de embeddings (ex.: gte-small → modelo nacional PBIA) mantendo a mesma interface `POST /functions/v1/embed`. Quando a dimensionalidade do vetor for compatível, não é necessária reindexação completa; caso contrário, re-indexar chunks existentes com o novo modelo. |
| **RNF-023** | Health checks | Endpoints de health check nas API Routes do Next.js para monitorar: (a) conectividade com Supabase (PostgreSQL, Auth, Storage); (b) disponibilidade do LLM. Integração com Supabase Dashboard (métricas nativas) e opcionalmente com Prometheus/Grafana. |
| **RNF-024** | Logs estruturados | Todos os logs em formato estruturado (JSON) com níveis (DEBUG, INFO, WARN, ERROR), correlação por request ID e envio para sistema centralizado de logs. |

---

## 5. Modelo de Dados Essencial

### 5.1 Entidades Principais

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   ORGAO          │────►│    USUARIO       │────►│   NOTEBOOK       │
│  (tenant)        │     │  (perfil RBAC)  │     │  (espaço trab.)  │
└─────────────────┘     └──────┬──────────┘     └────────┬────────┘
                               │                         │
                    ┌──────────┼─────────────────────────┤
                    │          │                         │
              ┌─────▼──────┐  │              ┌──────────▼──────┐  ┌───────────────┐
              │   PERFIL    │  │              │   CONVERSA      │  │COMPARTILHAMENTO│
              │ (RBAC role) │  │              │  (chat sessão)  │  │ (permissões)   │
              └────────────┘  │              └────────┬────────┘  └───────────────┘
                              │                       │
                              │              ┌────────▼────────┐
                              │              │   MENSAGEM      │
                              │              │ (turns + cites) │
                              │              └─────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   FONTE            │◄──── Seed Data / Upload / URL
                    │  (documento)       │     (dados mocados carregados via script)
                    └─────────┬──────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │          │         │         │        │
      ┌────▼────┐ ┌──▼────┐ ┌▼──────┐ ┌─▼─────┐ ┌▼──────────┐
      │  CHUNK  │ │ANDAMENTO│ │METADADO│ │ TAG   │ │CONSULTA   │
      │(vetor)  │ │(tram.)  │ │(SEI)   │ │(N:N)  │ │ PUBLICA   │
      └─────────┘ └────────┘ └────────┘ └───────┘ └─────┬─────┘
                                                             │
                                                   ┌─────────▼──────────┐
                                                   │  PRORROGACAO_CP     │
                                                   │(múltiplas por CP)   │
                                                   └────────────────────┘
                                                              │
              ┌───────────────┐  ┌───────────────┐  ┌───────────▼─────┐
              │ MONITORAMENTO │  │  AUDITLOG     │  │ ALERTA          │
              │ (proc+user)  │  │ (log imutável)│  │(notificação)    │
              └───────────────┘  └───────────────┘  └─────────────────┘
                                                              │
              ┌───────────────┐  ┌───────────────┐  ┌───────────▼─────┐
              │ SNAPSHOT       │  │ POLITICA       │  │ SEEDJOB         │
              │ PROCESSO       │  │ RETENCAO       │  │ (carga dados)   │
              └───────────────┘  └───────────────┘  └─────────────────┘
```

### 5.2 Esquema Conceitual — Processo SEI

| Entidade | Atributos Principais | Notas Supabase |
|----------|-----------------------|----------------|
| **Processo** | nup (PK), tipo_processo_codigo, tipo_processo_desc, interessados[], data_geracao, data_inclusao, status, unidade_atual, unidade_geradora, classificacao (área/categoria/subcategoria), sigiloso (boolean), orgao_id (FK) | Tabela no Supabase. RLS: usuários do mesmo orgao_id acessam os processos. |
| **Documento** | numero_sei + orgao_id (PK composta, NC 1.1), processo_id (FK), tipo_documento_codigo, tipo_documento_desc, unidade_geradora, data_documento, data_inclusao, conteudo_texto, caminho_arquivo, checksum, orgao_id (FK) | Tabela no Supabase. `caminho_arquivo` referencia bucket do Supabase Storage. |
| **Andamento** | id (PK), processo_id (FK), data_hora, unidade, tipo (recebimento/remessa/conclusão/reabertura/anexação/desanexação/distribuição), descricao, processo_referenciado_id, relator_id (nullable), sessao_distribuicao (nullable), resultado_deliberativo (nullable), orgao_id (FK) | Tabela no Supabase. Campos de relatoria nullable, preenchidos apenas quando tipo=distribuição (RF-038). RLS por orgao_id. |
| **Anexacao** | id (PK), processo_pai_id (FK), processo_filho_id (FK), data_anexacao, data_desanexacao, chamado_suporte, orgao_id (FK) | Tabela no Supabase. |
| **Fonte** | id (PK), notebook_id (FK), tipo_origem (seed_data/upload/url), documento_sei_id (FK nullable), caminho_arquivo, url (nullable), data_ingestao, checksum, anonimizada (boolean), tags[], orgao_id (FK) | `caminho_arquivo` no Supabase Storage. RLS por orgao_id. |
| **SeedJob** | id (PK), tipo (processo/documentos/andamentos/consulta_publica), nup_alvo (nullable), filtros_json, status (pendente/em_execucao/concluido/erro), data_inicio, data_fim, registros_inseridos, erro_msg | Tabela no Supabase. Registra execuções do script de seed. Acessível apenas pelo seed script (service_role). |
| **Chunk** | id (PK), fonte_id (FK), conteudo, posicao_inicio, posicao_fim, embedding (vetor pgvector), metadados_json, orgao_id (FK) | Tabela com coluna `embedding` do tipo `vector(384)`. Índice HNSW (cosine). RLS por orgao_id. |
| **Notebook** | id (PK), orgao_id (FK), usuario_criador_id (FK), nome, descricao, data_criacao | Tabela no Supabase. `usuario_criador_id` referencia `auth.users`. RLS por orgao_id. Compartilhamentos geridos por entidade separada (Compartilhamento). |
| **Perfil** | user_id (FK → auth.users), orgao_id (FK), role (admin/analista/consultor), nome_completo, sigla_unidade | Tabela no Supabase. Usada para RBAC e RLS. `user_id` é UUID do Supabase Auth. |
| **Conversa** | id (PK), notebook_id (FK), usuario_id (FK), titulo, data_criacao, data_ultima_interacao, orgao_id (FK) | Tabela no Supabase. Agrupa mensagens de uma sessão de chat. RLS por orgao_id. |
| **Mensagem** | id (PK), conversa_id (FK), role (user/assistant), conteudo, chunks_citados[], indicador_confianca, data_criacao, orgao_id (FK) | Tabela no Supabase. Cada turn do chat. `chunks_citados[]` armazena IDs dos chunks utilizados. RLS por orgao_id. |
| **Monitoramento** | id (PK), usuario_id (FK), processo_id (FK), intervalo_verificacao (1h/6h/24h), ativo (boolean), data_cadastro, orgao_id (FK) | Tabela no Supabase. Liga usuário a processo monitorado. RLS por orgao_id. |
| **Alerta** | id (PK), monitoramento_id (FK), tipo_evento (novo_andamento/alteracao_status/prazo_proximo/anexacao/distribuicao), processo_id (FK), descricao, lido (boolean), data_criacao, orgao_id (FK) | Tabela no Supabase. Notificações geradas por eventos. RLS por orgao_id. |
| **Compartilhamento** | id (PK), notebook_id (FK), usuario_destino_id (FK), permissao (leitura/comentario/edicao), data_compartilhamento, compartilhado_por_id (FK), orgao_id (FK) | Tabela no Supabase. Substitui o array `compartilhamentos[]` do Notebook. RLS por orgao_id. |
| **AuditLog** | id (PK), usuario_id (FK), acao (ingestao/consulta/modificacao/exportacao), entidade_tipo, entidade_id, detalhes_json, ip_address, user_agent, data_criacao, orgao_id (FK) | Tabela no Supabase. Log imutável (INSERT only, sem UPDATE/DELETE). RLS por orgao_id. Retenção: 5 anos (RF-040). |
| **Tag** | id (PK), orgao_id (FK), nome, cor, data_criacao | Tabela no Supabase. Tags globais por órgão. Relação N:N com Fonte via tabela intermediária `fonte_tag`. |
| **fonte_tag** | fonte_id (FK), tag_id (FK) | Tabela de junção N:N entre Fonte e Tag. RLS por orgao_id. |
| **ConsultaPublica** | id (PK), processo_id (FK), data_abertura, data_encerramento_original, data_encerramento_efetiva, status_inferido (em_andamento/encerrada), orgao_id (FK) | Tabela no Supabase. Monitoramento de consultas públicas vinculadas (RF-029). `data_encerramento_efetiva` é a data mais recente entre o aviso original e todas as prorrogações (RN-050). RLS por orgao_id. |
| **ProrrogacaoCP** | id (PK), consulta_publica_id (FK), documento_sei_id (FK), data_encerramento_nova, data_extracao, orgao_id (FK) | Tabela auxiliar no Supabase. Cada registro representa uma prorrogação extraída de um "Aviso de Prorrogação da Consulta Pública" (código 535). Suporta múltiplas prorrogações por consulta pública (RN-050). RLS por orgao_id. |
| **SnapshotProcesso** | id (PK), processo_id (FK), dados_json (snapshot completo), data_snapshot, versao, orgao_id (FK) | Tabela no Supabase. Versionamento de estados do processo para consulta temporal (RF-008). RLS por orgao_id. |
| **PoliticaRetencao** | id (PK), orgao_id (FK), nome, tipo_entidade, regra (periodo_dias/apos_conclusao), acao (excluir/anonimizar), ativo (boolean), criado_por_id (FK) | Tabela no Supabase. Configuração de políticas de retenção por órgão (RF-043). RLS por orgao_id. |

---

## 6. Integração com o SEI

### 6.1 Estratégia de Obtenção de Dados: Dados Mocados (Seed Data)

O SEI-Perceptio **não** se integra ao SEI por API, plugin ou qualquer mecanismo de acoplamento direto com a aplicação. A obtenção de dados processuais é realizada por meio de **scripts de seed** (SQL/TypeScript) que populam o banco de dados com dados mocados realistas, consistentes com as regras de negócio validadas (v3.2). Os dados já vêm pré-estruturados no formato esperado pelo schema do Supabase, incluindo processos, documentos com conteúdo textual, andamentos, anexações, consultas públicas com prorrogações e metadados de relatoria. A aplicação principal nunca entra em contato com o SEI — ela lê e processa exclusivamente os dados já armazenados no banco.

| Característica | Descrição |
|--------------|-----------|
| **Mecanismo** | Script de seed (SQL/TypeScript) executado via Supabase CLI ou API Route com service_role key |
| **Desacoplamento** | O seed script é independente da aplicação principal e pode ser reexecutado a qualquer momento |
| **Persistência** | Os dados são inseridos diretamente no **PostgreSQL do Supabase** via service_role key |
| **Idempotência** | O script deve usar UPSERT (INSERT ... ON CONFLICT) para permitir reexecução sem duplicação |
| **Cobertura** | Dados devem cobrir múltiplos cenários: processos em tramitação, concluídos, com consulta pública, anexados, distribuídos com deliberação |
| **Upload Manual** | Fluxo complementar em que o usuário exporta o PDF consolidado pelo SEI e realiza upload no SEI-Perceptio, para casos não cobertos pelo seed data |

### 6.2 Mapeamento de Dados do SEI para o SEI-Perceptio

| Campo SEI | Mapeamento | Tratamento |
|-----------|-----------|------------|
| NUP (`48500.NNNNNN/AAAA-NN`) | `processo.nup` | Validação por regex (RI-001). Prefixo 48500 = ANEEL. |
| Tipo de Processo (`selTipoProcedimentoPesquisa`) | `processo.tipo_processo_codigo` + `processo.tipo_processo_desc` | Mapeamento de código numérico para hierarquia (Área > Categoria > Subcategoria). 200+ tipos. |
| Interessados | `processo.interessados[]` | Campo não estruturado no SEI (RN-005). No seed data, os interessados são fornecidos diretamente como array JSON, cobrindo: múltiplos interessados, interessado único e campo vazio. |
| Data de Geração | `processo.data_geracao` | Formato DD/MM/AAAA. CHECK: `data_geracao <= data_inclusao` (RN-059). |
| Data de Inclusão | `processo.data_inclusao` | Formato DD/MM/AAAA. |
| Unidade Geradora (processo) | `processo.unidade_geradora` | Sigla da unidade que originou o processo (RN-058). Distinta de `unidade_atual`. |
| Lista de Documentos | `documento[]` | 17+ tipos identificados (Nota Técnica, Ofício, Memorando, Despacho, Voto, etc.). Cada documento vinculado ao processo. |
| Tipo de Documento (`selSeriePesquisa`) | `documento.tipo_documento_codigo` + `documento.tipo_documento_desc` | 300+ tipos no sistema. |
| Unidade Geradora (documento) | `documento.unidade_geradora` + `andamento.unidade` | Sigla única (STD, SFT, DIR-GNSJ, etc.). |
| Histórico de Andamentos | `andamento[]` | 104+ registros no exemplo. 7 tipos: recebimento, remessa, conclusão, reabertura, anexação, desanexação, distribuição. |
| Anexações | `anexacao[]` | Relação N:N entre processos. Registro de chamado de suporte para desanexações. |
| Datas de Consulta Pública | `consulta_publica.data_abertura` + `consulta_publica.data_encerramento_original` + `consulta_publica.data_encerramento_efetiva` + `prorrogacao_cp[]` | **Resolvido (RN-048 a RN-050)**: Não são campos estruturados do SEI. Extraídas do conteúdo textual de documentos "Aviso de Consulta Pública" e "Aviso de Prorrogação da Consulta Pública" (código 535) via regex/NLP. Formatos: extenso ("29 de janeiro de 2026"), numérico ("22/05/2026"), relativo ("prorrogado até o dia..."). Cada prorrogação gera um registro na tabela `ProrrogacaoCP` com `data_encerramento_nova`. O campo `data_encerramento_efetiva` é calculado como a data mais recente entre a original e todas as prorrogações. Vide Seção 8.1 de `regras_negocio_sei_perceptio.md`. |
| Diretor-Relator | `andamento.relator_id` (nullable) | **Resolvido (RN-051 a RN-053)**: Não é campo estruturado no SEI. No SEI original, é extraído do conteúdo de documentos de Voto, Pauta e Extrato de Deliberação via regex/NLP, com fonte complementar em PDFs de distribuição publicados em gov.br/aneel. No SEI-Perceptio, o seed data fornece o `relator_id` diretamente para andamentos do tipo distribuição. Campo nullable. Vide Seção 8.2 de `regras_negocio_sei_perceptio.md`. |
| Resultado Deliberativo | `andamento.resultado_deliberativo` (nullable) | **Resolvido (RN-054)**: Não é campo estruturado. Extraído de "Extrato da Decisão da Diretoria" via regex (padrão: "A Diretoria Colegiada decidiu, por [unanimidade/maioria], [ACAO] [objeto]"). Campo nullable. Vide Seção 8.3 de `regras_negocio_sei_perceptio.md`. |

### 6.3 Regras de Negócio do SEI a Respeitar

> **Nota**: As regras de negócio ativas foram extraídas e validadas a partir do documento de referência `regras_negocio_sei_perceptio.md` (v3.3). RNs removidas ao longo das versões: RN-014 e RN-015 (sem evidência), RN-029 (duplicava RI-005), RN-038 (status inferido, não campo estruturado), RN-013, RN-042–047 e RN-055–057 (interface externa do SEI, não aplicáveis ao SEI-Perceptio). RNs adicionadas: RN-058 e RN-059 (gap RF-005: metadados de processo sem cobertura). Abaixo são listadas as regras com impacto direto nos requisitos desta especificação.

O SEI-Perceptio deve respeitar as seguintes regras de negócio validadas do SEI:

| Regra SEI | Impacto no SEI-Perceptio |
|-----------|-----------------------|
| **RN-001/RN-002**: Formato NUP com prefixo fixo do órgão | Validação automática na ingestão; detecção de prefixo para identificação do órgão de origem. |
| **RN-003**: Visibilidade público/sigiloso | Filtragem automática: bloqueio de ingestão de processos sigilosos, a menos que haja autorização excepcional. |
| **RN-006/RN-007**: Anexação e desanexação | Manutenção da hierarquia de processos anexados; registro de chamados de suporte como metadados. |
| **RN-008**: Ciclo de vida do processo (aberto → em tramitação → concluído/arquivado) | Máquina de estados para monitoramento de status; alertas em transições de status. |
| **RN-011**: Dupla data (documento vs. inclusão) | Armazenamento e exibição de ambas as datas, com cálculo de delta temporal. |
| **RN-020 a RN-024**: Andamentos com data/hora, unidade, referências cruzadas | Reconstrução completa do fluxo de tramitação; detecção de referências a outros processos. RN-020 e RN-021 cobrem os campos de data/hora e unidade exigidos por RF-005. |
| **RN-027**: Desanexação requer chamado de suporte | Registro e rastreabilidade de desanexações com motivo e número do chamado. |
| **RN-058**: Unidade geradora do processo | O seed data deve incluir `processo.unidade_geradora` (sigla da unidade que originou o processo), distinta de `processo.unidade_atual`. Cobertura direta do campo "unidade geradora" em RF-005. |
| **RN-059**: Dupla data do processo (geração e inclusão) | O seed data deve incluir `processo.data_geracao` e `processo.data_inclusao` como campos distintos no nível do processo, análogo à RN-011 (documento). Cobertura direta dos campos "data de geração" e "data de inclusão" em RF-005. |
| **RN-035/RN-036**: Consultas Públicas vinculadas a processos | Detecção automática de consultas públicas; cálculo de status inferido (em andamento/encerrada) com base na data de encerramento. |
| **RN-048/RN-049**: Datas de CP não são campos estruturados | O seed data deve incluir datas de abertura/encerramento nos documentos "Aviso de Consulta Pública" com os formatos observados (extenso, numérico e relativo) para validar os parsers de regex/NLP. |
| **RN-050**: Cada prorrogação gera documento independente | O seed data deve incluir registros na tabela `ProrrogacaoCP` para consultas públicas com múltiplas prorrogações. O campo `consulta_publica.data_encerramento_efetiva` é calculado como o MAX entre `data_encerramento_original` e todas as `prorrogacao_cp.data_encerramento_nova`. |
| **RN-051/RN-052**: Diretor-Relator não é campo estruturado | O campo `andamento.relator_id` deve ser preenchido via extração NLP do conteúdo de documentos de Voto, Pauta e Extrato de Deliberação. Fonte complementar: PDFs de distribuição em gov.br/aneel. |
| **RN-053**: Distribuição por sorteio com lista em PDF externo | O seed data deve incluir `andamento.relator_id` preenchido para andamentos do tipo distribuição, simulando o mapeamento processo → diretor-relator. |
| **RN-054**: Resultado deliberativo segue padrão textual | O campo `andamento.resultado_deliberativo` deve ser preenchido via extração regex de documentos do tipo "Extrato da Decisão da Diretoria" (padrão: "A Diretoria Colegiada decidiu, por [unanimidade/maioria], [ACAO] [objeto]"). |
| **Interessados (múltiplos, único ou vazio)** | O seed data deve fornecer o array `processo.interessados[]` diretamente (RN-005). |

---

## 7. Stack Tecnológica Definida

### 7.1 Componentes Principais

| Camada | Componente | Tecnologia | Justificativa |
|--------|-----------|-----------|---------------|
| **Aplicação Full-Stack** | Framework Web + API | **Next.js 15+** (App Router) | Full-stack: frontend React com SSR/SSG + backend via API Routes (Route Handlers). Monorepo único, deploy simplificado, excelente DX com TypeScript. |
| **Aplicação Full-Stack** | UI Kit | **shadcn/ui** | Componentes acessíveis, customizáveis e baseados em Radix UI. Estilização com Tailwind CSS 4. |
| **Aplicação Full-Stack** | Linguagem | **TypeScript** | Tipagem forte end-to-end: frontend, API Routes, acesso ao banco via Supabase Client. |
| **Banco de Dados** | RDBMS + Vetorial | **Supabase (PostgreSQL 16+ com pgvector)** | Banco relacional + busca vetorial unificados. pgvector para embeddings com índices HNSW/IVF. Row-Level Security (RLS) para isolamento multi-tenant. |
| **Banco de Dados** | Migrations | **Supabase CLI** + **Drizzle ORM** | Versionamento de schema via migrations SQL. ORM leve, tipado e com suporte nativo a Supabase/PostgreSQL para acesso seguro ao banco. |
| **Autenticação** | Auth + RBAC | **Supabase Auth** | Autenticação completa: e-mail/senha, magic link, OAuth (Google, Microsoft), SAML/OIDC (Gov.br). JWT nativo para validação em API Routes e RLS no PostgreSQL. Perfis customizados em `app_metadata.role`. |
| **Armazenamento** | Object Storage | **Supabase Storage** | Armazenamento de arquivos (PDFs, imagens, áudios) em buckets com controle de acesso via políticas. CDN integrado para entrega rápida. Transformações de imagem nativas. |
| **Tempo Real** | Notificações | **Supabase Realtime** | Canais WebSocket para notificações in-app (novos andamentos, alertas). Alternativa leve ao polling. |
| **LLM** | Modelo de Linguagem | Modelos nacionais do PBIA (Maritalk/LLaMA-based) ou OpenAI-compatible hospedados localmente | Soberania. Chamado via API Route do Next.js. |
| **Embeddings** | Modelo de Embeddings | **Supabase Edge Functions** (AI Inference) com `gte-small` (384 dimensões) | Geração nativa de embeddings via `Supabase.ai.Session('gte-small')` dentro do Edge Runtime. Chamada via `POST /functions/v1/embed`. Sem API externa, sem custo por chamada. Na Fase 5, transição para modelo nacional PBIA na mesma Edge Function. |
| **Carga de Dados** | Seed data do SEI | **Supabase CLI** (migrations) + **TypeScript** (script de seed) | Script idempotente que popula o PostgreSQL com dados realistas de processos SEI. Executado via `supabase db reset` ou API Route com service_role key. |
| **Agendamento** | Scheduler | **Inngest** (primário) + **node-cron** (fallback local) | Agendamento de tarefas assíncronas (ingestão, embeddings, relatórios). Inngest roda integrado ao Next.js ou como Edge Function do Supabase para processamento assíncrono e filas duráveis. node-cron como alternativa para ambientes self-hosted sem Inngest. |
| **OCR** | Reconhecimento de Texto | **Tesseract.js** (via API Route) ou **PaddleOCR** | Tesseract.js roda no Next.js; PaddleOCR via container externo para alto volume. |
| **Anonimização** | Máscara de Dados | **Presidio** (via API Route) ou **spaCy NER** | Detecção de PII em PT-BR. Executado via API Route do Next.js antes do chunking. |
| **Deploy** | Hospedagem | **Vercel** (Next.js) + **Supabase Cloud** (banco) | Deploy integrado, CI/CD nativo, preview deployments. Alternativa self-hosted: Docker (Next.js) + Supabase self-hosted (Docker Compose). |
| **Monitoramento** | Observabilidade | **Supabase Dashboard** + **Vercel Analytics** + opcional **Sentry** | Métricas nativas do Supabase (conexões, consultas lentas, storage). Sentry para errors e performance do Next.js. |

### 7.2 Pipeline RAG Detalhado

```
[Documento SEI]
       │
       ▼
[1. Ingestão] ─── Leitura do Supabase (seed data) / Upload manual (Supabase Storage) / URL
       │               via API Route do Next.js
       ▼
[2. Extração] ─── OCR via Tesseract.js (API Route) → Texto limpo
       │
       ▼
[3. Metadados] ─── Parsing estruturado (NUP, tipo, unidade, data)
       │               + Parsing NLP de campos não estruturados (RN-048 a RN-054):
       │               datas de Consulta Pública, Diretor-Relator, resultado deliberativo
       │               salvos no PostgreSQL do Supabase
       ▼
[4. Anonimização] ─── Detecção e mascaramento de PII (API Route)
       │
       ▼
[5. Chunking] ─── Divisão semântica (512 tokens, overlap 200)
       │
       ▼
[6. Embedding] ─── Edge Function Supabase: Supabase.ai.Session('gte-small')
       │               → vetor 384d (mean_pool + normalize)
       │               → chamada via POST /functions/v1/embed
       │
       ▼
[7. Indexação] ─── INSERT pgvector (vector(384), HNSW, cosine)
       │               + índice tsvector para BM25
       │
       ▼
[8. Retrieval] ─── Busca híbrida: SELECT com <=> (cosine) + WHERE filtros
       │               via Supabase RPC ou SQL direto do cliente server-side
       │                │
       │                ▼
       │         [Top-K Chunks Relevantes]
       │                │
       ▼                ▼
[9. Geração] ◄── LLM + Contexto (chunks) + Prompt (API Route streaming)
       │
       ▼
[10. Verificação] ─── Comparação factual (confiança por afirmação)
       │
       ▼
[11. Resposta] ─── Texto + Citações + Indicador de confiança
       │                (streaming SSE para o frontend React)
       ▼
[12. Histórico] ─── Conversa salva no PostgreSQL do Supabase
```

### 7.3 Fluxo de Dados: Seed Data → Supabase → Next.js

```
┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
│  Seed Script  │  INSERT │   Supabase        │  SELECT │   Next.js      │
│  (TypeScript)  │────────►│  PostgreSQL       │◄────────│  API Route     │
│  Supabase CLI  │  via    │  + pgvector       │  via    │  (server-side │
│               │ service │  + RLS            │  JWT    │   client)     │
│               │ _role   │  + Supabase       │  auth   │               │
│               │  key    │    Storage        │         │               │
└──────────────┘         └──────────────────┘         └───────┬──────┘
                                                               │
                                                               ▼
                                                        ┌──────────────┐
                                                        │  Next.js      │
                                                        │  App Router   │
                                                        │  (React UI)   │
                                                        └──────────────┘
```

**Nota**: O script de seed acessa o Supabase diretamente com a `service_role key`, bypassando as políticas RLS. A aplicação Next.js acessa o Supabase com o `anon key` + JWT do usuário, respeitando todas as políticas RLS. Isso garante isolamento de segurança: o seed script tem acesso total para escrita, enquanto cada usuário final só visualiza dados autorizados.

---

## 8. Casos de Uso Prioritários

### UC-01: Análise de Conformidade Licitatória

**Ator**: Servidor público (analista de contratações)
**Pré-condição**: Notebook criado com Termo de Referência, ETP, Pesquisa de Preços e editais importados do SEI

| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | O analista seleciona as fontes relevantes (TR, ETP, pesquisa de preços) | Painel de fontes exibe apenas os documentos selecionados |
| 2 | Formula: *"Analise o ETP e o TR. Aponte divergências entre o dimensionamento da demanda e os quantitativos especificados."* | Sistema responde com tabela comparativa, citando páginas específicas |
| 3 | Analista clica na citação para verificar no documento original | Navegação direta ao trecho no documento original |
| 4 | Solicita: *"Gere relatório de conformidade com a Lei 14.133/2021"* | Relatório estruturado com itens conformes/não conformes e referências legais |

### UC-02: Monitoramento de Processo com Alertas

**Ator**: Servidor público (gestor de área)
**Pré-condição**: Processo SEI cadastrado para monitoramento

| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | O gestor registra o NUP `48500.035430/2025-02` para monitoramento | Sistema confirma cadastro e exibe status atual |
| 2 | Configura alerta para "novo andamento" e "prazo próximo" | Alertas configurados com notificação por e-mail |
| 3 | Após 24h, o seed data é atualizado com novos andamentos simulados no banco de dados | Notificação enviada ao gestor com descrição do andamento (a aplicação detecta a mudança no BD) |
| 4 | Gestor consulta dashboard consolidado | Visualização atualizada com novo andamento na linha do tempo |

### UC-03: Instrução de Processo com RAG

**Ator**: Servidor público (instrutor de processo)
**Pré-condição**: Notebook com processo completo (portaria, termos, defesas, relatórios)

| Passo | Ação | Resultado Esperado |
|-------|------|-------------------|
| 1 | Instrutor carrega todos os documentos do processo SEI no notebook | Documentos processados, indexados e disponíveis |
| 2 | Solicita: *"Gere linha do tempo cronológica com todas as datas de depoimentos e despachos"* | Linha do tempo interativa gerada automaticamente |
| 3 | Consulta: *"Houve extrapolação de prazos legais neste processo?"* | Análise temporal com identificação de prazos cumpridos/violados, com citações |
| 4 | Solicita minuta de parecer | Minuta gerada com selo de uso de IA para revisão humana |

---

## 9. Roadmap de Implementação

### Fase 1 — MVP (3 a 4 meses)

- Projeto Next.js 15+ com App Router + TypeScript + shadcn/ui + Tailwind CSS 4
- Supabase: criação do projeto, schema PostgreSQL, migrações (Supabase CLI)
- Supabase Auth: autenticação por e-mail/senha e magic link
- Supabase Storage: buckets para upload de documentos (PDF, DOCX, TXT, MD)
- pgvector habilitado com `vector(384)`: geração de embeddings via Edge Function `embed` (gte-small) e indexação vetorial HNSW
- API Routes do Next.js: chunking, chat RAG básico com citação de fontes (embeddings delegados à Edge Function)
- Notebook simples (criação, adição de fontes, histórico)
- Row-Level Security (RLS) básica por orgao_id

### Fase 2 — Inteligência SEI (3 a 4 meses)

- Script de seed data do SEI (TypeScript + Supabase CLI)
- Carga idempotente de processos, documentos, andamentos, anexações e consultas públicas
- Dados consistentes com as regras de negócio ativas (v3.3)
- Detecção de mudanças (novos andamentos, documentos) via snapshots
- Parser de metadados estruturados do SEI (NUP, tipo, unidade, andamentos)
- Pipeline de anonimização de PII (API Route)
- OCR para PDFs digitalizados (Tesseract.js via API Route)
- Módulo de monitoramento básico (leitura do Supabase pelo Next.js)
- Notificações in-app via Supabase Realtime

### Fase 3 — Análise Avançada (3 a 4 meses)

- Monitoramento contínuo com dashboard (React + Supabase como data source)
- Linha do tempo interativa
- Análise de relações entre processos (grafo)
- Busca por semelhança processual (pgvector cosine similarity)
- Análise de SLA e prazos
- Geração de relatórios e sínteses

### Fase 4 — Governança e Escala (2 a 3 meses)

- RBAC completo: perfis (admin/analista/consultor) em Supabase Auth metadata
- Integração SSO Gov.br via Supabase SSO (SAML/OIDC)
- RLS refinado por orgao_id + role em todas as tabelas
- Logs de auditoria imutáveis (tabela audit_log com RLS)
- Políticas de retenção configuráveis
- Compartilhamento de notebooks
- Modo Enterprise (multi-tenant)
- Conformidade total LGPD / Portaria MGI nº 3.485/2026

### Fase 5 — Inovação Contínua (contínuo)

- Geração de áudio (briefing)
- Substituição do gte-small por modelo nacional de embeddings na Edge Function `embed` (re-indexação de chunks existentes)
- LLM soberano PBIA
- Integração com APIs de outros sistemas governamentais
- Análise preditiva de prazos e gargalos
- API Routes públicas para integrações de terceiros
- Novas Edge Functions para OCR leve, geração de summaries e webhook handlers

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|------------|
| **Qualidade dos dados mocados** (inconsistências com regras de negócio, cobertura insuficiente de cenários) | Média | Alto | Validar seed data contra as regras de negócio ativas (v3.3); cobrir no mínimo 5 cenários distintos; teste de regressão ao atualizar o seed script. |
| **Alucinações do LLM** | Média | Alto | Implementar verificação factual (RF-022); exigir citações obrigatórias; supervisão humana obrigatória. |
| **Vazamento de dados sensíveis** | Baixa | Crítico | Anonimização automática (RF-006); bloqueio de sigilosos (RF-042); criptografia ponta a ponta; RBAC. |
| **Baixa qualidade de embeddings em PT-BR** | Média | Médio | Validação empírica com corpus do domínio SEI (gte-small é multilíngue com suporte a PT-BR). Se insuficiente, migrar para modelo nacional PBIA na Fase 5 via atualização da Edge Function `embed` (mesma interface `POST /functions/v1/embed`, zero impacto no cliente). |
| **Resistência organizacional ao uso de IA** | Média | Médio | Programa de capacitação (conforme SGD/MGI); onboarding guiado; transparência de uso com selo obrigatório. |
| **Limitações de infraestrutura do órgão** | Média | Médio | Supabase oferece deploy cloud gerenciado ou self-hosted (Docker Compose); Next.js roda em qualquer plataforma (Vercel, VPS, on-premise). Arquitetura leve sem necessidade de Kubernetes. |
| **Mudanças normativas (LGPD, Portarias)** | Baixa | Alto | Arquitetura modular permite ajustes rápidos; configuração centralizada de políticas de anonimização e conformidade. |

---

## 11. Critérios de Aceitação

| Critério | Especificação |
|----------|---------------|
| **CA-001** | O sistema deve ingerir, processar e indexar 100 documentos PDF (total de até 5.000 páginas) em menos de 30 minutos. |
| **CA-002** | Consultas ao chat RAG devem retornar respostas com citações de fontes em 95% dos casos de teste, com indicador de confiança alto em pelo menos 85% das afirmações geradas. |
| **CA-003** | O seed script deve carregar dados de no mínimo 200 processos SEI com andamentos variados no Supabase (PostgreSQL) em menos de 5 minutos. |
| **CA-004** | A anonimização deve identificar e mascarar pelo menos 95% dos CPFs, CNPJs, e-mails e telefones presentes nos documentos de teste. |
| **CA-005** | Todos os requisitos de segurança (RNF-006 a RNF-012) devem ser validados por teste de penetração antes da produção. |
| **CA-006** | A interface deve atingir nota mínima de 80/100 no System Usability Scale (SUS) com usuários representativos do público-alvo. |
| **CA-007** | O sistema deve manter disponibilidade de 99,5% durante período de testes de carga de 30 dias consecutivos. |

---

## 12. Referências Normativas

| Referência | Descrição |
|-----------|-----------|
| **Lei nº 13.709/2018 (LGPD)** | Lei Geral de Proteção de Dados Pessoais |
| **Portaria MGI nº 3.485/2026** | Política de Governança de Inteligência Artificial |
| **Resolução CNJ nº 615/2025** | Uso de IA no Poder Judiciário |
| **Lei nº 14.133/2021** | Nova Lei de Licitações e Contratos Administrativos |
| **IN SGD/ME nº 1/2019** | Contratação de Soluções de TIC |
| **Plano Brasileiro de Inteligência Artificial (PBIA)** | Estratégia nacional para IA soberana |
| **Portaria MGI nº 3.485/2026 — SGD** | Guia Prático de Prompt para Servidores Públicos |
| **Manual do Usuário SEI 4.0+** | Documentação oficial do Sistema Eletrônico de Informações |

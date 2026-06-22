-- ============================================================================
-- SEI-Perceptio — SELECTs para o Processo 48500.035430/2025-02  (v2 — corrigida)
-- ============================================================================
-- Origem dos dados: HTML "Pesquisa Processual" do SEI-ANEEL
-- Processo: 48500.035430/2025-02
-- Tipo: Regulação da Distribuição: Pleitos sobre Serviços de Distribuição
-- Data de geração: 18/11/2025 · Unidade geradora: STD
-- Unidade atual: SMA · Status inferido: em_tramitacao (concluído na unidade)
-- Total de documentos: 24 · Total de andamentos: 106 · Total de anexações: 37
-- Consultas públicas anexadas: 2 (48500.012614/2026-77, 48500.016358/2026-97)
-- Prorrogações: nenhuma
--
-- NOTAS DE USO:
-- 1. Substitua :orgao_id pelo UUID do órgão ANEEL (SELECT id FROM orgao WHERE sigla='ANEEL')
-- 2. Os SELECTs abaixo assumem que o processo JÁ FOI INSERIDO no banco (via seed ou ingestão)
-- 3. Todos os SELECTs respeitam RLS por orgao_id — rode com usuário autenticado ou service_role
-- 4. Em caso de service_role, RLS é bypassada (acesso total)
--
-- PLACEHOLDERS — como definir em diferentes contextos:
--   • psql (CLI):     \set orgao_id '''<uuid>'''
--                      \set processo_id '''<uuid>'''
--                      \set query_text '''deliberação diretoria'''
--                      \set notebook_id '''<uuid>'''
--   • Supabase JS:    .eq('orgao_id', orgaoId)  (não usar placeholders; usar parameter binding)
--   • DBeaver/pgAdmin: usar :orgao_id, :processo_id (suportado nativamente)
--   • Drizzle/Prisma:  usar $1, $2, ... com params array
--
-- HISTÓRICO DE CORREÇÕES (v1 → v2):
--   [CRÍTICO] 11.3 — Subquery de embedding substituída por placeholder externo
--             (era semanticamente incorreta: usava embedding de chunk aleatório como vetor de consulta)
--   [CRÍTICO] 11.3 — Adicionados casts de tipo em NULLs da chamada de RPC
--             (NULL sem cast em parâmetros uuid[]/text[] pode gerar erro de tipo ambíguo)
--   [IMPORTANTE] 3.8 — REGEXP_MATCH agora extrai o 1º match com [1]
--             (a função retorna text[], não text; coluna ficava como array)
--   [IMPORTANTE] 3.8 — Regex ampliada para cobrir variações "n°", "nº", "n.º", "nro."
--   [IMPORTANTE] 15.1 — Subqueries de COUNT agora filtram por orgao_id
--             (sem isso, RLS pode bloquear ou contar dados de outros órgãos)
--   [MENOR] 14.1 — Removidos parênteses redundantes em (:processo_id)::text
--   [MELHORIA] Adicionado bloco de explicação de placeholders no cabeçalho
--   [MELHORIA] Notas de performance adicionadas em queries com ILIKE
-- ============================================================================

-- ============================================================================
-- 0. CONFIGURAÇÃO INICIAL — resolver orgao_id e processo_id
-- ============================================================================

-- 0.1 Obter o orgao_id da ANEEL
SELECT id AS aneel_orgao_id, nome, sigla, municipio, uf
FROM orgao
WHERE sigla = 'ANEEL';
-- Resultado esperado: 1 linha com o UUID do órgão ANEEL

-- 0.2 Obter o processo_id pelo NUP (substitua :orgao_id pelo UUID retornado acima)
SELECT
  id              AS processo_id,
  nup,
  tipo_processo_codigo,
  tipo_processo_desc,
  status,
  unidade_atual,
  unidade_geradora,
  sigiloso,
  data_geracao,
  data_inclusao,
  classificacao,
  interessados,
  created_at,
  updated_at
FROM processo
WHERE nup = '48500.035430/2025-02'
  AND orgao_id = :orgao_id;
-- Resultado esperado: 1 linha. Guarde o `processo_id` para usar nos SELECTs seguintes.


-- ============================================================================
-- 1. PROCESSO — dados completos do cabeçalho
-- ============================================================================

-- 1.1 Visão "canônica" do processo (formato JSON amigável)
SELECT
  jsonb_build_object(
    'id',                  p.id,
    'nup',                 p.nup,
    'tipo_processo',       jsonb_build_object('codigo', p.tipo_processo_codigo, 'desc', p.tipo_processo_desc),
    'status',              p.status,
    'sigiloso',            p.sigiloso,
    'unidade_geradora',    p.unidade_geradora,
    'unidade_atual',       p.unidade_atual,
    'data_geracao',        p.data_geracao,
    'data_inclusao',       p.data_inclusao,
    'classificacao',       p.classificacao,
    'interessados',        p.interessados,
    'orgao_id',            p.orgao_id
  ) AS processo_json
FROM processo p
WHERE p.nup = '48500.035430/2025-02'
  AND p.orgao_id = :orgao_id;

-- 1.2 Validar constraint chk_data_geracao_inclusao
SELECT
  nup,
  data_geracao,
  data_inclusao,
  CASE WHEN data_geracao <= data_inclusao
       THEN 'OK'
       ELSE 'VIOLA chk_data_geracao_inclusao'
  END AS validacao_data
FROM processo
WHERE nup = '48500.035430/2025-02'
  AND orgao_id = :orgao_id;

-- 1.3 Verificar se processo é sigiloso (RF-042 — bloqueia ingestão)
SELECT
  nup,
  sigiloso,
  CASE WHEN sigiloso THEN 'BLOQUEADO para ingestão (RF-042)'
       ELSE 'LIVRE para ingestão'
  END AS status_ingestao
FROM processo
WHERE nup = '48500.035430/2025-02'
  AND orgao_id = :orgao_id;


-- ============================================================================
-- 2. DOCUMENTOS — 24 registros vinculados ao processo
-- ============================================================================

-- 2.1 Listagem completa (24 documentos esperados)
SELECT
  d.id,
  d.numero_sei,
  d.tipo_documento_codigo,
  d.tipo_documento_desc,
  d.unidade_geradora,
  d.data_documento,
  d.data_inclusao,
  d.checksum,
  d.caminho_arquivo,
  CASE WHEN d.conteudo_texto IS NOT NULL THEN 'sim' ELSE 'não' END AS tem_conteudo_texto,
  d.created_at
FROM documento d
WHERE d.processo_id = :processo_id
  AND d.orgao_id = :orgao_id
ORDER BY d.data_documento, d.numero_sei;
-- Resultado esperado: 24 linhas

-- 2.2 Contagem por tipo_documental (visão agregada)
SELECT
  tipo_documento_desc,
  COUNT(*) AS total
FROM documento
WHERE processo_id = :processo_id
  AND orgao_id = :orgao_id
GROUP BY tipo_documento_desc
ORDER BY total DESC, tipo_documento_desc;
-- Resultado esperado: distribuição dos 24 documentos por tipo
-- (Nota Técnica, Anexo, Ofício, Memorando, Voto, Aviso de Consulta Pública, etc.)

-- 2.3 Documento específico — Aviso de Consulta Pública (numero_sei=0335766)
SELECT
  id,
  numero_sei,
  tipo_documento_desc,
  unidade_geradora,
  data_documento,
  data_inclusao,
  LEFT(conteudo_texto, 500) AS preview_conteudo
FROM documento
WHERE processo_id = :processo_id
  AND orgao_id = :orgao_id
  AND numero_sei = '0335766';
-- Resultado esperado: 1 linha — Aviso de Consulta Pública emitido pela SMA em 22/04/2026

-- 2.4 Documento específico — Voto do Diretor-Relator (numero_sei=0335757)
SELECT
  id,
  numero_sei,
  tipo_documento_desc,
  unidade_geradora,
  data_documento,
  LEFT(conteudo_texto, 1000) AS preview_voto
FROM documento
WHERE processo_id = :processo_id
  AND orgao_id = :orgao_id
  AND numero_sei = '0335757';

-- 2.5 Documentos sem conteúdo textual extraído (problemáticos para RAG)
SELECT
  numero_sei,
  tipo_documento_desc,
  unidade_geradora,
  data_documento
FROM documento
WHERE processo_id = :processo_id
  AND orgao_id = :orgao_id
  AND (conteudo_texto IS NULL OR LENGTH(TRIM(conteudo_texto)) = 0)
ORDER BY data_documento;
-- Resultado esperado: idealmente 0 linhas (todos os 24 com texto extraído)

-- 2.6 Documentos ordenados por data de geração (timeline documental)
SELECT
  TO_CHAR(data_documento, 'DD/MM/YYYY') AS data_fmt,
  numero_sei,
  tipo_documento_desc,
  unidade_geradora
FROM documento
WHERE processo_id = :processo_id
  AND orgao_id = :orgao_id
ORDER BY data_documento ASC, numero_sei ASC;


-- ============================================================================
-- 3. ANDAMENTOS — 106 registros (timeline de tramitação)
-- ============================================================================

-- 3.1 Timeline completa (106 andamentos esperados)
SELECT
  a.id,
  TO_CHAR(a.data_hora, 'DD/MM/YYYY HH24:MI') AS data_hora_fmt,
  a.unidade,
  a.tipo,
  a.descricao,
  a.processo_referenciado_id,
  a.relator_id,
  a.sessao_distribuicao,
  a.resultado_deliberativo
FROM andamento a
WHERE a.processo_id = :processo_id
  AND a.orgao_id = :orgao_id
ORDER BY a.data_hora DESC, a.created_at DESC;
-- Resultado esperado: 106 linhas, do mais recente ao mais antigo

-- 3.2 Andamento mais recente (define unidade_atual e status)
SELECT
  TO_CHAR(a.data_hora, 'DD/MM/YYYY HH24:MI') AS data_hora_fmt,
  a.unidade,
  a.tipo,
  a.descricao
FROM andamento a
WHERE a.processo_id = :processo_id
  AND a.orgao_id = :orgao_id
ORDER BY a.data_hora DESC
LIMIT 1;
-- Resultado esperado: 15/06/2026 07:34 | SMA | conclusao | "Conclusão do processo na unidade"

-- 3.3 Andamento de geração do processo (define unidade_geradora)
-- NOTA DE PERFORMANCE: ILIKE sem índice pg_trgm na coluna `descricao` faz seq scan.
-- Para 106 linhas isso é aceitável. Em tabelas maiores, criar índice:
--   CREATE INDEX idx_andamento_descricao_trgm ON andamento USING gin (descricao gin_trgm_ops);
SELECT
  TO_CHAR(a.data_hora, 'DD/MM/YYYY HH24:MI') AS data_hora_fmt,
  a.unidade,
  a.tipo,
  a.descricao
FROM andamento a
WHERE a.processo_id = :processo_id
  AND a.orgao_id = :orgao_id
  AND a.descricao ILIKE 'Processo público gerado%'
ORDER BY a.data_hora ASC
LIMIT 1;
-- Resultado esperado: 18/11/2025 16:38 | STD | recebimento | "Processo público gerado"

-- 3.4 Andamento deliberativo (resultado_deliberativo preenchido)
SELECT
  TO_CHAR(a.data_hora, 'DD/MM/YYYY HH24:MI') AS data_hora_fmt,
  a.unidade,
  a.descricao,
  a.resultado_deliberativo,
  a.sessao_distribuicao
FROM andamento a
WHERE a.processo_id = :processo_id
  AND a.orgao_id = :orgao_id
  AND a.resultado_deliberativo IS NOT NULL
ORDER BY a.data_hora DESC;
-- Resultado esperado: 24/04/2026 17:49 | DIR - GNSJ | "PROCESSO DELIBERADO COM A PAUTA DA 8ª REUNIÃO..."

-- 3.5 Andamentos de distribuição (sessao_distribuicao preenchido)
SELECT
  TO_CHAR(a.data_hora, 'DD/MM/YYYY HH24:MI') AS data_hora_fmt,
  a.unidade,
  a.descricao,
  a.sessao_distribuicao
FROM andamento a
WHERE a.processo_id = :processo_id
  AND a.orgao_id = :orgao_id
  AND a.sessao_distribuicao IS NOT NULL
ORDER BY a.data_hora ASC;
-- Resultado esperado: 26/11/2025 18:59 | STD | "Solicito a distribuição do seguinte processo na 47ª Sessão Pública..."

-- 3.6 Distribuição por tipo de andamento
SELECT
  tipo,
  COUNT(*) AS total
FROM andamento
WHERE processo_id = :processo_id
  AND orgao_id = :orgao_id
GROUP BY tipo
ORDER BY total DESC;
-- Resultado esperado (aproximado, baseado no HTML):
--   anexacao       ~37
--   desanexacao    ~31
--   conclusao      ~10
--   recebimento     ~8
--   reabertura      ~6
--   remessa         ~9
--   distribuicao    ~5

-- 3.7 Andamentos que referenciam outros processos (processo_referenciado_id preenchido)
SELECT
  TO_CHAR(a.data_hora, 'DD/MM/YYYY HH24:MI') AS data_hora_fmt,
  a.unidade,
  a.tipo,
  a.descricao,
  p_ref.nup AS nup_referenciado
FROM andamento a
LEFT JOIN processo p_ref ON p_ref.id = a.processo_referenciado_id
WHERE a.processo_id = :processo_id
  AND a.orgao_id = :orgao_id
  AND a.processo_referenciado_id IS NOT NULL
ORDER BY a.data_hora DESC;
-- Resultado esperado: andamentos de anexação/desanexação que referenciam os 6+ sub-processos

-- 3.8 Andamentos com chamado de suporte mencionado na descrição
-- CORREÇÃO v2: (REGEXP_MATCH(...))[1] extrai o 1º grupo como text (a função retorna text[])
-- CORREÇÃO v2: regex ampliada para cobrir 'n°', 'nº', 'n.º', 'nro.' (com ou sem espaço)
SELECT
  TO_CHAR(a.data_hora, 'DD/MM/YYYY HH24:MI') AS data_hora_fmt,
  a.unidade,
  a.descricao,
  (REGEXP_MATCH(a.descricao, 'chamado\s+n[°ºo]*\.?\s*(\d+)', 'i'))[1] AS chamado_suporte
FROM andamento a
WHERE a.processo_id = :processo_id
  AND a.orgao_id = :orgao_id
  AND a.descricao ILIKE '%chamado%'
ORDER BY a.data_hora DESC;
-- Resultado esperado: ~31 andamentos de desanexação, com chamados 1403740, 1403765, 1404255

-- 3.9 Andamentos do Diretor-Relator (relator_id preenchido)
SELECT
  TO_CHAR(a.data_hora, 'DD/MM/YYYY HH24:MI') AS data_hora_fmt,
  a.unidade,
  a.tipo,
  a.descricao,
  a.relator_id,
  pe.nome_completo AS relator_nome
FROM andamento a
LEFT JOIN perfil pe ON pe.user_id = a.relator_id
WHERE a.processo_id = :processo_id
  AND a.orgao_id = :orgao_id
  AND a.relator_id IS NOT NULL
ORDER BY a.data_hora DESC;
-- Resultado esperado: andamentos da DIR-GNSJ (Gentil Nogueira de Sá Junior)


-- ============================================================================
-- 4. ANEXAÇÕES — 37 eventos (processo_pai = 48500.035430/2025-02)
-- ============================================================================

-- 4.1 Todas as anexações em que este processo é o PAI
SELECT
  anx.id,
  anx.data_anexacao,
  anx.data_desanexacao,
  anx.chamado_suporte,
  p_pai.nup AS nup_pai,
  p_filho.nup AS nup_filho,
  CASE WHEN anx.data_desanexacao IS NULL THEN 'ATIVA'
       ELSE 'HISTÓRICA'
  END AS status_anexacao
FROM anexacao anx
INNER JOIN processo p_pai    ON p_pai.id    = anx.processo_pai_id
INNER JOIN processo p_filho  ON p_filho.id  = anx.processo_filho_id
WHERE anx.processo_pai_id = :processo_id
  AND anx.orgao_id        = :orgao_id
ORDER BY anx.data_anexacao DESC, anx.data_desanexacao DESC NULLS FIRST;
-- Resultado esperado: 37 linhas (6 ativas + 31 históricas)

-- 4.2 Apenas anexações ATIVAS (sem data_desanexacao)
SELECT
  anx.data_anexacao,
  p_filho.nup AS nup_filho,
  p_filho.tipo_processo_desc AS tipo_filho
FROM anexacao anx
INNER JOIN processo p_filho ON p_filho.id = anx.processo_filho_id
WHERE anx.processo_pai_id    = :processo_id
  AND anx.orgao_id           = :orgao_id
  AND anx.data_desanexacao IS NULL
ORDER BY anx.data_anexacao DESC;
-- Resultado esperado: 6 anexações ativas (incluindo as 2 consultas públicas)

-- 4.3 Anexações em que este processo é o FILHO (caso raro — geralmente 0)
SELECT
  anx.data_anexacao,
  anx.data_desanexacao,
  p_pai.nup AS nup_pai,
  p_pai.tipo_processo_desc AS tipo_pai
FROM anexacao anx
INNER JOIN processo p_pai ON p_pai.id = anx.processo_pai_id
WHERE anx.processo_filho_id = :processo_id
  AND anx.orgao_id          = :orgao_id
ORDER BY anx.data_anexacao DESC;
-- Resultado esperado: 0 linhas (este processo é o PAI em todas as anexações)

-- 4.4 Anexações agrupadas por processo_filho (inclui re-anexações)
SELECT
  p_filho.nup AS nup_filho,
  COUNT(*) AS total_anexacoes,
  COUNT(*) FILTER (WHERE anx.data_desanexacao IS NULL) AS ativas,
  MIN(anx.data_anexacao)  AS primeira_anexacao,
  MAX(anx.data_anexacao)  AS ultima_anexacao,
  ARRAY_AGG(DISTINCT anx.chamado_suporte) FILTER (WHERE anx.chamado_suporte IS NOT NULL) AS chamados
FROM anexacao anx
INNER JOIN processo p_filho ON p_filho.id = anx.processo_filho_id
WHERE anx.processo_pai_id = :processo_id
  AND anx.orgao_id        = :orgao_id
GROUP BY p_filho.nup
ORDER BY primeira_anexacao;
-- Resultado esperado: ~32 NUPs distintos (48500.016358/2026-97 aparece 2× por re-anexação)

-- 4.5 Anexações por chamado de suporte (auditoria de anexação indevida)
SELECT
  anx.chamado_suporte,
  COUNT(*) AS total_desanexacoes,
  MIN(anx.data_desanexacao) AS primeira_desanexacao,
  MAX(anx.data_desanexacao) AS ultima_desanexacao
FROM anexacao anx
WHERE anx.processo_pai_id = :processo_id
  AND anx.orgao_id        = :orgao_id
  AND anx.chamado_suporte IS NOT NULL
GROUP BY anx.chamado_suporte
ORDER BY total_desanexacoes DESC;
-- Resultado esperado: chamados 1403740, 1403765, 1404255

-- 4.6 Processos filho distintos (NUPs) — join para validar existência no banco
SELECT
  p_filho.nup,
  p_filho.tipo_processo_desc,
  p_filho.status,
  p_filho.unidade_atual,
  p_filho.data_geracao
FROM anexacao anx
INNER JOIN processo p_filho ON p_filho.id = anx.processo_filho_id
WHERE anx.processo_pai_id = :processo_id
  AND anx.orgao_id        = :orgao_id
GROUP BY p_filho.nup, p_filho.tipo_processo_desc, p_filho.status, p_filho.unidade_atual, p_filho.data_geracao
ORDER BY p_filho.data_geracao;
-- Resultado esperado: ~32 NUPs distintos (se todos foram ingeridos no banco)


-- ============================================================================
-- 5. CONSULTA PÚBLICA — inferida via documento "Aviso de Consulta Pública"
-- ============================================================================

-- 5.1 Documento "Aviso de Consulta Pública" (neste processo)
SELECT
  d.id,
  d.numero_sei,
  d.tipo_documento_desc,
  d.unidade_geradora,
  d.data_documento
FROM documento d
WHERE d.processo_id = :processo_id
  AND d.orgao_id   = :orgao_id
  AND d.tipo_documento_desc ILIKE '%Aviso de Consulta Pública%';
-- Resultado esperado: 1 linha — numero_sei=0335766, SMA, 22/04/2026

-- 5.2 Consulta(s) pública(s) formalmente cadastradas para este processo
SELECT
  cp.id,
  cp.data_abertura,
  cp.data_encerramento_original,
  cp.data_encerramento_efetiva,
  cp.status_inferido,
  (
    SELECT COUNT(*)
    FROM prorrogacao_cp pr
    WHERE pr.consulta_publica_id = cp.id
  ) AS total_prorrogacoes
FROM consulta_publica cp
WHERE cp.processo_id = :processo_id
  AND cp.orgao_id   = :orgao_id;
-- Resultado esperado: 0 linhas se a CP ainda não foi cadastrada (HTML não tem dados diretos).
-- Caso tenha sido inserida via seed, retorna 1 linha com status_inferido='em_andamento' ou 'encerrada'.

-- 5.3 Sub-processos de "Participação Pública: Consulta Pública" anexados
SELECT
  p_filho.nup,
  p_filho.tipo_processo_desc,
  p_filho.data_geracao,
  anx.data_anexacao,
  CASE WHEN anx.data_desanexacao IS NULL THEN 'ATIVA'
       ELSE 'desanexada'
  END AS status_anexacao
FROM anexacao anx
INNER JOIN processo p_filho ON p_filho.id = anx.processo_filho_id
WHERE anx.processo_pai_id = :processo_id
  AND anx.orgao_id        = :orgao_id
  AND p_filho.tipo_processo_desc ILIKE '%Participação Pública%Consulta Pública%'
ORDER BY anx.data_anexacao;
-- Resultado esperado: 2 linhas
--   48500.012614/2026-77 (anexada em 12/06/2026 17:36, SMA, ativa)
--   48500.016358/2026-97 (anexada em 15/06/2026 07:34, SMA, ativa — re-anexação)


-- ============================================================================
-- 6. PRORROGAÇÕES DE CONSULTA PÚBLICA — nenhuma esperada
-- ============================================================================

-- 6.1 Listar prorrogações de todas as consultas públicas do processo (esperado: 0)
SELECT
  pr.id,
  pr.data_encerramento_nova,
  pr.data_extracao,
  cp.processo_id,
  d.numero_sei AS documento_sei_numero
FROM prorrogacao_cp pr
INNER JOIN consulta_publica cp ON cp.id = pr.consulta_publica_id
LEFT  JOIN documento d          ON d.id = pr.documento_sei_id
WHERE cp.processo_id = :processo_id
  AND pr.orgao_id   = :orgao_id
ORDER BY pr.data_extracao DESC;
-- Resultado esperado: 0 linhas (HTML não menciona prorrogações)


-- ============================================================================
-- 7. SNAPSHOTS — versionamento do processo (RF-008)
-- ============================================================================

-- 7.1 Todos os snapshots do processo, ordenados por versão
SELECT
  ssp.versao,
  ssp.data_snapshot,
  jsonb_pretty(ssp.dados_json) AS dados_pretty
FROM snapshot_processo ssp
WHERE ssp.processo_id = :processo_id
  AND ssp.orgao_id   = :orgao_id
ORDER BY ssp.versao DESC;
-- Resultado esperado: depende do pipeline de monitoramento (Inngest) ter rodado

-- 7.2 Último snapshot (versão mais recente)
SELECT
  ssp.versao,
  ssp.data_snapshot,
  ssp.dados_json->>'status'           AS status_no_snapshot,
  ssp.dados_json->>'unidade_atual'    AS unidade_atual_no_snapshot,
  ssp.dados_json->'interessados'      AS interessados_no_snapshot
FROM snapshot_processo ssp
WHERE ssp.processo_id = :processo_id
  AND ssp.orgao_id   = :orgao_id
ORDER BY ssp.versao DESC
LIMIT 1;


-- ============================================================================
-- 8. MONITORAMENTO — usuários monitorando este processo
-- ============================================================================

-- 8.1 Monitoramentos ativos para este processo
SELECT
  m.id,
  m.usuario_id,
  pe.nome_completo AS usuario_nome,
  pe.role,
  m.intervalo_verificacao,
  m.ativo,
  m.data_cadastro
FROM monitoramento m
LEFT JOIN perfil pe ON pe.user_id = m.usuario_id
WHERE m.processo_id = :processo_id
  AND m.orgao_id   = :orgao_id
ORDER BY m.data_cadastro DESC;
-- Resultado esperado: depende de usuários terem ativado monitoramento

-- 8.2 Contagem de monitoramentos por intervalo
SELECT
  intervalo_verificacao,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE ativo) AS ativos
FROM monitoramento
WHERE processo_id = :processo_id
  AND orgao_id   = :orgao_id
GROUP BY intervalo_verificacao
ORDER BY intervalo_verificacao;


-- ============================================================================
-- 9. ALERTAS — gerados pelo monitoramento
-- ============================================================================

-- 9.1 Alertas mais recentes deste processo (Top 20)
SELECT
  a.id,
  TO_CHAR(a.data_criacao, 'DD/MM/YYYY HH24:MI') AS data_fmt,
  a.tipo_evento,
  a.descricao,
  a.lido,
  m.intervalo_verificacao,
  pe.nome_completo AS usuario_nome
FROM alerta a
INNER JOIN monitoramento m ON m.id = a.monitoramento_id
LEFT  JOIN perfil pe       ON pe.user_id = m.usuario_id
WHERE a.processo_id = :processo_id
  AND a.orgao_id   = :orgao_id
ORDER BY a.data_criacao DESC
LIMIT 20;

-- 9.2 Alertas não lidos (pending review)
SELECT
  TO_CHAR(a.data_criacao, 'DD/MM/YYYY HH24:MI') AS data_fmt,
  a.tipo_evento,
  a.descricao,
  pe.nome_completo AS usuario_nome
FROM alerta a
INNER JOIN monitoramento m ON m.id = a.monitoramento_id
LEFT  JOIN perfil pe       ON pe.user_id = m.usuario_id
WHERE a.processo_id = :processo_id
  AND a.orgao_id   = :orgao_id
  AND a.lido = false
ORDER BY a.data_criacao DESC;
-- Usa idx_alerta_lido (partial index WHERE lido = FALSE)

-- 9.3 Distribuição por tipo de evento
SELECT
  tipo_evento,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE lido) AS lidos,
  COUNT(*) FILTER (WHERE NOT lido) AS pendentes
FROM alerta
WHERE processo_id = :processo_id
  AND orgao_id   = :orgao_id
GROUP BY tipo_evento
ORDER BY total DESC;


-- ============================================================================
-- 10. NOTEBOOKS + FONTES — RAG context
-- ============================================================================

-- 10.1 Notebooks que ingeriram este processo como fonte (via documento_sei_id)
-- NOTA: INNER JOIN com documento exclui fontes tipo_origem='upload'/'url' (sem documento_sei_id)
SELECT
  n.id AS notebook_id,
  n.nome AS notebook_nome,
  n.usuario_criador_id,
  pe.nome_completo AS criador_nome,
  f.id AS fonte_id,
  f.tipo_origem,
  f.titulo AS fonte_titulo,
  f.ativa,
  f.anonimizada,
  f.data_ingestao
FROM fonte f
INNER JOIN notebook n       ON n.id = f.notebook_id
INNER JOIN documento d      ON d.id = f.documento_sei_id
LEFT  JOIN perfil pe        ON pe.user_id = n.usuario_criador_id
WHERE d.processo_id = :processo_id
  AND f.orgao_id   = :orgao_id
ORDER BY f.data_ingestao DESC;

-- 10.2 Todas as fontes (de qualquer tipo) cujo metadados_json menciona o NUP
SELECT
  f.id AS fonte_id,
  f.titulo,
  f.tipo_origem,
  f.ativa,
  f.anonimizada,
  f.metadados_json->>'nup'         AS nup_no_metadado,
  f.metadados_json->>'numero_sei'  AS numero_sei_no_metadado,
  f.metadados_json->>'tipo_documento' AS tipo_documento_no_metadado,
  n.nome AS notebook_nome
FROM fonte f
INNER JOIN notebook n ON n.id = f.notebook_id
WHERE f.orgao_id = :orgao_id
  AND (
    f.metadados_json->>'nup' = '48500.035430/2025-02'
    OR f.metadados_json->>'numero_sei' IN (
      SELECT numero_sei FROM documento WHERE processo_id = :processo_id AND orgao_id = :orgao_id
    )
  )
ORDER BY f.data_ingestao DESC;


-- ============================================================================
-- 11. CHUNKS + EMBEDDINGS — recuperação vetorial
-- ============================================================================

-- 11.1 Contagem de chunks por fonte (do processo)
SELECT
  f.id AS fonte_id,
  f.titulo,
  COUNT(c.id) AS total_chunks,
  COUNT(c.id) FILTER (WHERE c.embedding IS NOT NULL) AS chunks_com_embedding,
  MIN(c.posicao_inicio) AS inicio,
  MAX(c.posicao_fim)    AS fim
FROM fonte f
LEFT JOIN chunk c ON c.fonte_id = f.id AND c.orgao_id = f.orgao_id
INNER JOIN documento d ON d.id = f.documento_sei_id
WHERE d.processo_id = :processo_id
  AND f.orgao_id   = :orgao_id
GROUP BY f.id, f.titulo
ORDER BY total_chunks DESC;

-- 11.2 Chunks sem embedding (falha no pipeline)
SELECT
  f.titulo,
  c.id AS chunk_id,
  c.posicao_inicio,
  c.posicao_fim,
  LEFT(c.conteudo, 100) AS preview
FROM chunk c
INNER JOIN fonte f ON f.id = c.fonte_id
INNER JOIN documento d ON d.id = f.documento_sei_id
WHERE d.processo_id = :processo_id
  AND c.orgao_id   = :orgao_id
  AND c.embedding IS NULL
ORDER BY c.created_at DESC;
-- Resultado esperado: 0 linhas (pipeline deve ter gerado embeddings para todos)

-- 11.3 Busca híbrida por texto livre neste processo (via notebook que o contém)
-- ============================================================================
-- CORREÇÃO v2 [CRÍTICA]:
--   A versão anterior usava uma subquery (SELECT embedding FROM chunk WHERE conteudo ILIKE ...)
--   como vetor de consulta, o que é semanticamente incorreto — usar o embedding de um chunk
--   aleatório como vetor de consulta distorce o ranking.
--
--   Em produção, o embedding da query deve ser gerado pela Edge Function:
--     POST {EMBED_FUNCTION_URL}  body: { "input": :query_text }  → { "embedding": [...] }
--
--   Abaixo estão DUAS alternativas executáveis:
--   (A) Usando placeholder :query_embedding (vector(384)) já calculado externamente
--   (B) Usando apenas BM25 (sem embedding) — útil para validação rápida
-- ============================================================================

-- 11.3.A — Busca híbrida RECOMENDADA (requer embedding pré-calculado)
-- Substitua :query_embedding pelo vetor de 384 dims retornado pela Edge Function /functions/v1/embed
-- Substitua :notebook_id por um notebook que ingeriu o processo
-- Substitua :query_text por termos de busca (ex: "deliberação diretoria 8ª reunião")
SELECT
  mc.chunk_id,
  mc.fonte_id,
  mc.score_rrf,
  LEFT(mc.conteudo, 300) AS preview,
  mc.metadados_json->>'nup'           AS nup,
  mc.metadados_json->>'tipo_documento' AS tipo_documento
FROM public.match_chunks_hybrid(
  :query_embedding,                 -- p_query_embedding  vector(384)
  :query_text,                      -- p_query_text       text
  :notebook_id,                     -- p_notebook_id      uuid
  NULL::uuid[],                     -- p_fonte_ids        uuid[]
  NULL::text[],                     -- p_tipo_documento   text[]
  NULL::text[],                     -- p_unidade          text[]
  NULL::date,                       -- p_data_inicio      date
  NULL::date,                       -- p_data_fim         date
  '48500.035430/2025-02',           -- p_nup              text  ← filtra chunks deste processo
  NULL::text,                       -- p_interessado      text
  NULL::uuid[],                     -- p_tag_ids          uuid[]
  10,                               -- p_top_k            integer
  60,                               -- p_rrf_k            integer
  20                                -- p_candidate_limit  integer
) AS mc
ORDER BY mc.score_rrf DESC;

-- 11.3.B — Alternativa BM25 pura (NÃO requer embedding; usa apenas tsvector)
-- Mais lenta que a híbrida, mas não depende da Edge Function. Útil para debug.
SELECT
  c.id AS chunk_id,
  f.titulo AS fonte_titulo,
  ts_rank_cd(c.tsv, plainto_tsquery('portuguese', :query_text)) AS score_bm25,
  LEFT(c.conteudo, 300) AS preview,
  c.metadados_json->>'nup'           AS nup,
  c.metadados_json->>'tipo_documento' AS tipo_documento
FROM chunk c
INNER JOIN fonte f      ON f.id = c.fonte_id
INNER JOIN documento d  ON d.id = f.documento_sei_id
WHERE d.processo_id = :processo_id
  AND c.orgao_id   = :orgao_id
  AND c.tsv @@ plainto_tsquery('portuguese', :query_text)
ORDER BY score_bm25 DESC
LIMIT 10;

-- 11.4 Full-text search (BM25 fallback) — alias da 11.3.B acima, mantida por compatibilidade
-- (Use a 11.3.B; esta seção foi consolidada para evitar duplicação.)
-- [Removida em v2 — ver 11.3.B]


-- ============================================================================
-- 12. TAGS — tags aplicadas a fontes deste processo
-- ============================================================================

-- 12.1 Tags aplicadas a fontes do processo
SELECT
  t.nome AS tag_nome,
  t.cor  AS tag_cor,
  COUNT(DISTINCT f.id) AS total_fontes,
  ARRAY_AGG(f.titulo) AS fontes
FROM fonte_tag ft
INNER JOIN tag t      ON t.id = ft.tag_id
INNER JOIN fonte f    ON f.id = ft.fonte_id
INNER JOIN documento d ON d.id = f.documento_sei_id
WHERE d.processo_id = :processo_id
  AND f.orgao_id   = :orgao_id
GROUP BY t.nome, t.cor
ORDER BY total_fontes DESC, t.nome;
-- Resultado esperado: 0 linhas se nenhuma tag foi aplicada

-- 12.2 Fontes do processo sem nenhuma tag (oportunidade de classificação)
SELECT
  f.id,
  f.titulo,
  f.tipo_origem
FROM fonte f
INNER JOIN documento d ON d.id = f.documento_sei_id
WHERE d.processo_id = :processo_id
  AND f.orgao_id   = :orgao_id
  AND NOT EXISTS (SELECT 1 FROM fonte_tag ft WHERE ft.fonte_id = f.id)
ORDER BY f.titulo;


-- ============================================================================
-- 13. CONVERSAS + MENSAGENS — histórico de chat sobre o processo
-- ============================================================================

-- 13.1 Conversas em notebooks que ingeriram fontes deste processo
SELECT
  c.id AS conversa_id,
  c.titulo,
  c.data_criacao,
  c.data_ultima_interacao,
  n.nome AS notebook_nome,
  pe.nome_completo AS usuario_nome
FROM conversa c
INNER JOIN notebook n ON n.id = c.notebook_id
INNER JOIN perfil pe  ON pe.user_id = c.usuario_id
WHERE EXISTS (
  SELECT 1
  FROM fonte f
  INNER JOIN documento d ON d.id = f.documento_sei_id
  WHERE f.notebook_id = c.notebook_id
    AND d.processo_id = :processo_id
    AND f.orgao_id   = :orgao_id
)
ORDER BY c.data_ultima_interacao DESC;

-- 13.2 Mensagens citando chunks deste processo (por chunks_citados JSONB)
-- NOTA: jsonb_array_elements em array vazio '[]' retorna 0 linhas (EXISTS = false). OK.
-- NOTA: se chunks_citados tiver NULL em algum elemento, jsonb_array_elements pode falhar.
--   Para proteger, validar antes: jsonb_typeof(m.chunks_citados) = 'array'
SELECT
  m.id AS mensagem_id,
  m.role,
  m.data_criacao,
  LEFT(m.conteudo, 200) AS preview_conteudo,
  jsonb_array_length(m.chunks_citados) AS total_citacoes,
  m.indicador_confianca
FROM mensagem m
WHERE m.orgao_id = :orgao_id
  AND jsonb_typeof(m.chunks_citados) = 'array'
  AND jsonb_array_length(m.chunks_citados) > 0
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(m.chunks_citados) AS citacao
    WHERE citacao->>'fonte_id' IN (
      SELECT f.id::text
      FROM fonte f
      INNER JOIN documento d ON d.id = f.documento_sei_id
      WHERE d.processo_id = :processo_id
        AND f.orgao_id   = :orgao_id
    )
  )
ORDER BY m.data_criacao DESC
LIMIT 50;


-- ============================================================================
-- 14. AUDIT LOG — trilha de auditoria deste processo
-- ============================================================================

-- 14.1 Auditoria deste processo (entidade_id = processo_id)
-- NOTA: audit_log é INSERT-only — UPDATE/DELETE levantam erro 42501
SELECT
  TO_CHAR(a.data_criacao, 'DD/MM/YYYY HH24:MI:SS') AS data_fmt,
  a.acao,
  a.entidade_tipo,
  a.entidade_id,
  a.usuario_id,
  pe.nome_completo AS usuario_nome,
  a.ip_address,
  LEFT(a.user_agent, 80) AS user_agent,
  a.detalhes_json
FROM audit_log a
LEFT JOIN perfil pe ON pe.user_id = a.usuario_id
WHERE a.orgao_id    = :orgao_id
  AND (
    a.entidade_id = :processo_id
    OR a.detalhes_json->>'nup' = '48500.035430/2025-02'
    OR a.detalhes_json->>'processo_id' = :processo_id::text
  )
ORDER BY a.data_criacao DESC
LIMIT 100;

-- 14.2 Distribuição por ação de auditoria
SELECT
  acao,
  COUNT(*) AS total,
  MIN(data_criacao) AS primeira_ocorrencia,
  MAX(data_criacao) AS ultima_ocorrencia
FROM audit_log
WHERE orgao_id = :orgao_id
  AND (entidade_id = :processo_id OR detalhes_json->>'nup' = '48500.035430/2025-02')
GROUP BY acao
ORDER BY total DESC;


-- ============================================================================
-- 15. VISÃO PANORÂMICA — dashboard summary do processo
-- ============================================================================

-- 15.1 Resumo consolidado em uma única query (JSON)
-- CORREÇÃO v2: todas as subqueries agora filtram por orgao_id (RLS-safe)
SELECT
  jsonb_build_object(
    'processo', (
      SELECT jsonb_build_object(
        'nup', p.nup, 'status', p.status, 'tipo', p.tipo_processo_desc,
        'unidade_atual', p.unidade_atual, 'sigiloso', p.sigiloso,
        'data_geracao', p.data_geracao
      )
      FROM processo p
      WHERE p.id = :processo_id AND p.orgao_id = :orgao_id
    ),
    'total_documentos',   (
      SELECT COUNT(*) FROM documento  WHERE processo_id = :processo_id AND orgao_id = :orgao_id
    ),
    'total_andamentos',   (
      SELECT COUNT(*) FROM andamento WHERE processo_id = :processo_id AND orgao_id = :orgao_id
    ),
    'anexacoes_ativas',   (
      SELECT COUNT(*) FROM anexacao
      WHERE processo_pai_id = :processo_id AND orgao_id = :orgao_id AND data_desanexacao IS NULL
    ),
    'anexacoes_historicas', (
      SELECT COUNT(*) FROM anexacao
      WHERE processo_pai_id = :processo_id AND orgao_id = :orgao_id AND data_desanexacao IS NOT NULL
    ),
    'consultas_publicas', (
      SELECT COUNT(*) FROM consulta_publica WHERE processo_id = :processo_id AND orgao_id = :orgao_id
    ),
    'prorrogacoes',       (
      SELECT COUNT(*) FROM prorrogacao_cp pr
      INNER JOIN consulta_publica cp ON cp.id = pr.consulta_publica_id
      WHERE cp.processo_id = :processo_id AND pr.orgao_id = :orgao_id
    ),
    'snapshots',          (
      SELECT COUNT(*) FROM snapshot_processo WHERE processo_id = :processo_id AND orgao_id = :orgao_id
    ),
    'monitoramentos_ativos', (
      SELECT COUNT(*) FROM monitoramento WHERE processo_id = :processo_id AND orgao_id = :orgao_id AND ativo
    ),
    'alertas_nao_lidos',  (
      SELECT COUNT(*) FROM alerta WHERE processo_id = :processo_id AND orgao_id = :orgao_id AND NOT lido
    ),
    'fontes_ngeridas',    (
      SELECT COUNT(*) FROM fonte f
      INNER JOIN documento d ON d.id = f.documento_sei_id
      WHERE d.processo_id = :processo_id AND f.orgao_id = :orgao_id
    ),
    'chunks_indexados',   (
      SELECT COUNT(*)
      FROM chunk c
      INNER JOIN fonte f ON f.id = c.fonte_id
      INNER JOIN documento d ON d.id = f.documento_sei_id
      WHERE d.processo_id = :processo_id AND c.orgao_id = :orgao_id
    ),
    'audit_entries',      (
      SELECT COUNT(*) FROM audit_log
      WHERE orgao_id = :orgao_id
        AND (entidade_id = :processo_id OR detalhes_json->>'nup' = '48500.035430/2025-02')
    )
  ) AS resumo_json
FROM processo
WHERE id = :processo_id
  AND orgao_id = :orgao_id;
-- Resultado esperado: 1 linha JSON com ~24 documentos, 106 andamentos, 6 anexações ativas,
-- 0 prorrogações, 0 consultas formais (mas 2 sub-processos CP anexados via anexacao)

-- 15.2 Linha do tempo combinada (documentos + andamentos)
-- NOTA: UNION ALL entre DATE e TIMESTAMPTZ — PostgreSQL faz cast implícito para TIMESTAMPTZ
SELECT
  TO_CHAR(data_evento, 'DD/MM/YYYY HH24:MI') AS data_fmt,
  tipo_evento,
  descricao,
  unidade
FROM (
  SELECT
    d.data_documento::timestamptz AS data_evento,
    'documento' AS tipo_evento,
    d.tipo_documento_desc || ' (' || d.numero_sei || ')' AS descricao,
    d.unidade_geradora AS unidade
  FROM documento d
  WHERE d.processo_id = :processo_id AND d.orgao_id = :orgao_id

  UNION ALL

  SELECT
    a.data_hora AS data_evento,
    'andamento' AS tipo_evento,
    a.descricao,
    a.unidade
  FROM andamento a
  WHERE a.processo_id = :processo_id AND a.orgao_id = :orgao_id
) AS timeline
ORDER BY data_evento ASC;
-- Resultado esperado: ~130 linhas (24 documentos + 106 andamentos) em ordem cronológica


-- ============================================================================
-- 16. DICAS DE DEBUG — validação de integridade referencial
-- ============================================================================

-- 16.1 Documentos sem processo (órfãos — NUNCA deve retornar linhas)
SELECT d.id, d.numero_sei, d.processo_id
FROM documento d
LEFT JOIN processo p ON p.id = d.processo_id
WHERE p.id IS NULL;
-- Resultado esperado: 0 linhas

-- 16.2 Andamentos sem processo (órfãos)
SELECT a.id, a.processo_id, a.data_hora
FROM andamento a
LEFT JOIN processo p ON p.id = a.processo_id
WHERE p.id IS NULL;

-- 16.3 Anexações com processo_pai ou processo_filho inexistentes
SELECT anx.id, anx.processo_pai_id, anx.processo_filho_id
FROM anexacao anx
LEFT JOIN processo p_pai   ON p_pai.id   = anx.processo_pai_id
LEFT JOIN processo p_filho ON p_filho.id = anx.processo_filho_id
WHERE p_pai.id IS NULL OR p_filho.id IS NULL;

-- 16.4 Chunks sem fonte (órfãos)
SELECT c.id, c.fonte_id
FROM chunk c
LEFT JOIN fonte f ON f.id = c.fonte_id
WHERE f.id IS NULL;

-- 16.5 Verificar se a constraint uq_processo_nup_orgao está sendo respeitada
SELECT nup, orgao_id, COUNT(*) AS duplicatas
FROM processo
WHERE nup = '48500.035430/2025-02'
GROUP BY nup, orgao_id
HAVING COUNT(*) > 1;
-- Resultado esperado: 0 linhas (constraint única impede duplicação)

-- 16.6 Verificar violations da constraint chk_data_geracao_inclusao
-- (apenas em modo debug — rode com service_role para bypassar RLS)
SELECT nup, data_geracao, data_inclusao
FROM processo
WHERE orgao_id = :orgao_id
  AND data_geracao > data_inclusao;
-- Resultado esperado: 0 linhas


-- ============================================================================
-- FIM DO SCRIPT (v2)
-- ============================================================================
-- Resumo do que cada seção retorna (para o processo 48500.035430/2025-02):
--
--   Seção 1  (Processo)            → 1 linha
--   Seção 2  (Documentos)          → 24 linhas (lista completa)
--   Seção 3  (Andamentos)          → 106 linhas (timeline)
--   Seção 4  (Anexações)           → 37 linhas (6 ativas + 31 históricas)
--   Seção 5  (Consulta Pública)    → 0-1 linha formal + 2 sub-processos CP anexados
--   Seção 6  (Prorrogações)        → 0 linhas
--   Seção 7  (Snapshots)           → depende do pipeline de monitoramento
--   Seção 8  (Monitoramento)       → depende de usuários terem ativado
--   Seção 9  (Alertas)             → depende do monitoramento ter rodado
--   Seção 10 (Notebooks + Fontes)  → depende de ingestão RAG
--   Seção 11 (Chunks)              → depende de pipeline de embeddings
--          11.1 — contagem por fonte
--          11.2 — chunks sem embedding (deve ser 0)
--          11.3.A — busca híbrida (requer embedding da query via Edge Function)
--          11.3.B — busca BM25 pura (self-contained, ideal para debug)
--   Seção 12 (Tags)                → depende de classificação manual
--   Seção 13 (Conversas)           → depende de uso do chat
--   Seção 14 (Audit Log)           → histórico completo desde a ingestão
--   Seção 15 (Visão panorâmica)    → 1 JSON consolidado + timeline combinada
--   Seção 16 (Debug)               → 0 linhas em todos os checks de integridade
--
-- PLACEHOLDERS necessários:
--   :orgao_id          (uuid)  — usado em todas as seções
--   :processo_id       (uuid)  — usado a partir da seção 1
--   :query_text        (text)  — usado apenas nas seções 11.3.A e 11.3.B
--   :query_embedding   (vector(384)) — usado apenas na seção 11.3.A
--   :notebook_id       (uuid)  — usado apenas na seção 11.3.A
-- ============================================================================

-- Migration: 00001_create_schema.sql
-- SEI-Perceptio — Seções 6.1 (extensões/funções) e 6.2 (tabelas)

-- =============================================================================
-- 6.1 Extensões e Funções Auxiliares
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_checksum(p_bytea BYTEA)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(sha256(p_bytea), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- 6.2 Tabelas Principais
-- =============================================================================

-- orgao (Tenant)
CREATE TABLE orgao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    sigla TEXT NOT NULL UNIQUE,
    municipio TEXT,
    uf CHAR(2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER orgao_updated_at BEFORE UPDATE ON orgao
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- perfil (RBAC)
CREATE TABLE perfil (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'analista', 'consultor')),
    nome_completo TEXT NOT NULL,
    sigla_unidade TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, orgao_id)
);
CREATE TRIGGER perfil_updated_at BEFORE UPDATE ON perfil
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- processo
CREATE TABLE processo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nup TEXT NOT NULL,
    tipo_processo_codigo TEXT NOT NULL,
    tipo_processo_desc TEXT NOT NULL,
    interessados JSONB NOT NULL DEFAULT '[]'::jsonb,
    data_geracao DATE NOT NULL,
    data_inclusao DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('aberto', 'em_tramitacao', 'concluido', 'arquivado')),
    unidade_atual TEXT NOT NULL,
    unidade_geradora TEXT NOT NULL,
    classificacao JSONB NOT NULL DEFAULT '{"area":"","categoria":"","subcategoria":""}'::jsonb,
    sigiloso BOOLEAN NOT NULL DEFAULT FALSE,
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_processo_nup_orgao UNIQUE(nup, orgao_id),
    CONSTRAINT chk_data_geracao_inclusao CHECK (data_geracao <= data_inclusao)
);
CREATE TRIGGER processo_updated_at BEFORE UPDATE ON processo
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- documento
CREATE TABLE documento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_sei TEXT NOT NULL,
    processo_id UUID NOT NULL REFERENCES processo(id) ON DELETE CASCADE,
    tipo_documento_codigo TEXT NOT NULL,
    tipo_documento_desc TEXT NOT NULL,
    unidade_geradora TEXT NOT NULL,
    data_documento DATE,
    data_inclusao DATE,
    conteudo_texto TEXT,
    caminho_arquivo TEXT,
    checksum TEXT,
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_documento_sei_orgao UNIQUE(numero_sei, orgao_id)
);
CREATE TRIGGER documento_updated_at BEFORE UPDATE ON documento
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- andamento
CREATE TABLE andamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id UUID NOT NULL REFERENCES processo(id) ON DELETE CASCADE,
    data_hora TIMESTAMPTZ NOT NULL,
    unidade TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN (
        'recebimento', 'remessa', 'conclusao', 'reabertura',
        'anexacao', 'desanexacao', 'distribuicao'
    )),
    descricao TEXT NOT NULL,
    processo_referenciado_id UUID REFERENCES processo(id),
    relator_id UUID REFERENCES perfil(user_id),
    sessao_distribuicao TEXT,
    resultado_deliberativo TEXT,
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- anexacao
CREATE TABLE anexacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_pai_id UUID NOT NULL REFERENCES processo(id) ON DELETE CASCADE,
    processo_filho_id UUID NOT NULL REFERENCES processo(id) ON DELETE CASCADE,
    data_anexacao DATE NOT NULL,
    data_desanexacao DATE,
    chamado_suporte TEXT,
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- consulta_publica
CREATE TABLE consulta_publica (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id UUID NOT NULL REFERENCES processo(id) ON DELETE CASCADE,
    data_abertura DATE NOT NULL,
    data_encerramento_original DATE NOT NULL,
    data_encerramento_efetiva DATE NOT NULL,
    status_inferido TEXT NOT NULL CHECK (status_inferido IN ('em_andamento', 'encerrada')),
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- prorrogacao_cp
CREATE TABLE prorrogacao_cp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consulta_publica_id UUID NOT NULL REFERENCES consulta_publica(id) ON DELETE CASCADE,
    documento_sei_id UUID REFERENCES documento(id),
    data_encerramento_nova DATE NOT NULL,
    data_extracao DATE NOT NULL DEFAULT CURRENT_DATE,
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- notebook
CREATE TABLE notebook (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE,
    usuario_criador_id UUID NOT NULL REFERENCES auth.users(id),
    nome TEXT NOT NULL,
    descricao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER notebook_updated_at BEFORE UPDATE ON notebook
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- fonte
CREATE TABLE fonte (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notebook_id UUID NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
    tipo_origem TEXT NOT NULL CHECK (tipo_origem IN ('seed_data', 'upload', 'url')),
    documento_sei_id UUID REFERENCES documento(id),
    caminho_arquivo TEXT,
    url TEXT,
    titulo TEXT NOT NULL,
    conteudo_texto TEXT,
    checksum TEXT,
    anonimizada BOOLEAN NOT NULL DEFAULT FALSE,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    metadados_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE,
    data_ingestao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- chunk (vetores)
CREATE TABLE chunk (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fonte_id UUID NOT NULL REFERENCES fonte(id) ON DELETE CASCADE,
    conteudo TEXT NOT NULL,
    posicao_inicio INTEGER NOT NULL,
    posicao_fim INTEGER NOT NULL,
    embedding VECTOR(384),
    metadados_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- conversa
CREATE TABLE conversa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notebook_id UUID NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES auth.users(id),
    titulo TEXT,
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_ultima_interacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE
);

-- mensagem
CREATE TABLE mensagem (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversa_id UUID NOT NULL REFERENCES conversa(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    conteudo TEXT NOT NULL,
    chunks_citados JSONB NOT NULL DEFAULT '[]'::jsonb,
    indicador_confianca JSONB NOT NULL DEFAULT '{}'::jsonb,
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE,
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- tag + fonte_tag (N:N)
CREATE TABLE tag (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    cor TEXT NOT NULL DEFAULT '#6366f1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(orgao_id, nome)
);

CREATE TABLE fonte_tag (
    fonte_id UUID NOT NULL REFERENCES fonte(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
    PRIMARY KEY (fonte_id, tag_id)
);

-- compartilhamento
CREATE TABLE compartilhamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notebook_id UUID NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
    usuario_destino_id UUID NOT NULL REFERENCES auth.users(id),
    permissao TEXT NOT NULL CHECK (permissao IN ('leitura', 'comentario', 'edicao')),
    compartilhado_por_id UUID NOT NULL REFERENCES auth.users(id),
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE,
    data_compartilhamento TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- monitoramento
CREATE TABLE monitoramento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id),
    processo_id UUID NOT NULL REFERENCES processo(id) ON DELETE CASCADE,
    intervalo_verificacao TEXT NOT NULL CHECK (intervalo_verificacao IN ('1h', '6h', '24h')),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE,
    data_cadastro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(usuario_id, processo_id)
);

-- alerta
CREATE TABLE alerta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitoramento_id UUID NOT NULL REFERENCES monitoramento(id) ON DELETE CASCADE,
    tipo_evento TEXT NOT NULL CHECK (tipo_evento IN (
        'novo_andamento', 'alteracao_status', 'prazo_proximo',
        'anexacao', 'distribuicao'
    )),
    processo_id UUID NOT NULL REFERENCES processo(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    lido BOOLEAN NOT NULL DEFAULT FALSE,
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE,
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- audit_log (INSERT only — sem trigger de UPDATE)
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES auth.users(id),
    acao TEXT NOT NULL CHECK (acao IN (
        'ingestao', 'consulta', 'modificacao', 'exportacao',
        'login', 'logout', 'compartilhamento', 'configuracao'
    )),
    entidade_tipo TEXT NOT NULL,
    entidade_id UUID,
    detalhes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE,
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- snapshot_processo
CREATE TABLE snapshot_processo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id UUID NOT NULL REFERENCES processo(id) ON DELETE CASCADE,
    dados_json JSONB NOT NULL,
    data_snapshot TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    versao INTEGER NOT NULL,
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE
);

-- politica_retensao
CREATE TABLE politica_retensao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    tipo_entidade TEXT NOT NULL,
    regra JSONB NOT NULL,
    acao TEXT NOT NULL CHECK (acao IN ('excluir', 'anonimizar')),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_por_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- seed_job
CREATE TABLE seed_job (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL CHECK (tipo IN (
        'processos', 'documentos', 'andamentos', 'anexacoes', 'consultas_publicas'
    )),
    nup_alvo TEXT,
    filtros_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('pendente', 'em_execucao', 'concluido', 'erro')),
    data_inicio TIMESTAMPTZ,
    data_fim TIMESTAMPTZ,
    registros_inseridos INTEGER DEFAULT 0,
    erro_msg TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

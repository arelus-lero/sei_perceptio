import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  customType,
  date,
  inet,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

/** Coluna gerada em 00004_create_indexes.sql (STORED). */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tsvector';
  },
});

// ---------------------------------------------------------------------------
// Tipos de domínio (espelham CHECK constraints do SQL)
// ---------------------------------------------------------------------------

export type UserRole = 'admin' | 'analista' | 'consultor';

export type ProcessoStatus =
  | 'aberto'
  | 'em_tramitacao'
  | 'concluido'
  | 'arquivado';

export type AndamentoTipo =
  | 'recebimento'
  | 'remessa'
  | 'conclusao'
  | 'reabertura'
  | 'anexacao'
  | 'desanexacao'
  | 'distribuicao';

export type ConsultaPublicaStatus = 'em_andamento' | 'encerrada';

export type FonteTipoOrigem = 'seed_data' | 'upload' | 'url';

export type MensagemRole = 'user' | 'assistant' | 'system';

export type CompartilhamentoPermissao = 'leitura' | 'comentario' | 'edicao';

export type MonitoramentoIntervalo = '1h' | '6h' | '24h';

export type AlertaTipoEvento =
  | 'novo_andamento'
  | 'alteracao_status'
  | 'prazo_proximo'
  | 'anexacao'
  | 'distribuicao';

export type AuditLogAcao =
  | 'ingestao'
  | 'consulta'
  | 'modificacao'
  | 'exportacao'
  | 'login'
  | 'logout'
  | 'compartilhamento'
  | 'configuracao';

export type PoliticaRetencaoAcao = 'excluir' | 'anonimizar';

export type SeedJobTipo =
  | 'processos'
  | 'documentos'
  | 'andamentos'
  | 'anexacoes'
  | 'consultas_publicas';

export type SeedJobStatus = 'pendente' | 'em_execucao' | 'concluido' | 'erro';

export interface ProcessoClassificacao {
  area: string;
  categoria: string;
  subcategoria: string;
}

export interface ChunkCitado {
  chunk_id: string;
  fonte_id: string;
  score?: number;
}

export interface IndicadorConfiancaEntry {
  afirmacao: string;
  nivel: 'alto' | 'medio' | 'baixo';
  chunk_id_referencia?: string;
}

export interface PoliticaRetencaoRegra {
  tipo: 'periodo_dias' | 'apos_conclusao';
  valor: number;
}

// Stub read-only — tabela gerenciada pelo Supabase Auth (FKs no DDL)
export const authSchema = pgSchema('auth');

export const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
});

const defaultClassificacao: ProcessoClassificacao = {
  area: '',
  categoria: '',
  subcategoria: '',
};

// ---------------------------------------------------------------------------
// Tabelas public
// ---------------------------------------------------------------------------

export const orgao = pgTable('orgao', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  sigla: text('sigla').notNull().unique(),
  municipio: text('municipio'),
  uf: char('uf', { length: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const perfil = pgTable(
  'perfil',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    orgaoId: uuid('orgao_id')
      .notNull()
      .references(() => orgao.id, { onDelete: 'cascade' }),
    role: text('role').$type<UserRole>().notNull(),
    nomeCompleto: text('nome_completo').notNull(),
    siglaUnidade: text('sigla_unidade'),
    onboardingConcluido: boolean('onboarding_concluido').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique('perfil_user_id_orgao_id_key').on(table.userId, table.orgaoId)],
);

export const processo = pgTable(
  'processo',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nup: text('nup').notNull(),
    tipoProcessoCodigo: text('tipo_processo_codigo').notNull(),
    tipoProcessoDesc: text('tipo_processo_desc').notNull(),
    interessados: jsonb('interessados')
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default([]),
    dataGeracao: date('data_geracao').notNull(),
    dataInclusao: date('data_inclusao').notNull(),
    status: text('status').$type<ProcessoStatus>().notNull(),
    unidadeAtual: text('unidade_atual').notNull(),
    unidadeGeradora: text('unidade_geradora').notNull(),
    classificacao: jsonb('classificacao')
      .$type<ProcessoClassificacao>()
      .notNull()
      .default(defaultClassificacao),
    sigiloso: boolean('sigiloso').notNull().default(false),
    orgaoId: uuid('orgao_id')
      .notNull()
      .references(() => orgao.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('uq_processo_nup_orgao').on(table.nup, table.orgaoId),
    check(
      'chk_data_geracao_inclusao',
      sql`${table.dataGeracao} <= ${table.dataInclusao}`,
    ),
  ],
);

export const documento = pgTable(
  'documento',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    numeroSei: text('numero_sei').notNull(),
    processoId: uuid('processo_id')
      .notNull()
      .references(() => processo.id, { onDelete: 'cascade' }),
    tipoDocumentoCodigo: text('tipo_documento_codigo').notNull(),
    tipoDocumentoDesc: text('tipo_documento_desc').notNull(),
    unidadeGeradora: text('unidade_geradora').notNull(),
    dataDocumento: date('data_documento'),
    dataInclusao: date('data_inclusao'),
    conteudoTexto: text('conteudo_texto'),
    caminhoArquivo: text('caminho_arquivo'),
    checksum: text('checksum'),
    orgaoId: uuid('orgao_id')
      .notNull()
      .references(() => orgao.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique('uq_documento_sei_orgao').on(table.numeroSei, table.orgaoId)],
);

export const andamento = pgTable('andamento', {
  id: uuid('id').primaryKey().defaultRandom(),
  processoId: uuid('processo_id')
    .notNull()
    .references(() => processo.id, { onDelete: 'cascade' }),
  dataHora: timestamp('data_hora', { withTimezone: true, mode: 'string' }).notNull(),
  unidade: text('unidade').notNull(),
  tipo: text('tipo').$type<AndamentoTipo>().notNull(),
  descricao: text('descricao').notNull(),
  processoReferenciadoId: uuid('processo_referenciado_id').references(
    () => processo.id,
  ),
  relatorId: uuid('relator_id').references(() => perfil.userId),
  sessaoDistribuicao: text('sessao_distribuicao'),
  resultadoDeliberativo: text('resultado_deliberativo'),
  orgaoId: uuid('orgao_id')
    .notNull()
    .references(() => orgao.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const anexacao = pgTable('anexacao', {
  id: uuid('id').primaryKey().defaultRandom(),
  processoPaiId: uuid('processo_pai_id')
    .notNull()
    .references(() => processo.id, { onDelete: 'cascade' }),
  processoFilhoId: uuid('processo_filho_id')
    .notNull()
    .references(() => processo.id, { onDelete: 'cascade' }),
  dataAnexacao: date('data_anexacao').notNull(),
  dataDesanexacao: date('data_desanexacao'),
  chamadoSuporte: text('chamado_suporte'),
  orgaoId: uuid('orgao_id')
    .notNull()
    .references(() => orgao.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const consultaPublica = pgTable('consulta_publica', {
  id: uuid('id').primaryKey().defaultRandom(),
  processoId: uuid('processo_id')
    .notNull()
    .references(() => processo.id, { onDelete: 'cascade' }),
  dataAbertura: date('data_abertura').notNull(),
  dataEncerramentoOriginal: date('data_encerramento_original').notNull(),
  dataEncerramentoEfetiva: date('data_encerramento_efetiva').notNull(),
  statusInferido: text('status_inferido')
    .$type<ConsultaPublicaStatus>()
    .notNull(),
  orgaoId: uuid('orgao_id')
    .notNull()
    .references(() => orgao.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const prorrogacaoCp = pgTable('prorrogacao_cp', {
  id: uuid('id').primaryKey().defaultRandom(),
  consultaPublicaId: uuid('consulta_publica_id')
    .notNull()
    .references(() => consultaPublica.id, { onDelete: 'cascade' }),
  documentoSeiId: uuid('documento_sei_id').references(() => documento.id),
  dataEncerramentoNova: date('data_encerramento_nova').notNull(),
  dataExtracao: date('data_extracao').notNull().defaultNow(),
  orgaoId: uuid('orgao_id')
    .notNull()
    .references(() => orgao.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const notebook = pgTable('notebook', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgaoId: uuid('orgao_id')
    .notNull()
    .references(() => orgao.id, { onDelete: 'cascade' }),
  usuarioCriadorId: uuid('usuario_criador_id')
    .notNull()
    .references(() => authUsers.id),
  nome: text('nome').notNull(),
  descricao: text('descricao'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const fonte = pgTable('fonte', {
  id: uuid('id').primaryKey().defaultRandom(),
  notebookId: uuid('notebook_id')
    .notNull()
    .references(() => notebook.id, { onDelete: 'cascade' }),
  tipoOrigem: text('tipo_origem').$type<FonteTipoOrigem>().notNull(),
  documentoSeiId: uuid('documento_sei_id').references(() => documento.id),
  caminhoArquivo: text('caminho_arquivo'),
  url: text('url'),
  titulo: text('titulo').notNull(),
  conteudoTexto: text('conteudo_texto'),
  checksum: text('checksum'),
  anonimizada: boolean('anonimizada').notNull().default(false),
  ativa: boolean('ativa').notNull().default(true),
  metadadosJson: jsonb('metadados_json')
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  orgaoId: uuid('orgao_id')
    .notNull()
    .references(() => orgao.id, { onDelete: 'cascade' }),
  dataIngestao: timestamp('data_ingestao', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const chunk = pgTable('chunk', {
  id: uuid('id').primaryKey().defaultRandom(),
  fonteId: uuid('fonte_id')
    .notNull()
    .references(() => fonte.id, { onDelete: 'cascade' }),
  conteudo: text('conteudo').notNull(),
  tsv: tsvector('tsv'),
  posicaoInicio: integer('posicao_inicio').notNull(),
  posicaoFim: integer('posicao_fim').notNull(),
  embedding: vector('embedding', { dimensions: 384 }),
  metadadosJson: jsonb('metadados_json')
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  orgaoId: uuid('orgao_id')
    .notNull()
    .references(() => orgao.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const conversa = pgTable('conversa', {
  id: uuid('id').primaryKey().defaultRandom(),
  notebookId: uuid('notebook_id')
    .notNull()
    .references(() => notebook.id, { onDelete: 'cascade' }),
  usuarioId: uuid('usuario_id')
    .notNull()
    .references(() => authUsers.id),
  titulo: text('titulo'),
  dataCriacao: timestamp('data_criacao', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  dataUltimaInteracao: timestamp('data_ultima_interacao', {
    withTimezone: true,
    mode: 'string',
  })
    .notNull()
    .defaultNow(),
  orgaoId: uuid('orgao_id')
    .notNull()
    .references(() => orgao.id, { onDelete: 'cascade' }),
});

export const mensagem = pgTable('mensagem', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversaId: uuid('conversa_id')
    .notNull()
    .references(() => conversa.id, { onDelete: 'cascade' }),
  role: text('role').$type<MensagemRole>().notNull(),
  conteudo: text('conteudo').notNull(),
  chunksCitados: jsonb('chunks_citados')
    .$type<ChunkCitado[]>()
    .notNull()
    .default([]),
  indicadorConfianca: jsonb('indicador_confianca')
    .$type<Record<string, IndicadorConfiancaEntry>>()
    .notNull()
    .default({}),
  orgaoId: uuid('orgao_id')
    .notNull()
    .references(() => orgao.id, { onDelete: 'cascade' }),
  dataCriacao: timestamp('data_criacao', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const tag = pgTable(
  'tag',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgaoId: uuid('orgao_id')
      .notNull()
      .references(() => orgao.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    cor: text('cor').notNull().default('#6366f1'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique('tag_orgao_id_nome_key').on(table.orgaoId, table.nome)],
);

export const fonteTag = pgTable(
  'fonte_tag',
  {
    fonteId: uuid('fonte_id')
      .notNull()
      .references(() => fonte.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tag.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.fonteId, table.tagId] })],
);

export const compartilhamento = pgTable('compartilhamento', {
  id: uuid('id').primaryKey().defaultRandom(),
  notebookId: uuid('notebook_id')
    .notNull()
    .references(() => notebook.id, { onDelete: 'cascade' }),
  usuarioDestinoId: uuid('usuario_destino_id')
    .notNull()
    .references(() => authUsers.id),
  permissao: text('permissao').$type<CompartilhamentoPermissao>().notNull(),
  compartilhadoPorId: uuid('compartilhado_por_id')
    .notNull()
    .references(() => authUsers.id),
  orgaoId: uuid('orgao_id')
    .notNull()
    .references(() => orgao.id, { onDelete: 'cascade' }),
  dataCompartilhamento: timestamp('data_compartilhamento', {
    withTimezone: true,
    mode: 'string',
  })
    .notNull()
    .defaultNow(),
});

export const monitoramento = pgTable(
  'monitoramento',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => authUsers.id),
    processoId: uuid('processo_id')
      .notNull()
      .references(() => processo.id, { onDelete: 'cascade' }),
    intervaloVerificacao: text('intervalo_verificacao')
      .$type<MonitoramentoIntervalo>()
      .notNull(),
    ativo: boolean('ativo').notNull().default(true),
    orgaoId: uuid('orgao_id')
      .notNull()
      .references(() => orgao.id, { onDelete: 'cascade' }),
    dataCadastro: timestamp('data_cadastro', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('monitoramento_usuario_id_processo_id_key').on(
      table.usuarioId,
      table.processoId,
    ),
  ],
);

export const alerta = pgTable('alerta', {
  id: uuid('id').primaryKey().defaultRandom(),
  monitoramentoId: uuid('monitoramento_id')
    .notNull()
    .references(() => monitoramento.id, { onDelete: 'cascade' }),
  tipoEvento: text('tipo_evento').$type<AlertaTipoEvento>().notNull(),
  processoId: uuid('processo_id')
    .notNull()
    .references(() => processo.id, { onDelete: 'cascade' }),
  descricao: text('descricao').notNull(),
  lido: boolean('lido').notNull().default(false),
  orgaoId: uuid('orgao_id')
    .notNull()
    .references(() => orgao.id, { onDelete: 'cascade' }),
  dataCriacao: timestamp('data_criacao', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const notificacaoPreferencia = pgTable(
  'notificacao_preferencia',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    orgaoId: uuid('orgao_id')
      .notNull()
      .references(() => orgao.id, { onDelete: 'cascade' }),
    emailEventos: jsonb('email_eventos')
      .$type<Record<AlertaTipoEvento, boolean>>()
      .notNull(),
    webhookUrl: text('webhook_url'),
    webhookSecret: text('webhook_secret'),
    webhookEventos: jsonb('webhook_eventos')
      .$type<Record<AlertaTipoEvento, boolean>>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('notificacao_preferencia_usuario_id_orgao_id_key').on(
      table.usuarioId,
      table.orgaoId,
    ),
  ],
);

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id').references(() => authUsers.id),
  acao: text('acao').$type<AuditLogAcao>().notNull(),
  entidadeTipo: text('entidade_tipo').notNull(),
  entidadeId: uuid('entidade_id'),
  detalhesJson: jsonb('detalhes_json')
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  orgaoId: uuid('orgao_id')
    .notNull()
    .references(() => orgao.id, { onDelete: 'cascade' }),
  dataCriacao: timestamp('data_criacao', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const snapshotProcesso = pgTable('snapshot_processo', {
  id: uuid('id').primaryKey().defaultRandom(),
  processoId: uuid('processo_id')
    .notNull()
    .references(() => processo.id, { onDelete: 'cascade' }),
  dadosJson: jsonb('dados_json').$type<Record<string, unknown>>().notNull(),
  dataSnapshot: timestamp('data_snapshot', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  versao: integer('versao').notNull(),
  orgaoId: uuid('orgao_id')
    .notNull()
    .references(() => orgao.id, { onDelete: 'cascade' }),
});

export const politicaRetencao = pgTable('politica_retensao', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgaoId: uuid('orgao_id')
    .notNull()
    .references(() => orgao.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  tipoEntidade: text('tipo_entidade').notNull(),
  regra: jsonb('regra').$type<PoliticaRetencaoRegra>().notNull(),
  acao: text('acao').$type<PoliticaRetencaoAcao>().notNull(),
  ativo: boolean('ativo').notNull().default(true),
  criadoPorId: uuid('criado_por_id')
    .notNull()
    .references(() => authUsers.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const seedJob = pgTable('seed_job', {
  id: uuid('id').primaryKey().defaultRandom(),
  tipo: text('tipo').$type<SeedJobTipo>().notNull(),
  nupAlvo: text('nup_alvo'),
  filtrosJson: jsonb('filtros_json')
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  status: text('status').$type<SeedJobStatus>().notNull(),
  dataInicio: timestamp('data_inicio', { withTimezone: true, mode: 'string' }),
  dataFim: timestamp('data_fim', { withTimezone: true, mode: 'string' }),
  registrosInseridos: integer('registros_inseridos').default(0),
  erroMsg: text('erro_msg'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Tipos inferidos ($inferSelect / $inferInsert)
// ---------------------------------------------------------------------------

export type Orgao = typeof orgao.$inferSelect;
export type NewOrgao = typeof orgao.$inferInsert;

export type Perfil = typeof perfil.$inferSelect;
export type NewPerfil = typeof perfil.$inferInsert;

export type Processo = typeof processo.$inferSelect;
export type NewProcesso = typeof processo.$inferInsert;

export type Documento = typeof documento.$inferSelect;
export type NewDocumento = typeof documento.$inferInsert;

export type Andamento = typeof andamento.$inferSelect;
export type NewAndamento = typeof andamento.$inferInsert;

export type Anexacao = typeof anexacao.$inferSelect;
export type NewAnexacao = typeof anexacao.$inferInsert;

export type ConsultaPublicaRow = typeof consultaPublica.$inferSelect;
export type NewConsultaPublica = typeof consultaPublica.$inferInsert;

export type ProrrogacaoCp = typeof prorrogacaoCp.$inferSelect;
export type NewProrrogacaoCp = typeof prorrogacaoCp.$inferInsert;

export type Notebook = typeof notebook.$inferSelect;
export type NewNotebook = typeof notebook.$inferInsert;

export type Fonte = typeof fonte.$inferSelect;
export type NewFonte = typeof fonte.$inferInsert;

export type Chunk = typeof chunk.$inferSelect;
export type NewChunk = typeof chunk.$inferInsert;

export type Conversa = typeof conversa.$inferSelect;
export type NewConversa = typeof conversa.$inferInsert;

export type Mensagem = typeof mensagem.$inferSelect;
export type NewMensagem = typeof mensagem.$inferInsert;

export type Tag = typeof tag.$inferSelect;
export type NewTag = typeof tag.$inferInsert;

export type FonteTag = typeof fonteTag.$inferSelect;
export type NewFonteTag = typeof fonteTag.$inferInsert;

export type Compartilhamento = typeof compartilhamento.$inferSelect;
export type NewCompartilhamento = typeof compartilhamento.$inferInsert;

export type Monitoramento = typeof monitoramento.$inferSelect;
export type NewMonitoramento = typeof monitoramento.$inferInsert;

export type Alerta = typeof alerta.$inferSelect;
export type NewAlerta = typeof alerta.$inferInsert;

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;

export type SnapshotProcesso = typeof snapshotProcesso.$inferSelect;
export type NewSnapshotProcesso = typeof snapshotProcesso.$inferInsert;

export type PoliticaRetencao = typeof politicaRetencao.$inferSelect;
export type NewPoliticaRetencao = typeof politicaRetencao.$inferInsert;

export type SeedJob = typeof seedJob.$inferSelect;
export type NewSeedJob = typeof seedJob.$inferInsert;

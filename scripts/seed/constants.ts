import type { AndamentoTipo, ProcessoStatus } from '../../src/lib/db/schema';

export const SEED_ORGAO_SIGLA = 'ANEEL';
export const SEED_PROCESSO_TOTAL = 213;
export const SEED_ANO_BASE = 2024;

export const UNIDADES_ANEEL = ['STD', 'SFT', 'SGO', 'SRM', 'SDA', 'GAB'] as const;

export const TIPOS_PROCESSO = [
  {
    codigo: '100000001',
    descricao: 'Fiscalização de Concessionária de Distribuição',
  },
  {
    codigo: '100000002',
    descricao: 'Consulta Pública Tarifária',
  },
  {
    codigo: '100000003',
    descricao: 'Outorga de Geração',
  },
  {
    codigo: '100000004',
    descricao: 'Revisão Tarifária Periódica',
  },
  {
    codigo: '100000005',
    descricao: 'Processo Administrativo Sancionador',
  },
] as const;

export const TIPOS_DOCUMENTO = [
  { codigo: '107', descricao: 'Despacho' },
  { codigo: '212', descricao: 'Nota Técnica' },
  { codigo: '301', descricao: 'Parecer Técnico' },
  { codigo: '420', descricao: 'Aviso de Consulta Pública' },
  { codigo: '535', descricao: 'Aviso de Prorrogação da Consulta Pública' },
  { codigo: '610', descricao: 'Extrato da Decisão da Diretoria' },
  { codigo: '711', descricao: 'Pauta de Reunião da Diretoria' },
  { codigo: '812', descricao: 'Voto do Diretor-Relator' },
] as const;

export const RELATORES_SEED = [
  { key: 'relator-1', nome: 'Diretor Relator João Almeida', sigla: 'GAB' },
  { key: 'relator-2', nome: 'Diretora Relatora Maria Souza', sigla: 'GAB' },
  { key: 'relator-3', nome: 'Diretor Relator Carlos Mendes', sigla: 'GAB' },
] as const;

export type SeedScenario =
  | 'tramitacao'
  | 'concluido'
  | 'consulta_publica'
  | 'anexado_pai'
  | 'anexado_filho'
  | 'distribuicao';

export interface SeedScenarioConfig {
  scenario: SeedScenario;
  status: ProcessoStatus;
  documentCount: number;
  andamentoCount: number;
  prorrogacoes: number;
  paiIndex?: number;
}

export const SHOWCASE_SCENARIOS: SeedScenarioConfig[] = [
  {
    scenario: 'tramitacao',
    status: 'em_tramitacao',
    documentCount: 12,
    andamentoCount: 28,
    prorrogacoes: 0,
  },
  {
    scenario: 'concluido',
    status: 'concluido',
    documentCount: 18,
    andamentoCount: 35,
    prorrogacoes: 0,
  },
  {
    scenario: 'consulta_publica',
    status: 'em_tramitacao',
    documentCount: 14,
    andamentoCount: 22,
    prorrogacoes: 3,
  },
  {
    scenario: 'anexado_pai',
    status: 'em_tramitacao',
    documentCount: 10,
    andamentoCount: 20,
    prorrogacoes: 0,
  },
  {
    scenario: 'distribuicao',
    status: 'em_tramitacao',
    documentCount: 16,
    andamentoCount: 30,
    prorrogacoes: 0,
  },
];

export const ANDAMENTO_TIPOS_ROTATIVOS: AndamentoTipo[] = [
  'recebimento',
  'remessa',
  'conclusao',
  'reabertura',
  'anexacao',
  'desanexacao',
  'distribuicao',
];

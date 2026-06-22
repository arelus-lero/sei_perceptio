import type {
  AlertaTipoEvento,
  AndamentoTipo,
  MonitoramentoIntervalo,
  ProcessoStatus,
} from '@/lib/db/schema';

export interface SnapshotAndamento {
  id: string;
  data_hora: string;
  unidade: string;
  tipo: AndamentoTipo;
  descricao: string;
}

export interface SnapshotAnexacao {
  id: string;
  processo_pai_id: string;
  processo_filho_id: string;
  data_anexacao: string;
  data_desanexacao: string | null;
}

export interface SnapshotConsultaPublica {
  id: string;
  data_encerramento_efetiva: string;
  status_inferido: string;
}

export interface ProcessoSnapshotData {
  processo: {
    id: string;
    nup: string;
    status: ProcessoStatus;
    unidade_atual: string;
    unidade_geradora: string;
  };
  andamentos: SnapshotAndamento[];
  anexacoes: SnapshotAnexacao[];
  consulta_publica: SnapshotConsultaPublica | null;
}

export interface DetectedMonitoringEvent {
  tipo_evento: AlertaTipoEvento;
  descricao: string;
}

export interface MonitoramentoListItem {
  id: string;
  processo_id: string;
  nup: string;
  status: ProcessoStatus;
  unidade_atual: string;
  intervalo_verificacao: MonitoramentoIntervalo;
  ativo: boolean;
  data_cadastro: string;
}

export interface AlertaListItem {
  id: string;
  monitoramento_id: string;
  tipo_evento: AlertaTipoEvento;
  processo_id: string;
  nup: string;
  descricao: string;
  lido: boolean;
  data_criacao: string;
}

export interface CreatedAlerta {
  id: string;
  monitoramento_id: string;
  tipo_evento: AlertaTipoEvento;
  processo_id: string;
  descricao: string;
  orgao_id: string;
  data_criacao: string;
}

export interface CheckProcessoResult {
  processo_id: string;
  snapshot_criado: boolean;
  versao: number | null;
  eventos_detectados: number;
  alertas_gerados: number;
  alertas: CreatedAlerta[];
}

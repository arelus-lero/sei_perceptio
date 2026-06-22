import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import type { ProcessoStatus } from '@/lib/db/schema';
import type {
  DetectedMonitoringEvent,
  ProcessoSnapshotData,
} from '@/types/monitoring';

const PRAZO_PROXIMO_DIAS = 7;

const STATUS_LABELS: Record<ProcessoStatus, string> = {
  aberto: 'aberto',
  em_tramitacao: 'em tramitação',
  concluido: 'concluído',
  arquivado: 'arquivado',
};

function formatStatus(status: ProcessoStatus): string {
  return STATUS_LABELS[status] ?? status;
}

function formatDateBr(isoDate: string): string {
  try {
    return format(parseISO(isoDate), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return isoDate;
  }
}

function detectStatusChange(
  previous: ProcessoSnapshotData,
  current: ProcessoSnapshotData,
): DetectedMonitoringEvent[] {
  if (previous.processo.status === current.processo.status) {
    return [];
  }

  return [
    {
      tipo_evento: 'alteracao_status',
      descricao: `Status alterado de ${formatStatus(previous.processo.status)} para ${formatStatus(current.processo.status)} no processo ${current.processo.nup}.`,
    },
  ];
}

function detectAndamentoChanges(
  previous: ProcessoSnapshotData,
  current: ProcessoSnapshotData,
): DetectedMonitoringEvent[] {
  const previousIds = new Set(previous.andamentos.map((item) => item.id));
  const events: DetectedMonitoringEvent[] = [];

  for (const andamento of current.andamentos) {
    if (previousIds.has(andamento.id)) {
      continue;
    }

    if (andamento.tipo === 'distribuicao') {
      events.push({
        tipo_evento: 'distribuicao',
        descricao: `Distribuição registrada (${andamento.unidade}): ${andamento.descricao}`,
      });
      continue;
    }

    events.push({
      tipo_evento: 'novo_andamento',
      descricao: `Novo andamento (${andamento.tipo}) em ${andamento.unidade} em ${formatDateBr(andamento.data_hora)}: ${andamento.descricao}`,
    });
  }

  return events;
}

function detectAnexacaoChanges(
  previous: ProcessoSnapshotData,
  current: ProcessoSnapshotData,
): DetectedMonitoringEvent[] {
  const previousById = new Map(
    previous.anexacoes.map((item) => [item.id, item]),
  );
  const events: DetectedMonitoringEvent[] = [];

  for (const anexacao of current.anexacoes) {
    const old = previousById.get(anexacao.id);

    if (!old) {
      events.push({
        tipo_evento: 'anexacao',
        descricao: `Nova anexação registrada em ${formatDateBr(anexacao.data_anexacao)}.`,
      });
      continue;
    }

    if (
      old.data_desanexacao === null &&
      anexacao.data_desanexacao !== null
    ) {
      events.push({
        tipo_evento: 'anexacao',
        descricao: `Desanexação registrada em ${formatDateBr(anexacao.data_desanexacao)}.`,
      });
    }
  }

  return events;
}

function detectPrazoProximo(
  previous: ProcessoSnapshotData,
  current: ProcessoSnapshotData,
): DetectedMonitoringEvent[] {
  const consulta = current.consulta_publica;
  if (!consulta) {
    return [];
  }

  const encerramento = parseISO(consulta.data_encerramento_efetiva);
  const diasRestantes = differenceInCalendarDays(encerramento, new Date());

  if (diasRestantes < 0 || diasRestantes > PRAZO_PROXIMO_DIAS) {
    return [];
  }

  const previousConsulta = previous.consulta_publica;
  if (
    previousConsulta &&
    previousConsulta.data_encerramento_efetiva ===
      consulta.data_encerramento_efetiva
  ) {
    return [];
  }

  return [
    {
      tipo_evento: 'prazo_proximo',
      descricao: `Consulta pública encerra em ${diasRestantes} dia(s) (${formatDateBr(consulta.data_encerramento_efetiva)}).`,
    },
  ];
}

export function detectSnapshotChanges(
  previous: ProcessoSnapshotData,
  current: ProcessoSnapshotData,
): DetectedMonitoringEvent[] {
  return [
    ...detectStatusChange(previous, current),
    ...detectAndamentoChanges(previous, current),
    ...detectAnexacaoChanges(previous, current),
    ...detectPrazoProximo(previous, current),
  ];
}

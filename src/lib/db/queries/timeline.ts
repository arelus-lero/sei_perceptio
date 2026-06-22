import { parseISO } from 'date-fns';

import type { AndamentoTipo } from '@/lib/db/schema';
import type {
  ProcessoTimelineData,
  TimelineEvento,
  TimelineMarco,
} from '@/types/timeline';
import type { SupabaseClient } from '@supabase/supabase-js';

interface AndamentoRow {
  id: string;
  data_hora: string;
  unidade: string;
  tipo: AndamentoTipo;
  descricao: string;
}

interface ConsultaPublicaRow {
  id: string;
  data_abertura: string;
  data_encerramento_original: string;
  data_encerramento_efetiva: string;
  status_inferido: string;
}

function marcoFromAndamentoTipo(tipo: AndamentoTipo): TimelineMarco | null {
  switch (tipo) {
    case 'distribuicao':
      return 'distribuicao';
    case 'conclusao':
      return 'conclusao';
    case 'anexacao':
    case 'desanexacao':
      return 'anexacao';
    default:
      return null;
  }
}

function dateToIsoStart(isoDate: string): string {
  return `${isoDate}T09:00:00.000Z`;
}

function buildAndamentoEventos(andamentos: AndamentoRow[]): TimelineEvento[] {
  const sorted = [...andamentos].sort(
    (a, b) => parseISO(a.data_hora).getTime() - parseISO(b.data_hora).getTime(),
  );

  return sorted.map((andamento, index) => {
    const marco = marcoFromAndamentoTipo(andamento.tipo);
    const unidadeAnterior =
      index > 0 ? (sorted[index - 1]?.unidade ?? andamento.unidade) : andamento.unidade;

    const isRemessa = andamento.tipo === 'remessa';

    return {
      id: andamento.id,
      data_hora: andamento.data_hora,
      tipo: andamento.tipo,
      unidade_origem: isRemessa ? unidadeAnterior : andamento.unidade,
      unidade_destino: andamento.unidade,
      descricao: andamento.descricao,
      destaque: marco !== null,
      marco,
    };
  });
}

function buildConsultaPublicaEventos(
  consulta: ConsultaPublicaRow,
): TimelineEvento[] {
  const eventos: TimelineEvento[] = [
    {
      id: `cp-abertura-${consulta.id}`,
      data_hora: dateToIsoStart(consulta.data_abertura),
      tipo: 'consulta_publica',
      unidade_origem: null,
      unidade_destino: null,
      descricao: `Abertura da consulta pública (encerramento previsto em ${consulta.data_encerramento_original}).`,
      destaque: true,
      marco: 'consulta_publica',
    },
  ];

  if (consulta.data_encerramento_efetiva !== consulta.data_encerramento_original) {
    eventos.push({
      id: `cp-prorrogacao-${consulta.id}`,
      data_hora: dateToIsoStart(consulta.data_encerramento_efetiva),
      tipo: 'consulta_publica',
      unidade_origem: null,
      unidade_destino: null,
      descricao: `Encerramento efetivo da consulta pública (${consulta.status_inferido}).`,
      destaque: true,
      marco: 'consulta_publica',
    });
  } else {
    eventos.push({
      id: `cp-encerramento-${consulta.id}`,
      data_hora: dateToIsoStart(consulta.data_encerramento_efetiva),
      tipo: 'consulta_publica',
      unidade_origem: null,
      unidade_destino: null,
      descricao: `Encerramento da consulta pública (${consulta.status_inferido}).`,
      destaque: true,
      marco: 'consulta_publica',
    });
  }

  return eventos;
}

function collectUnidades(eventos: TimelineEvento[]): string[] {
  const unidades = new Set<string>();

  for (const evento of eventos) {
    if (evento.unidade_origem) {
      unidades.add(evento.unidade_origem);
    }
    if (evento.unidade_destino) {
      unidades.add(evento.unidade_destino);
    }
  }

  return [...unidades].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function applyTimelineFilters(
  eventos: TimelineEvento[],
  filters?: {
    unidade?: string;
    data_inicio?: string;
    data_fim?: string;
  },
): TimelineEvento[] {
  let filtered = eventos;

  if (filters?.unidade) {
    filtered = filtered.filter(
      (evento) =>
        evento.unidade_origem === filters.unidade ||
        evento.unidade_destino === filters.unidade,
    );
  }

  if (filters?.data_inicio) {
    const inicio = parseISO(filters.data_inicio).getTime();
    filtered = filtered.filter(
      (evento) => parseISO(evento.data_hora).getTime() >= inicio,
    );
  }

  if (filters?.data_fim) {
    const fim = parseISO(`${filters.data_fim}T23:59:59.999Z`).getTime();
    filtered = filtered.filter(
      (evento) => parseISO(evento.data_hora).getTime() <= fim,
    );
  }

  return filtered;
}

export async function getProcessoTimeline(
  supabase: SupabaseClient,
  orgaoId: string,
  nup: string,
  filters?: {
    unidade?: string;
    data_inicio?: string;
    data_fim?: string;
  },
): Promise<ProcessoTimelineData | null> {
  const { data: processo, error: processoError } = await supabase
    .from('processo')
    .select('id, nup, status, tipo_processo_desc, sigiloso, tipo_processo_codigo')
    .eq('nup', nup)
    .eq('orgao_id', orgaoId)
    .maybeSingle();

  if (processoError) {
    throw new Error(processoError.message);
  }

  if (!processo) {
    return null;
  }

  if (processo.sigiloso || processo.tipo_processo_codigo === '100001101') {
    throw new Error('Processo sigiloso não disponível para visualização');
  }

  const { data: andamentos, error: andamentosError } = await supabase
    .from('andamento')
    .select('id, data_hora, unidade, tipo, descricao')
    .eq('processo_id', processo.id)
    .eq('orgao_id', orgaoId)
    .order('data_hora', { ascending: true });

  if (andamentosError) {
    throw new Error(andamentosError.message);
  }

  const { data: consultaPublica, error: consultaError } = await supabase
    .from('consulta_publica')
    .select(
      'id, data_abertura, data_encerramento_original, data_encerramento_efetiva, status_inferido',
    )
    .eq('processo_id', processo.id)
    .eq('orgao_id', orgaoId)
    .maybeSingle();

  if (consultaError) {
    throw new Error(consultaError.message);
  }

  const andamentoEventos = buildAndamentoEventos(
    (andamentos ?? []) as AndamentoRow[],
  );
  const consultaEventos = consultaPublica
    ? buildConsultaPublicaEventos(consultaPublica as ConsultaPublicaRow)
    : [];

  const allEventos = [...andamentoEventos, ...consultaEventos].sort(
    (a, b) => parseISO(a.data_hora).getTime() - parseISO(b.data_hora).getTime(),
  );

  const unidades = collectUnidades(allEventos);
  const eventos = applyTimelineFilters(allEventos, filters);

  return {
    nup: processo.nup,
    processo_id: processo.id,
    tipo_processo_desc: processo.tipo_processo_desc,
    status: processo.status,
    unidades,
    eventos,
  };
}

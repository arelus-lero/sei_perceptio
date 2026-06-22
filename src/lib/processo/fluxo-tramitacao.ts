import { differenceInCalendarDays, parseISO } from 'date-fns';

import type { AndamentoTipo } from '@/lib/db/schema';
import type {
  FluxoSegmento,
  FluxoTramitacaoData,
  FluxoUnidadeResumo,
} from '@/types/fluxo';

interface AndamentoFluxoRow {
  data_hora: string;
  unidade: string;
  tipo: AndamentoTipo;
}

function buildSegmentos(andamentos: AndamentoFluxoRow[]): FluxoSegmento[] {
  if (andamentos.length === 0) {
    return [];
  }

  const sorted = [...andamentos].sort(
    (a, b) => parseISO(a.data_hora).getTime() - parseISO(b.data_hora).getTime(),
  );

  const segmentos: FluxoSegmento[] = [];
  let segmentoAtual: FluxoSegmento = {
    unidade: sorted[0]!.unidade,
    data_entrada: sorted[0]!.data_hora,
    data_saida: null,
    dias_permanencia: 0,
    andamentos_no_segmento: 1,
  };

  for (let index = 1; index < sorted.length; index += 1) {
    const andamento = sorted[index]!;

    if (andamento.unidade === segmentoAtual.unidade) {
      segmentoAtual.andamentos_no_segmento += 1;
      continue;
    }

    segmentoAtual.data_saida = andamento.data_hora;
    segmentoAtual.dias_permanencia = Math.max(
      0,
      differenceInCalendarDays(
        parseISO(segmentoAtual.data_saida),
        parseISO(segmentoAtual.data_entrada),
      ),
    );
    segmentos.push(segmentoAtual);

    segmentoAtual = {
      unidade: andamento.unidade,
      data_entrada: andamento.data_hora,
      data_saida: null,
      dias_permanencia: 0,
      andamentos_no_segmento: 1,
    };
  }

  const fimReferencia = sorted[sorted.length - 1]!.data_hora;
  segmentoAtual.data_saida = fimReferencia;
  segmentoAtual.dias_permanencia = Math.max(
    0,
    differenceInCalendarDays(
      parseISO(segmentoAtual.data_saida),
      parseISO(segmentoAtual.data_entrada),
    ),
  );
  segmentos.push(segmentoAtual);

  return segmentos;
}

function buildResumoUnidades(segmentos: FluxoSegmento[]): FluxoUnidadeResumo[] {
  const map = new Map<string, { total_dias: number; visitas: number }>();

  for (const segmento of segmentos) {
    const current = map.get(segmento.unidade) ?? { total_dias: 0, visitas: 0 };
    current.total_dias += segmento.dias_permanencia;
    current.visitas += 1;
    map.set(segmento.unidade, current);
  }

  const valores = [...map.values()];
  const mediaTotal =
    valores.length > 0
      ? valores.reduce((sum, item) => sum + item.total_dias, 0) / valores.length
      : 0;
  const limiteGargalo = mediaTotal * 1.35;

  return [...map.entries()]
    .map(([unidade, stats]) => ({
      unidade,
      total_dias: stats.total_dias,
      visitas: stats.visitas,
      media_dias_por_visita:
        stats.visitas > 0
          ? Math.round((stats.total_dias / stats.visitas) * 10) / 10
          : 0,
      gargalo: stats.total_dias >= limiteGargalo && stats.total_dias > 0,
    }))
    .sort((a, b) => b.total_dias - a.total_dias);
}

export function buildFluxoTramitacao(
  nup: string,
  processoId: string,
  andamentos: AndamentoFluxoRow[],
): FluxoTramitacaoData {
  const segmentos = buildSegmentos(andamentos);
  const resumo_unidades = buildResumoUnidades(segmentos);
  const gargalos = resumo_unidades.filter((item) => item.gargalo);
  const tempo_total_dias = segmentos.reduce(
    (sum, segmento) => sum + segmento.dias_permanencia,
    0,
  );

  const ordem_unidades: string[] = [];
  for (const segmento of segmentos) {
    if (!ordem_unidades.includes(segmento.unidade)) {
      ordem_unidades.push(segmento.unidade);
    }
  }

  const limite_gargalo_dias =
    resumo_unidades.length > 0
      ? Math.round(
          (resumo_unidades.reduce((sum, item) => sum + item.total_dias, 0) /
            resumo_unidades.length) *
            1.35,
        )
      : 0;

  return {
    nup,
    processo_id: processoId,
    segmentos,
    resumo_unidades,
    gargalos,
    tempo_total_dias,
    ordem_unidades,
    limite_gargalo_dias,
  };
}

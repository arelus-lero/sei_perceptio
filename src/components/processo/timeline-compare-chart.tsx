'use client';

import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

import { ChartContainer } from '@/components/ui/chart-container';
import { truncateNupLabel } from '@/lib/processo/timeline-colors';
import { getCompareTimelineDomain } from '@/lib/processo/timeline-filters';
import type { TimelineCompareProcesso, TimelineMarco } from '@/types/timeline';

const TIPO_LABELS: Record<string, string> = {
  recebimento: 'Recebimento',
  remessa: 'Remessa',
  conclusao: 'Conclusão',
  reabertura: 'Reabertura',
  anexacao: 'Anexação',
  desanexacao: 'Desanexação',
  distribuicao: 'Distribuição',
  consulta_publica: 'Consulta pública',
};

const MARCO_LABELS: Record<TimelineMarco, string> = {
  distribuicao: 'Distribuição',
  conclusao: 'Conclusão',
  anexacao: 'Anexação',
  consulta_publica: 'Consulta pública',
};

interface CompareChartPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  nup: string;
  cor: string;
  label: string;
  evento: TimelineCompareProcesso['eventos'][number];
}

interface TimelineCompareChartProps {
  processos: TimelineCompareProcesso[];
}

function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

export function TimelineCompareLegend({
  processos,
}: {
  processos: TimelineCompareProcesso[];
}) {
  return (
    <div
      className="flex flex-wrap gap-3 rounded-lg border border-border bg-muted/20 p-3 text-xs"
      aria-label="Legenda de processos"
    >
      {processos.map((processo) => (
        <div key={processo.processo_id} className="flex items-center gap-2">
          <span
            className="size-3 shrink-0 rounded-full"
            style={{ background: processo.cor }}
            aria-hidden
          />
          <span className="font-mono font-medium" title={processo.nup}>
            {truncateNupLabel(processo.nup, 24)}
          </span>
          <span className="text-muted-foreground">
            · {processo.eventos.length} evento(s)
          </span>
        </div>
      ))}
    </div>
  );
}

export function TimelineCompareChart({ processos }: TimelineCompareChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { points, laneLabels, marcoDates, domain } = useMemo(() => {
    const labels = processos.map((processo) => processo.nup);
    const laneByNup = new Map(labels.map((nup, index) => [nup, index]));

    const chartPoints: CompareChartPoint[] = processos.flatMap((processo) =>
      processo.eventos.map((evento) => ({
        id: `${processo.processo_id}-${evento.id}`,
        x: parseISO(evento.data_hora).getTime(),
        y: laneByNup.get(processo.nup) ?? 0,
        z: evento.destaque ? 160 : 80,
        nup: processo.nup,
        cor: processo.cor,
        label: TIPO_LABELS[evento.tipo] ?? evento.tipo,
        evento,
      })),
    );

    const marcos = chartPoints
      .filter((point) => point.evento.destaque)
      .map((point) => point.x);

    return {
      points: chartPoints,
      laneLabels: labels,
      marcoDates: [...new Set(marcos)],
      domain: getCompareTimelineDomain(processos),
    };
  }, [processos]);

  if (processos.length === 0) {
    return (
      <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
        Adicione processos para comparar a linha do tempo.
      </p>
    );
  }

  const totalEventos = points.length;

  if (totalEventos === 0) {
    return (
      <div className="space-y-4">
        <TimelineCompareLegend processos={processos} />
        <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
          Nenhum evento nos processos selecionados para os filtros atuais.
        </p>
      </div>
    );
  }

  const minX = domain?.inicio.getTime() ?? Math.min(...points.map((point) => point.x));
  const maxX = domain?.fim.getTime() ?? Math.max(...points.map((point) => point.x));
  const padding = Math.max((maxX - minX) * 0.05, 86_400_000);
  const chartHeight = Math.max(320, processos.length * 88 + 96);

  return (
    <div className="space-y-4">
      <TimelineCompareLegend processos={processos} />

      <ChartContainer
        className="rounded-xl border border-border p-2"
        style={{ height: chartHeight }}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
          <ScatterChart margin={{ top: 16, right: 24, left: 8, bottom: 16 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" horizontal />

            {processos.map((_, index) => (
              <ReferenceLine
                key={`lane-${index}`}
                y={index}
                stroke="var(--border)"
                strokeOpacity={0.55}
              />
            ))}

            <XAxis
              type="number"
              dataKey="x"
              domain={[minX - padding, maxX + padding]}
              tickFormatter={(value) =>
                format(new Date(value as number), 'dd/MM/yy', { locale: ptBR })
              }
              tick={{ fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[-0.5, Math.max(processos.length - 0.5, 0.5)]}
              ticks={laneLabels.map((_, index) => index)}
              tickFormatter={(value) => truncateNupLabel(laneLabels[value as number] ?? '', 18)}
              width={128}
              tick={{ fontSize: 10 }}
            />
            <ZAxis type="number" dataKey="z" range={[50, 240]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) {
                  return null;
                }

                const point = payload[0].payload as CompareChartPoint;
                return (
                  <div className="max-w-sm rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md">
                    <p className="font-mono text-xs font-medium">{point.nup}</p>
                    <p className="mt-1 text-xs font-medium">{point.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(point.evento.data_hora)}
                    </p>
                    {point.evento.marco ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Marco: {MARCO_LABELS[point.evento.marco]}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs leading-relaxed">{point.evento.descricao}</p>
                  </div>
                );
              }}
            />

            {marcoDates.map((timestamp) => (
              <ReferenceLine
                key={`marco-${timestamp}`}
                x={timestamp}
                stroke="var(--primary)"
                strokeDasharray="4 4"
                strokeOpacity={0.25}
              />
            ))}

            <Scatter
              data={points}
              shape={(props) => {
                const point = props.payload as CompareChartPoint;
                const isHovered = hoveredId === point.id;
                const radius = isHovered ? 9 : point.evento.destaque ? 8 : 6;

                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={radius}
                    fill={point.cor}
                    fillOpacity={point.evento.destaque ? 1 : 0.82}
                    stroke={point.evento.destaque ? 'var(--foreground)' : 'var(--background)'}
                    strokeWidth={point.evento.destaque ? 2 : 1.5}
                    onMouseEnter={() => setHoveredId(point.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  />
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartContainer>

      <p className="text-xs text-muted-foreground">
        Faixas paralelas por processo · Eixo horizontal compartilhado (tempo) · Cores por
        processo · Contorno reforçado em marcos · Período:{' '}
        {format(new Date(minX), 'dd/MM/yyyy', { locale: ptBR })}
        {' — '}
        {format(new Date(maxX), 'dd/MM/yyyy', { locale: ptBR })}
      </p>
    </div>
  );
}

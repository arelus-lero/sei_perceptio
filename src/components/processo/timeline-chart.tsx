'use client';

import {
  format,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Circle,
  Flag,
  GitMerge,
  Landmark,
  Scale,
} from 'lucide-react';
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

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AccessibleChart,
} from '@/components/ui/accessible-chart';
import { cn } from '@/lib/utils';
import type { TimelineEvento, TimelineMarco } from '@/types/timeline';

interface TimelineChartProps {
  eventos: TimelineEvento[];
  mode: 'list' | 'chart';
}

const TIPO_LABELS: Record<TimelineEvento['tipo'], string> = {
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

const MARCO_COLORS: Record<TimelineMarco, string> = {
  distribuicao: 'var(--chart-4)',
  conclusao: 'var(--chart-3)',
  anexacao: 'var(--chart-2)',
  consulta_publica: 'var(--chart-1)',
};

function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

function MarcoIcon({ marco }: { marco: TimelineMarco | null }) {
  switch (marco) {
    case 'distribuicao':
      return <Scale className="size-3.5" aria-hidden />;
    case 'conclusao':
      return <Flag className="size-3.5" aria-hidden />;
    case 'anexacao':
      return <GitMerge className="size-3.5" aria-hidden />;
    case 'consulta_publica':
      return <Landmark className="size-3.5" aria-hidden />;
    default:
      return <Circle className="size-3.5" aria-hidden />;
  }
}

interface TimelineListProps {
  eventos: TimelineEvento[];
}

function TimelineList({ eventos }: TimelineListProps) {
  if (eventos.length === 0) {
    return (
      <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
        Nenhum evento encontrado para os filtros selecionados.
      </p>
    );
  }

  return (
    <ScrollArea className="h-[640px] rounded-xl border border-border">
      <div className="relative space-y-0 p-6 pl-10">
        <div
          className="absolute top-6 bottom-6 left-[1.35rem] w-px bg-border"
          aria-hidden
        />

        {eventos.map((evento) => (
          <article key={evento.id} className="relative pb-8 last:pb-0">
            <div
              className={cn(
                'absolute top-1.5 -left-[1.65rem] flex size-6 items-center justify-center rounded-full border-2 bg-background',
                evento.destaque
                  ? 'border-primary text-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary),transparent_80%)]'
                  : 'border-muted-foreground/40 text-muted-foreground',
              )}
              style={
                evento.marco
                  ? { borderColor: MARCO_COLORS[evento.marco], color: MARCO_COLORS[evento.marco] }
                  : undefined
              }
            >
              <MarcoIcon marco={evento.marco} />
            </div>

            <div
              className={cn(
                'rounded-lg border p-4 transition-colors',
                evento.destaque
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border bg-card',
              )}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant={evento.destaque ? 'default' : 'outline'}>
                  {TIPO_LABELS[evento.tipo]}
                </Badge>
                {evento.marco ? (
                  <Badge variant="secondary">{MARCO_LABELS[evento.marco]}</Badge>
                ) : null}
                <time className="text-xs text-muted-foreground" dateTime={evento.data_hora}>
                  {formatDateTime(evento.data_hora)}
                </time>
              </div>

              <p className="text-sm leading-relaxed">{evento.descricao}</p>

              {(evento.unidade_origem || evento.unidade_destino) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {evento.unidade_origem && evento.unidade_destino &&
                  evento.unidade_origem !== evento.unidade_destino
                    ? `${evento.unidade_origem} → ${evento.unidade_destino}`
                    : evento.unidade_destino ?? evento.unidade_origem}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </ScrollArea>
  );
}

interface ChartPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  label: string;
  evento: TimelineEvento;
}

interface TimelineScatterProps {
  eventos: TimelineEvento[];
}

function TimelineScatter({ eventos }: TimelineScatterProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { points, laneLabels, marcoDates } = useMemo(() => {
    const lanes = new Map<string, number>();
    const labels: string[] = [];

    for (const evento of eventos) {
      const lane = evento.unidade_destino ?? evento.unidade_origem ?? 'Geral';
      if (!lanes.has(lane)) {
        lanes.set(lane, labels.length);
        labels.push(lane);
      }
    }

    const chartPoints: ChartPoint[] = eventos.map((evento) => {
      const lane = evento.unidade_destino ?? evento.unidade_origem ?? 'Geral';
      return {
        id: evento.id,
        x: parseISO(evento.data_hora).getTime(),
        y: lanes.get(lane) ?? 0,
        z: evento.destaque ? 140 : 70,
        label: TIPO_LABELS[evento.tipo],
        evento,
      };
    });

    const marcos = eventos
      .filter((evento) => evento.destaque)
      .map((evento) => parseISO(evento.data_hora).getTime());

    return {
      points: chartPoints,
      laneLabels: labels,
      marcoDates: marcos,
    };
  }, [eventos]);

  if (eventos.length === 0) {
    return (
      <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
        Nenhum evento para plotar no gráfico.
      </p>
    );
  }

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const padding = Math.max((maxX - minX) * 0.05, 86_400_000);

  const tableRows = eventos.map((evento) => ({
    data: formatDateTime(evento.data_hora),
    unidade: evento.unidade_destino ?? evento.unidade_origem ?? 'Geral',
    tipo: TIPO_LABELS[evento.tipo],
    descricao: evento.descricao,
  }));

  const summary = tableRows
    .slice(0, 8)
    .map((row) => `${row.data} — ${row.unidade}: ${row.tipo}`)
    .join('; ');

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-3 text-xs text-muted-foreground"
        aria-hidden="true"
      >
        {Object.entries(MARCO_LABELS).map(([key, label]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ background: MARCO_COLORS[key as TimelineMarco] }}
            />
            {label}
          </span>
        ))}
      </div>

      <AccessibleChart
        title="Linha do tempo do processo"
        description="Gráfico de dispersão com eventos ao longo do tempo por unidade. Linhas tracejadas indicam marcos."
        summary={
          tableRows.length > 8
            ? `${summary}; e mais ${tableRows.length - 8} evento(s).`
            : summary || 'Nenhum evento registrado.'
        }
        columns={[
          { key: 'data', label: 'Data e hora' },
          { key: 'unidade', label: 'Unidade' },
          { key: 'tipo', label: 'Tipo' },
          { key: 'descricao', label: 'Descrição' },
        ]}
        rows={tableRows}
        chartClassName="h-[420px] rounded-xl border border-border p-2"
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
          <ScatterChart margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
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
              domain={[-0.5, Math.max(laneLabels.length - 0.5, 0.5)]}
              ticks={laneLabels.map((_, index) => index)}
              tickFormatter={(value) => laneLabels[value as number] ?? ''}
              width={72}
              tick={{ fontSize: 11 }}
            />
            <ZAxis type="number" dataKey="z" range={[60, 220]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) {
                  return null;
                }

                const point = payload[0].payload as ChartPoint;
                return (
                  <div className="max-w-xs rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md">
                    <p className="text-xs font-medium">{point.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(point.evento.data_hora)}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed">{point.evento.descricao}</p>
                  </div>
                );
              }}
            />

            {marcoDates.map((timestamp) => (
              <ReferenceLine
                key={timestamp}
                x={timestamp}
                stroke="var(--primary)"
                strokeDasharray="4 4"
                strokeOpacity={0.35}
              />
            ))}

            <Scatter
              data={points}
              shape={(props) => {
                const point = props.payload as ChartPoint;
                const isHovered = hoveredId === point.id;
                const fill = point.evento.marco
                  ? MARCO_COLORS[point.evento.marco]
                  : 'var(--muted-foreground)';

                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={isHovered ? 8 : point.evento.destaque ? 7 : 5}
                    fill={fill}
                    stroke="var(--background)"
                    strokeWidth={2}
                    onMouseEnter={() => setHoveredId(point.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  />
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </AccessibleChart>

      <p className="text-xs text-muted-foreground">
        Eixo horizontal: tempo · Eixo vertical: unidade · Linhas tracejadas: marcos
        · Período visível: {format(new Date(minX), 'dd/MM/yyyy', { locale: ptBR })}
        {' — '}
        {format(new Date(maxX), 'dd/MM/yyyy', { locale: ptBR })}
      </p>
    </div>
  );
}

export function TimelineChart({ eventos, mode }: TimelineChartProps) {
  if (mode === 'list') {
    return <TimelineList eventos={eventos} />;
  }

  return <TimelineScatter eventos={[...eventos].sort(
    (a, b) => parseISO(a.data_hora).getTime() - parseISO(b.data_hora).getTime(),
  )} />;
}

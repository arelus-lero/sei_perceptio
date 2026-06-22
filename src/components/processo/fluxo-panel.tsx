'use client';

import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Loader2, Route } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  AccessibleChart,
  buildChartSummary,
} from '@/components/ui/accessible-chart';
import { SeiTerm } from '@/components/glossary/sei-term';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { FluxoTramitacaoData } from '@/types/fluxo';

interface FluxoPanelProps {
  fluxo: FluxoTramitacaoData | null;
  loading: boolean;
  nup: string;
  className?: string;
}

function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

export function FluxoPanel({ fluxo, loading, nup, className }: FluxoPanelProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Reconstruindo fluxo de <SeiTerm term="tramitacao">tramitação</SeiTerm>...
        </CardContent>
      </Card>
    );
  }

  if (!fluxo) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Selecione um processo para analisar o fluxo de{' '}
          <SeiTerm term="tramitacao">tramitação</SeiTerm>.
        </CardContent>
      </Card>
    );
  }

  const chartData = fluxo.resumo_unidades.map((item) => ({
    unidade: item.unidade,
    dias: item.total_dias,
    gargalo: item.gargalo ? 'Sim' : 'Não',
  }));

  const chartRows = chartData.map((item) => ({
    unidade: item.unidade,
    dias: item.dias,
    gargalo: item.gargalo,
  }));

  return (
    <div className={cn('space-y-4', className)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="size-4" aria-hidden />
            Fluxo de <SeiTerm term="tramitacao">tramitação</SeiTerm> — {nup}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Tempo total estimado:</span>{' '}
            <strong>{fluxo.tempo_total_dias} dias</strong>
          </p>
          <p>
            <span className="text-muted-foreground">Ordem das unidades:</span>{' '}
            {fluxo.ordem_unidades.join(' → ') || '—'}
          </p>
          {fluxo.gargalos.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <AlertTriangle className="size-4 text-destructive" aria-hidden />
              <span className="text-muted-foreground">Gargalos detectados:</span>
              {fluxo.gargalos.map((item) => (
                <Badge key={item.unidade} variant="destructive">
                  {item.unidade} ({item.total_dias}d)
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhum gargalo acima de {fluxo.limite_gargalo_dias} dias (média × 1,35).
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permanência por unidade</CardTitle>
        </CardHeader>
        <CardContent>
          <AccessibleChart
            title="Permanência por unidade"
            description={`Tempo de permanência em dias por unidade do processo ${nup}. Gargalos destacados em vermelho.`}
            summary={buildChartSummary(chartRows, 'unidade', 'dias', 'dias')}
            columns={[
              { key: 'unidade', label: 'Unidade' },
              { key: 'dias', label: 'Dias' },
              { key: 'gargalo', label: 'Gargalo' },
            ]}
            rows={chartRows}
            chartClassName="h-56"
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                <XAxis dataKey="unidade" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => [`${value} dias`, 'Permanência']}
                  contentStyle={{
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border)',
                    background: 'var(--popover)',
                  }}
                />
                <Bar dataKey="dias" radius={[6, 6, 0, 0]}>
                  {fluxo.resumo_unidades.map((entry) => (
                    <Cell
                      key={entry.unidade}
                      fill={
                        entry.gargalo ? 'var(--destructive)' : 'var(--chart-2)'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </AccessibleChart>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Segmentos cronológicos</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-64">
            <ul className="space-y-3 pr-2">
              {fluxo.segmentos.map((segmento, index) => (
                <li
                  key={`${segmento.unidade}-${segmento.data_entrada}-${index}`}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{segmento.unidade}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {segmento.dias_permanencia} dia(s) ·{' '}
                      {segmento.andamentos_no_segmento} andamento(s)
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDateTime(segmento.data_entrada)}
                    {segmento.data_saida
                      ? ` → ${formatDateTime(segmento.data_saida)}`
                      : ' → em aberto'}
                  </p>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

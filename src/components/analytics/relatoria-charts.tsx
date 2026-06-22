'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartContainer } from '@/components/ui/chart-container';
import { SectionTitle } from '@/components/layout/headings';
import { cn } from '@/lib/utils';
import type { RelatoriaCountItem } from '@/types/analytics-relatoria';

interface RelatoriaChartsProps {
  porRelator: RelatoriaCountItem[];
  porSessao: RelatoriaCountItem[];
  porResultado: RelatoriaCountItem[];
  className?: string;
}

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
];

function truncateLabel(value: string, max = 32): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}

function EmptyChartMessage({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}

interface CountBarChartProps {
  title: string;
  data: RelatoriaCountItem[];
  emptyMessage: string;
  className?: string;
}

function CountBarChart({ title, data, emptyMessage, className }: CountBarChartProps) {
  const chartData = data.map((item) => ({
    rotulo: truncateLabel(item.rotulo),
    rotuloCompleto: item.rotulo,
    total: item.total,
    chave: item.chave,
  }));

  return (
    <article className={cn('rounded-xl border border-border bg-card p-4 shadow-sm', className)}>
      <SectionTitle className="mb-4">{title}</SectionTitle>
      {chartData.length === 0 ? (
        <EmptyChartMessage message={emptyMessage} />
      ) : (
        <ChartContainer className="h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 48 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis
                dataKey="rotulo"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={56}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [value, 'Distribuições']}
                labelFormatter={(_, payload) => {
                  const entry = payload?.[0]?.payload as { rotuloCompleto?: string } | undefined;
                  return entry?.rotuloCompleto ?? '';
                }}
                contentStyle={{
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border)',
                  background: 'var(--popover)',
                  color: 'var(--popover-foreground)',
                }}
              />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={entry.chave} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}
    </article>
  );
}

function ResultadoPieChart({
  data,
  className,
}: {
  data: RelatoriaCountItem[];
  className?: string;
}) {
  const chartData = data.map((item) => ({
    name: truncateLabel(item.rotulo, 40),
    nameCompleto: item.rotulo,
    value: item.total,
    chave: item.chave,
  }));

  return (
    <article className={cn('rounded-xl border border-border bg-card p-4 shadow-sm', className)}>
      <SectionTitle className="mb-4">Resultados deliberativos</SectionTitle>
      {chartData.length === 0 ? (
        <EmptyChartMessage message="Nenhum resultado deliberativo registrado." />
      ) : (
        <ChartContainer className="h-80">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) =>
                  `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                }
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={entry.chave} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [value, 'Distribuições']}
                labelFormatter={(_, payload) => {
                  const entry = payload?.[0]?.payload as { nameCompleto?: string } | undefined;
                  return entry?.nameCompleto ?? '';
                }}
                contentStyle={{
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border)',
                  background: 'var(--popover)',
                  color: 'var(--popover-foreground)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      )}
    </article>
  );
}

export function RelatoriaCharts({
  porRelator,
  porSessao,
  porResultado,
  className,
}: RelatoriaChartsProps) {
  return (
    <section className={cn('grid gap-6 lg:grid-cols-2', className)}>
      <CountBarChart
        title="Por diretor-relator"
        data={porRelator}
        emptyMessage="Nenhuma distribuição com relator informado."
      />
      <CountBarChart
        title="Por sessão de distribuição"
        data={porSessao}
        emptyMessage="Nenhuma sessão de distribuição registrada."
      />
      <ResultadoPieChart data={porResultado} className="lg:col-span-2" />
    </section>
  );
}

'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  AccessibleChart,
  buildChartSummary,
} from '@/components/ui/accessible-chart';
import { ErrorBoundary } from '@/components/error/error-boundary';
import { cn } from '@/lib/utils';
import type { UnidadeCount } from '@/types/dashboard';

interface UnidadeChartProps {
  data: UnidadeCount[];
  className?: string;
}

export function UnidadeChart({ data, className }: UnidadeChartProps) {
  const chartData = data.map((item) => ({
    unidade: item.unidade,
    total: item.total,
  }));

  if (chartData.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Nenhuma unidade com processos registrados.
      </p>
    );
  }

  return (
    <ErrorBoundary
      title="Erro no gráfico"
      message="Não foi possível exibir o gráfico por unidade."
    >
      <AccessibleChart
      title="Processos por unidade geradora"
      description="Gráfico de barras horizontais com a quantidade de processos por unidade."
      summary={buildChartSummary(chartData, 'unidade', 'total', 'processos')}
      columns={[
        { key: 'unidade', label: 'Unidade' },
        { key: 'total', label: 'Processos' },
      ]}
      rows={chartData}
      chartClassName={cn('h-80', className)}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="unidade"
            width={72}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value) => [value, 'Processos']}
            contentStyle={{
              borderRadius: '0.5rem',
              border: '1px solid var(--border)',
              background: 'var(--popover)',
              color: 'var(--popover-foreground)',
            }}
          />
          <Bar
            dataKey="total"
            fill="var(--chart-2)"
            radius={[0, 6, 6, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </AccessibleChart>
    </ErrorBoundary>
  );
}

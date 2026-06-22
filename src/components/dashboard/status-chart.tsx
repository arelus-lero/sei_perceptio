'use client';

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
import { ErrorBoundary } from '@/components/error/error-boundary';
import { cn } from '@/lib/utils';
import type { ProcessoStatus } from '@/lib/db/schema';
import type { StatusCount } from '@/types/dashboard';

interface StatusChartProps {
  data: StatusCount[];
  className?: string;
}

const STATUS_LABELS: Record<ProcessoStatus, string> = {
  aberto: 'Aberto',
  em_tramitacao: 'Em tramitação',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
};

const STATUS_COLORS: Record<ProcessoStatus, string> = {
  aberto: 'var(--chart-1)',
  em_tramitacao: 'var(--chart-2)',
  concluido: 'var(--chart-3)',
  arquivado: 'var(--chart-4)',
};

export function StatusChart({ data, className }: StatusChartProps) {
  const chartData = data.map((item) => ({
    status: STATUS_LABELS[item.status],
    total: item.total,
    key: item.status,
  }));

  if (chartData.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Nenhum processo disponível para exibir.
      </p>
    );
  }

  const tableRows = chartData.map((item) => ({
    status: item.status,
    total: item.total,
  }));

  return (
    <ErrorBoundary
      title="Erro no gráfico"
      message="Não foi possível exibir o gráfico de status."
    >
      <AccessibleChart
        title="Contagem de processos por status"
        description="Gráfico de barras verticais com a quantidade de processos em cada status."
        summary={buildChartSummary(tableRows, 'status', 'total', 'processos')}
        columns={[
          { key: 'status', label: 'Status' },
          { key: 'total', label: 'Processos' },
        ]}
        rows={tableRows}
        chartClassName={cn('h-72', className)}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
            <XAxis dataKey="status" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value) => [value, 'Processos']}
              contentStyle={{
                borderRadius: '0.5rem',
                border: '1px solid var(--border)',
                background: 'var(--popover)',
                color: 'var(--popover-foreground)',
              }}
            />
            <Bar dataKey="total" radius={[6, 6, 0, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={STATUS_COLORS[entry.key as ProcessoStatus]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </AccessibleChart>
    </ErrorBoundary>
  );
}

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
import type { TipoProcessoCount } from '@/types/dashboard';

interface TipoChartProps {
  data: TipoProcessoCount[];
  className?: string;
}

function truncateLabel(value: string, max = 28): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}

export function TipoChart({ data, className }: TipoChartProps) {
  const chartData = data.slice(0, 12).map((item) => ({
    tipo: truncateLabel(item.descricao),
    tipoCompleto: item.descricao,
    total: item.total,
  }));

  if (chartData.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Nenhum tipo processual registrado.
      </p>
    );
  }

  const tableRows = chartData.map((item) => ({
    tipo: item.tipoCompleto,
    total: item.total,
  }));

  return (
    <ErrorBoundary
      title="Erro no gráfico"
      message="Não foi possível exibir o gráfico por tipo processual."
    >
      <AccessibleChart
      title="Distribuição por tipo processual"
      description="Gráfico de barras verticais com os doze tipos processuais mais frequentes."
      summary={buildChartSummary(tableRows, 'tipo', 'total', 'processos')}
      columns={[
        { key: 'tipo', label: 'Tipo processual' },
        { key: 'total', label: 'Processos' },
      ]}
      rows={tableRows}
      chartClassName={cn('h-96', className)}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 64 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
          <XAxis
            dataKey="tipo"
            tick={{ fontSize: 10 }}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={72}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value) => [value, 'Processos']}
            labelFormatter={(_, payload) => {
              const entry = payload?.[0]?.payload as { tipoCompleto?: string } | undefined;
              return entry?.tipoCompleto ?? '';
            }}
            contentStyle={{
              borderRadius: '0.5rem',
              border: '1px solid var(--border)',
              background: 'var(--popover)',
              color: 'var(--popover-foreground)',
            }}
          />
          <Bar dataKey="total" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </AccessibleChart>
    </ErrorBoundary>
  );
}

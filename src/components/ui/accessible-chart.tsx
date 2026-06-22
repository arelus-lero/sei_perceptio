'use client';

import { useId, type ReactNode } from 'react';

import { ChartContainer } from '@/components/ui/chart-container';
import { cn } from '@/lib/utils';

export interface AccessibleChartColumn {
  key: string;
  label: string;
}

export interface AccessibleChartProps {
  title: string;
  description?: string;
  summary: string;
  columns: AccessibleChartColumn[];
  rows: Record<string, string | number>[];
  chartClassName?: string;
  className?: string;
  children: ReactNode;
}

export function buildChartSummary(
  rows: Record<string, string | number>[],
  categoryKey: string,
  valueKey: string,
  valueLabel: string,
): string {
  if (rows.length === 0) {
    return 'Sem dados para exibir.';
  }

  return rows
    .map((row) => `${String(row[categoryKey])}: ${row[valueKey]} ${valueLabel}`)
    .join('; ');
}

export function AccessibleChart({
  title,
  description,
  summary,
  columns,
  rows,
  chartClassName,
  className,
  children,
}: AccessibleChartProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <figure
      className={cn('w-full', className)}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <figcaption id={titleId} className="sr-only">
        {title}
      </figcaption>
      {description ? (
        <p id={descriptionId} className="sr-only">
          {description}
        </p>
      ) : null}
      <p className="sr-only">{summary}</p>
      <div aria-hidden="true">
        <ChartContainer className={chartClassName}>{children}</ChartContainer>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td key={column.key}>{row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

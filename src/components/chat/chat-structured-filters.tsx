'use client';

import { Filter } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBelowLg } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type { ChatFilters } from '@/lib/rag/types';

export interface ChatStructuredFilterState {
  nup: string;
  tipoDocumento: string;
  unidade: string;
  dataInicio: string;
  dataFim: string;
  interessado: string;
}

export const EMPTY_CHAT_STRUCTURED_FILTERS: ChatStructuredFilterState = {
  nup: '',
  tipoDocumento: '',
  unidade: '',
  dataInicio: '',
  dataFim: '',
  interessado: '',
};

function splitCsv(value: string): string[] | undefined {
  const items = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return items.length > 0 ? items : undefined;
}

export function buildChatRequestFiltros(
  structured: ChatStructuredFilterState,
  tagIds: string[] = [],
): ChatFilters | undefined {
  const filtros: ChatFilters = {};

  const tipoDocumento = splitCsv(structured.tipoDocumento);
  if (tipoDocumento) {
    filtros.tipo_documento = tipoDocumento;
  }

  const unidade = splitCsv(structured.unidade);
  if (unidade) {
    filtros.unidade = unidade;
  }

  if (structured.dataInicio.trim()) {
    filtros.data_inicio = structured.dataInicio.trim();
  }

  if (structured.dataFim.trim()) {
    filtros.data_fim = structured.dataFim.trim();
  }

  if (structured.nup.trim()) {
    filtros.nup = structured.nup.trim();
  }

  if (structured.interessado.trim()) {
    filtros.interessado = structured.interessado.trim();
  }

  if (tagIds.length > 0) {
    filtros.tags = tagIds;
  }

  return Object.keys(filtros).length > 0 ? filtros : undefined;
}

export function hasActiveStructuredFilters(structured: ChatStructuredFilterState): boolean {
  return countActiveStructuredFilters(structured) > 0;
}

export function countActiveStructuredFilters(structured: ChatStructuredFilterState): number {
  let count = 0;

  if (structured.nup.trim().length > 0) {
    count += 1;
  }

  if (structured.tipoDocumento.trim().length > 0) {
    count += 1;
  }

  if (structured.unidade.trim().length > 0) {
    count += 1;
  }

  if (structured.dataInicio.trim().length > 0) {
    count += 1;
  }

  if (structured.dataFim.trim().length > 0) {
    count += 1;
  }

  if (structured.interessado.trim().length > 0) {
    count += 1;
  }

  return count;
}

interface ChatStructuredFiltersProps {
  value: ChatStructuredFilterState;
  onChange: (value: ChatStructuredFilterState) => void;
  disabled?: boolean;
  className?: string;
}

export function ChatStructuredFilters({
  value,
  onChange,
  disabled = false,
  className,
}: ChatStructuredFiltersProps) {
  const belowLg = useBelowLg();
  const [expandedOnSmall, setExpandedOnSmall] = useState(false);

  function patch(partial: Partial<ChatStructuredFilterState>) {
    onChange({ ...value, ...partial });
  }

  const activeCount = countActiveStructuredFilters(value);
  const active = activeCount > 0;

  const fields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="chat-filter-interessado">Interessado</Label>
        <Input
          id="chat-filter-interessado"
          value={value.interessado}
          onChange={(event) => patch({ interessado: event.target.value })}
          placeholder="Nome, CPF ou CNPJ do interessado"
          disabled={disabled}
          autoComplete="off"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="chat-filter-nup">NUP</Label>
        <Input
          id="chat-filter-nup"
          value={value.nup}
          onChange={(event) => patch({ nup: event.target.value })}
          placeholder="48500.035430/2025-02"
          disabled={disabled}
          autoComplete="off"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="chat-filter-unidade">Unidade</Label>
        <Input
          id="chat-filter-unidade"
          value={value.unidade}
          onChange={(event) => patch({ unidade: event.target.value })}
          placeholder="STD, SFT (separe por vírgula)"
          disabled={disabled}
          autoComplete="off"
        />
      </div>

      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="chat-filter-tipo">Tipo de documento</Label>
        <Input
          id="chat-filter-tipo"
          value={value.tipoDocumento}
          onChange={(event) => patch({ tipoDocumento: event.target.value })}
          placeholder="Nota Técnica, Despacho (separe por vírgula)"
          disabled={disabled}
          autoComplete="off"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="chat-filter-data-inicio">Data inicial</Label>
        <Input
          id="chat-filter-data-inicio"
          type="date"
          value={value.dataInicio}
          onChange={(event) => patch({ dataInicio: event.target.value })}
          disabled={disabled}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="chat-filter-data-fim">Data final</Label>
        <Input
          id="chat-filter-data-fim"
          type="date"
          value={value.dataFim}
          onChange={(event) => patch({ dataFim: event.target.value })}
          disabled={disabled}
        />
      </div>
    </div>
  );

  if (belowLg) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-muted/20 px-3 py-2',
          active && 'border-primary/40 bg-primary/5',
          className,
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 w-full justify-between gap-2"
          disabled={disabled}
          aria-expanded={expandedOnSmall}
          onClick={() => setExpandedOnSmall((current) => !current)}
        >
          <span className="flex items-center gap-2">
            <Filter className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            Filtros
          </span>
          {activeCount > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
        {expandedOnSmall ? <div className="mt-3">{fields}</div> : null}
      </div>
    );
  }

  return (
    <details
      className={cn(
        'rounded-lg border border-border bg-muted/20 px-3 py-2',
        active && 'border-primary/40 bg-primary/5',
        className,
      )}
      open={active}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <Filter className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        Filtros estruturados (RF-019)
        {active ? (
          <span className="text-xs font-normal text-muted-foreground">· ativos</span>
        ) : null}
      </summary>

      <div className="mt-3">{fields}</div>
    </details>
  );
}

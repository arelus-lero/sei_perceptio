'use client';

import {
  BarChart3,
  GitBranch,
  GitCompare,
  List,
  Loader2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { TimelineChart } from '@/components/processo/timeline-chart';
import { TimelineCompareChart } from '@/components/processo/timeline-compare-chart';
import { TimelineCompareList } from '@/components/processo/timeline-compare-list';
import {
  getTimelinePeriodLabel,
  TimelineFiltersPopover,
} from '@/components/processo/timeline-filters-popover';
import { TimelineProcessSelector } from '@/components/processo/timeline-process-selector';
import { TimelinePageSkeleton } from '@/components/loading/timeline-page-skeleton';
import { SeiTerm } from '@/components/glossary/sei-term';
import { PageTitle } from '@/components/layout/headings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTimelineProcessColor } from '@/lib/processo/timeline-colors';
import {
  filterCompareProcessos,
  filterTimelineEventos,
} from '@/lib/processo/timeline-filters';
import { cn } from '@/lib/utils';
import { processoApiPath } from '@/lib/utils/processo-url';
import type {
  TimelineApiResponse,
  TimelineFilters,
} from '@/types/timeline';

interface TimelineViewProps {
  nup: string;
}

type TimelineViewMode = 'single' | 'compare';
type TimelineDisplayFormat = 'list' | 'chart';

const STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto',
  em_tramitacao: 'Em tramitação',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
};

async function fetchProcessoTimeline(
  nup: string,
): Promise<{ ok: true; data: TimelineApiResponse } | { ok: false; error: string }> {
  try {
    const response = await fetch(processoApiPath(nup, 'timeline'));
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? 'Falha ao carregar linha do tempo');
    }

    const payload = (await response.json()) as TimelineApiResponse;
    return { ok: true, data: payload };
  } catch (loadError) {
    return {
      ok: false,
      error: loadError instanceof Error ? loadError.message : 'Erro ao carregar linha do tempo',
    };
  }
}

function buildContextLabel(
  viewMode: TimelineViewMode,
  displayFormat: TimelineDisplayFormat,
  filters: TimelineFilters,
): string {
  const modeLabel = viewMode === 'single' ? 'Processo único' : 'Comparação';
  const formatLabel = displayFormat === 'list' ? 'Lista' : 'Gráfico';
  const periodLabel = getTimelinePeriodLabel(filters.periodo);
  const extras: string[] = [];

  if (filters.unidade) {
    extras.push(filters.unidade);
  }

  if (filters.apenasMarcos) {
    extras.push('Apenas marcos');
  }

  const base = `${modeLabel} · ${formatLabel} · ${periodLabel}`;
  return extras.length > 0 ? `${base} · ${extras.join(' · ')}` : base;
}

export function TimelineView({ nup }: TimelineViewProps) {
  const [data, setData] = useState<TimelineApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compareNups, setCompareNups] = useState<string[]>([]);
  const [compareByNup, setCompareByNup] = useState<Record<string, TimelineApiResponse>>({});
  const [compareErrors, setCompareErrors] = useState<Record<string, string>>({});
  const [compareLoading, setCompareLoading] = useState(false);
  const [viewMode, setViewMode] = useState<TimelineViewMode>('single');
  const [displayFormat, setDisplayFormat] = useState<TimelineDisplayFormat>('list');
  const [filters, setFilters] = useState<TimelineFilters>({
    unidade: null,
    periodo: 'tudo',
    apenasMarcos: false,
  });

  const fetchTimeline = useCallback(async () => fetchProcessoTimeline(nup), [nup]);

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchTimeline();
    if (result.ok) {
      setData(result.data);
    } else {
      setError(result.error);
    }

    setLoading(false);
  }, [fetchTimeline]);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      setLoading(true);
      setError(null);
    });

    void fetchTimeline()
      .then((result) => {
        if (!active) {
          return;
        }

        if (result.ok) {
          setData(result.data);
        } else {
          setError(result.error);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fetchTimeline]);

  useEffect(() => {
    if (compareNups.length === 0) {
      setCompareByNup({});
      setCompareErrors({});
      setCompareLoading(false);
      return;
    }

    let active = true;
    setCompareLoading(true);

    void Promise.all(compareNups.map((compareNup) => fetchProcessoTimeline(compareNup))).then(
      (results) => {
        if (!active) {
          return;
        }

        const nextData: Record<string, TimelineApiResponse> = {};
        const nextErrors: Record<string, string> = {};

        compareNups.forEach((compareNup, index) => {
          const result = results[index];
          if (!result) {
            return;
          }

          if (result.ok) {
            nextData[compareNup] = result.data;
          } else {
            nextErrors[compareNup] = result.error;
          }
        });

        setCompareByNup(nextData);
        setCompareErrors(nextErrors);
        setCompareLoading(false);
      },
    );

    return () => {
      active = false;
    };
  }, [compareNups]);

  const filteredEventos = useMemo(() => {
    if (!data) {
      return [];
    }
    return filterTimelineEventos(data.eventos, filters);
  }, [data, filters]);

  const allCompareSources = useMemo(() => {
    if (!data) {
      return [];
    }

    const extras = compareNups
      .map((compareNup) => compareByNup[compareNup])
      .filter((item): item is TimelineApiResponse => Boolean(item));

    return [data, ...extras];
  }, [compareByNup, compareNups, data]);

  const compareProcessos = useMemo(
    () => filterCompareProcessos(allCompareSources, filters),
    [allCompareSources, filters],
  );

  const processColors = useMemo(() => {
    const colors: Record<string, string> = {};
    allCompareSources.forEach((processo, index) => {
      colors[processo.nup] = getTimelineProcessColor(index);
    });
    return colors;
  }, [allCompareSources]);

  const allUnidades = useMemo(() => {
    const unidades = new Set<string>();
    for (const processo of allCompareSources) {
      for (const unidade of processo.unidades) {
        unidades.add(unidade);
      }
    }
    return [...unidades].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [allCompareSources]);

  const marcosCount = useMemo(
    () => filteredEventos.filter((evento) => evento.destaque).length,
    [filteredEventos],
  );

  const compareEventosTotal = useMemo(
    () => compareProcessos.reduce((sum, processo) => sum + processo.eventos.length, 0),
    [compareProcessos],
  );

  const contextLabel = buildContextLabel(viewMode, displayFormat, filters);

  function handleViewModeChange(mode: TimelineViewMode) {
    setViewMode(mode);
    setDisplayFormat(mode === 'compare' ? 'chart' : 'list');
  }

  function handleAddCompareNup(nextNup: string) {
    setCompareNups((current) => [...current, nextNup]);
  }

  function handleRemoveCompareNup(removeNup: string) {
    setCompareNups((current) => current.filter((value) => value !== removeNup));
  }

  if (loading) {
    return <TimelinePageSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="p-4 sm:p-6">
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error ?? 'Linha do tempo indisponível'}
        </p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => void loadTimeline()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:gap-6 sm:p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <GitBranch className="size-5 text-primary" aria-hidden />
          <PageTitle>
            Linha do tempo de <SeiTerm term="andamento">andamentos</SeiTerm>
          </PageTitle>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm">{nup}</span>
          <Badge variant="outline">{data.tipo_processo_desc}</Badge>
          <Badge variant="secondary">{STATUS_LABELS[data.status] ?? data.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {filteredEventos.length} evento(s) do processo atual
          {marcosCount > 0 ? ` · ${marcosCount} marco(s) destacado(s)` : ''}
          {viewMode === 'compare'
            ? ` · comparação com ${allCompareSources.length} processo(s) (${compareEventosTotal} eventos)`
            : ''}
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex w-full rounded-lg border border-border bg-muted/50 p-0.5 sm:w-auto"
          role="group"
          aria-label="Modo de visualização"
        >
          <Button
            type="button"
            variant={viewMode === 'single' ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1 sm:flex-none"
            aria-pressed={viewMode === 'single'}
            onClick={() => handleViewModeChange('single')}
          >
            Processo único
          </Button>
          <Button
            type="button"
            variant={viewMode === 'compare' ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1 gap-1.5 sm:flex-none"
            aria-pressed={viewMode === 'compare'}
            onClick={() => handleViewModeChange('compare')}
          >
            <GitCompare className="size-4" aria-hidden />
            Comparação
          </Button>
        </div>

        <TimelineFiltersPopover
          filters={filters}
          unidades={allUnidades}
          onChange={setFilters}
          className="w-full sm:w-auto"
        />
      </div>

      <p
        className="text-sm text-muted-foreground"
        aria-live="polite"
        aria-label="Contexto da visualização"
      >
        {contextLabel}
      </p>

      {viewMode === 'compare' ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Processos na comparação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <TimelineProcessSelector
              primaryNup={nup}
              selectedNups={compareNups}
              processColors={processColors}
              onAdd={handleAddCompareNup}
              onRemove={handleRemoveCompareNup}
            />

            {compareLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Carregando processos adicionais...
              </div>
            ) : null}

            {Object.entries(compareErrors).map(([failedNup, message]) => (
              <p
                key={failedNup}
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                role="alert"
              >
                {failedNup}: {message}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <CardTitle className="text-base">Visualização</CardTitle>
          <div
            className="inline-flex shrink-0 rounded-lg border border-border bg-muted/50 p-0.5"
            role="group"
            aria-label="Formato da visualização"
          >
            <Button
              type="button"
              variant={displayFormat === 'list' ? 'secondary' : 'ghost'}
              size="icon-sm"
              aria-label="Lista cronológica"
              aria-pressed={displayFormat === 'list'}
              onClick={() => setDisplayFormat('list')}
            >
              <List className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant={displayFormat === 'chart' ? 'secondary' : 'ghost'}
              size="icon-sm"
              aria-label="Gráfico interativo"
              aria-pressed={displayFormat === 'chart'}
              onClick={() => setDisplayFormat('chart')}
            >
              <BarChart3 className="size-4" aria-hidden />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'single' ? (
            <TimelineChart
              eventos={filteredEventos}
              mode={displayFormat === 'list' ? 'list' : 'chart'}
            />
          ) : displayFormat === 'chart' ? (
            <TimelineCompareChart processos={compareProcessos} />
          ) : (
            <TimelineCompareList processos={compareProcessos} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

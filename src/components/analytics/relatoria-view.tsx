'use client';

import { BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { RelatoriaCharts } from '@/components/analytics/relatoria-charts';
import { RelatoriaTable } from '@/components/analytics/relatoria-table';
import { SeiTerm } from '@/components/glossary/sei-term';
import { PageTitle, SectionTitle } from '@/components/layout/headings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { nativeSelectClass } from '@/lib/utils';
import type { RelatoriaAnalyticsData } from '@/types/analytics-relatoria';

interface FilterState {
  relator_id: string;
  sessao_distribuicao: string;
  resultado_deliberativo: string;
  q: string;
  data_inicio: string;
  data_fim: string;
}

const EMPTY_FILTERS: FilterState = {
  relator_id: '',
  sessao_distribuicao: '',
  resultado_deliberativo: '',
  q: '',
  data_inicio: '',
  data_fim: '',
};

function buildQueryString(filters: FilterState): string {
  const params = new URLSearchParams();

  if (filters.relator_id) {
    params.set('relator_id', filters.relator_id);
  }
  if (filters.sessao_distribuicao) {
    params.set('sessao_distribuicao', filters.sessao_distribuicao);
  }
  if (filters.resultado_deliberativo) {
    params.set('resultado_deliberativo', filters.resultado_deliberativo);
  }
  if (filters.q.trim()) {
    params.set('q', filters.q.trim());
  }
  if (filters.data_inicio) {
    params.set('data_inicio', filters.data_inicio);
  }
  if (filters.data_fim) {
    params.set('data_fim', filters.data_fim);
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

export function RelatoriaView() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [data, setData] = useState<RelatoriaAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (nextFilters: FilterState) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/analytics/relatoria${buildQueryString(nextFilters)}`,
      );

      if (!response.ok) {
        throw new Error('Falha ao carregar analytics de relatoria');
      }

      const payload = (await response.json()) as { data: RelatoriaAnalyticsData };
      setData(payload.data);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError instanceof Error ? loadError.message : 'Erro desconhecido');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(appliedFilters);
  }, [appliedFilters, loadData]);

  const filterOptions = useMemo(() => data?.filtros_disponiveis, [data]);

  function handleApplyFilters() {
    setAppliedFilters({ ...filters });
  }

  function handleClearFilters() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" aria-hidden />
            <PageTitle>
              Analytics de <SeiTerm term="relatoria">relatoria</SeiTerm>
            </PageTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Agregação de <SeiTerm term="distribuicao">distribuições</SeiTerm> por{' '}
            <SeiTerm term="diretor_relator">diretor-relator</SeiTerm>, sessão e{' '}
            <SeiTerm term="resultado_deliberativo">resultado deliberativo</SeiTerm>{' '}
            (RF-038). Dados filtrados pelo RLS do órgão; processos{' '}
            <SeiTerm term="sigilo">sigilosos</SeiTerm> são excluídos.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void loadData(appliedFilters)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          Atualizar
        </Button>
      </header>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <SectionTitle className="mb-4">Filtros</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="filter-relator">
              <SeiTerm term="diretor_relator">Diretor-relator</SeiTerm>
            </Label>
            <select
              id="filter-relator"
              value={filters.relator_id}
              onChange={(event) =>
                setFilters((current) => ({ ...current, relator_id: event.target.value }))
              }
              className={nativeSelectClass}
            >
              <option value="">Todos</option>
              {filterOptions?.relatores.map((relator) => (
                <option key={relator.id} value={relator.id}>
                  {relator.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="filter-sessao">
              Sessão de <SeiTerm term="distribuicao">distribuição</SeiTerm>
            </Label>
            <select
              id="filter-sessao"
              value={filters.sessao_distribuicao}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  sessao_distribuicao: event.target.value,
                }))
              }
              className={nativeSelectClass}
            >
              <option value="">Todas</option>
              {filterOptions?.sessoes.map((sessao) => (
                <option key={sessao} value={sessao}>
                  {sessao}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="filter-resultado">
              <SeiTerm term="resultado_deliberativo">Resultado deliberativo</SeiTerm>
            </Label>
            <select
              id="filter-resultado"
              value={filters.resultado_deliberativo}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  resultado_deliberativo: event.target.value,
                }))
              }
              className={nativeSelectClass}
            >
              <option value="">Todos</option>
              {filterOptions?.resultados.map((resultado) => (
                <option key={resultado} value={resultado}>
                  {resultado.length > 80 ? `${resultado.slice(0, 79)}…` : resultado}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="filter-q">Busca textual</Label>
            <Input
              id="filter-q"
              value={filters.q}
              onChange={(event) =>
                setFilters((current) => ({ ...current, q: event.target.value }))
              }
              placeholder="NUP, unidade, descrição…"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="filter-data-inicio">Data inicial</Label>
            <Input
              id="filter-data-inicio"
              type="date"
              value={filters.data_inicio}
              onChange={(event) =>
                setFilters((current) => ({ ...current, data_inicio: event.target.value }))
              }
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="filter-data-fim">Data final</Label>
            <Input
              id="filter-data-fim"
              type="date"
              value={filters.data_fim}
              onChange={(event) =>
                setFilters((current) => ({ ...current, data_fim: event.target.value }))
              }
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={handleApplyFilters} disabled={loading}>
            Aplicar filtros
          </Button>
          <Button type="button" variant="outline" onClick={handleClearFilters} disabled={loading}>
            Limpar
          </Button>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Carregando analytics…
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Total de distribuições</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">
                {data.total_distribuicoes}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Diretores-relatores</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">
                {data.por_relator.length}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Sessões distintas</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">
                {data.por_sessao.length}
              </p>
            </article>
          </section>

          <RelatoriaCharts
            porRelator={data.por_relator}
            porSessao={data.por_sessao}
            porResultado={data.por_resultado}
          />

          <RelatoriaTable registros={data.registros} />
        </>
      ) : null}
    </main>
  );
}

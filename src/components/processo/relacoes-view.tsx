'use client';

import { GitBranch, Loader2, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { FluxoPanel } from '@/components/processo/fluxo-panel';
import { SeiTerm } from '@/components/glossary/sei-term';
import { PageTitle } from '@/components/layout/headings';
import { RelacaoLegend, RelationGraph } from '@/components/processo/relation-graph';
import { SimilaridadePanel } from '@/components/processo/similaridade-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { nativeSelectClass } from '@/lib/utils';
import { processoApiPath } from '@/lib/utils/processo-url';
import { validarNup } from '@/lib/utils/nup';
import type { FluxoTramitacaoData } from '@/types/fluxo';
import type {
  RelacaoEdgeFilter,
  RelacaoNode,
  RelacoesGraphData,
} from '@/types/relacoes';
import type { SimilaridadeApiResponse } from '@/types/similaridade';

interface RelacoesViewProps {
  initialNup?: string;
}

const EDGE_FILTERS: { value: RelacaoEdgeFilter; label: string }[] = [
  { value: 'todos', label: 'Todas' },
  { value: 'anexacao', label: 'Anexação' },
  { value: 'referencia', label: 'Referência' },
  { value: 'mesmo_interessado', label: 'Mesmo interessado' },
  { value: 'mesmo_tipo', label: 'Mesmo tipo' },
];

export function RelacoesView({ initialNup = '' }: RelacoesViewProps) {
  const [nupInput, setNupInput] = useState(initialNup);
  const [activeNup, setActiveNup] = useState(initialNup);
  const [graph, setGraph] = useState<RelacoesGraphData | null>(null);
  const [fluxo, setFluxo] = useState<FluxoTramitacaoData | null>(null);
  const [selectedNode, setSelectedNode] = useState<RelacaoNode | null>(null);
  const [edgeFilter, setEdgeFilter] = useState<RelacaoEdgeFilter>('todos');
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [loadingFluxo, setLoadingFluxo] = useState(false);
  const [similaridade, setSimilaridade] = useState<SimilaridadeApiResponse | null>(
    null,
  );
  const [loadingSimilaridade, setLoadingSimilaridade] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSimilaridade = useCallback(async (nup: string, isActive: () => boolean = () => true) => {
    if (!isActive()) {
      return;
    }

    setLoadingSimilaridade(true);

    try {
      const response = await fetch(
        processoApiPath(nup, 'similaridade'),
      );
      if (!response.ok) {
        throw new Error('Falha ao buscar processos similares');
      }

      const payload = (await response.json()) as SimilaridadeApiResponse;
      if (!isActive()) {
        return;
      }

      setSimilaridade(payload);
    } catch (similaridadeError) {
      console.error(similaridadeError);
      if (!isActive()) {
        return;
      }

      setSimilaridade(null);
    } finally {
      if (isActive()) {
        setLoadingSimilaridade(false);
      }
    }
  }, []);

  const loadFluxo = useCallback(async (nup: string, isActive: () => boolean = () => true) => {
    if (!isActive()) {
      return;
    }

    setLoadingFluxo(true);

    try {
      const response = await fetch(
        processoApiPath(nup, 'fluxo'),
      );
      if (!response.ok) {
        throw new Error('Falha ao carregar fluxo de tramitação');
      }

      const payload = (await response.json()) as FluxoTramitacaoData;
      if (!isActive()) {
        return;
      }

      setFluxo(payload);
    } catch (fluxoError) {
      console.error(fluxoError);
      if (!isActive()) {
        return;
      }

      setFluxo(null);
    } finally {
      if (isActive()) {
        setLoadingFluxo(false);
      }
    }
  }, []);

  const fetchGraph = useCallback(async (
    nup: string,
  ): Promise<
    | { ok: true; payload: RelacoesGraphData; central: RelacaoNode | null }
    | { ok: false; error: string }
  > => {
    if (!validarNup(nup)) {
      return {
        ok: false,
        error: 'Informe um NUP válido (ex.: 48500.035430/2025-02).',
      };
    }

    try {
      const response = await fetch(
        `/api/relacoes?nup=${encodeURIComponent(nup)}`,
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? 'Falha ao carregar relações');
      }

      const payload = (await response.json()) as RelacoesGraphData;
      const central =
        payload.nodes.find((node) => node.id === payload.processo_central_id) ??
        payload.nodes[0] ??
        null;

      return { ok: true, payload, central };
    } catch (loadError) {
      return {
        ok: false,
        error:
          loadError instanceof Error
            ? loadError.message
            : 'Erro ao carregar grafo',
      };
    }
  }, []);

  const loadGraph = useCallback(
    async (nup: string, isActive: () => boolean = () => true) => {
      if (!validarNup(nup)) {
        if (isActive()) {
          setError('Informe um NUP válido (ex.: 48500.035430/2025-02).');
        }
        return;
      }

      if (!isActive()) {
        return;
      }

      setLoadingGraph(true);
      setError(null);

      try {
        const result = await fetchGraph(nup);
        if (!isActive()) {
          return;
        }

        if (!result.ok) {
          setGraph(null);
          setFluxo(null);
          setError(result.error);
          return;
        }

        setGraph(result.payload);
        setActiveNup(nup);
        setSelectedNode(result.central);

        if (result.central) {
          await Promise.all([
            loadFluxo(result.central.nup, isActive),
            loadSimilaridade(nup, isActive),
          ]);
        }
      } finally {
        if (isActive()) {
          setLoadingGraph(false);
        }
      }
    },
    [fetchGraph, loadFluxo, loadSimilaridade],
  );

  useEffect(() => {
    if (!initialNup || !validarNup(initialNup)) {
      return;
    }

    let active = true;
    const isActive = () => active;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      setLoadingGraph(true);
      setError(null);
    });

    void fetchGraph(initialNup)
      .then(async (result) => {
        if (!active) {
          return;
        }

        if (!result.ok) {
          setGraph(null);
          setFluxo(null);
          setError(result.error);
          return;
        }

        setGraph(result.payload);
        setActiveNup(initialNup);
        setSelectedNode(result.central);

        if (result.central) {
          await Promise.all([
            loadFluxo(result.central.nup, isActive),
            loadSimilaridade(initialNup, isActive),
          ]);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingGraph(false);
        }
      });

    return () => {
      active = false;
    };
  }, [initialNup, fetchGraph, loadFluxo, loadSimilaridade]);

  const handleNodeSelect = (node: RelacaoNode) => {
    setSelectedNode(node);
    void loadFluxo(node.nup);
    void loadSimilaridade(node.nup);
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <GitBranch className="size-5 text-primary" aria-hidden />
          <PageTitle>Relações entre processos</PageTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Grafo interativo de <SeiTerm term="anexacao">anexações</SeiTerm>, referências,
          interessados e tipos processuais, com reconstrução do fluxo de{' '}
          <SeiTerm term="tramitacao">tramitação</SeiTerm>.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="size-4" aria-hidden />
            Processo central
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[280px] flex-1 space-y-2">
            <Label htmlFor="relacoes-nup">
              <SeiTerm term="nup">NUP</SeiTerm>
            </Label>
            <Input
              id="relacoes-nup"
              placeholder="48500.035430/2025-02"
              value={nupInput}
              onChange={(event) => setNupInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void loadGraph(nupInput.trim());
                }
              }}
            />
          </div>
          <Button
            type="button"
            onClick={() => void loadGraph(nupInput.trim())}
            disabled={loadingGraph}
          >
            {loadingGraph ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Carregando
              </>
            ) : (
              'Explorar relações'
            )}
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {graph ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Central:</span>
            <Badge variant="default">{activeNup}</Badge>
            <span className="text-sm text-muted-foreground">
              {graph.nodes.length} nós · {graph.edges.length} arestas
            </span>
            {selectedNode ? (
              <span className="text-sm text-muted-foreground">
                · Selecionado: {selectedNode.nup}
              </span>
            ) : null}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="edge-filter" className="sr-only">
                  Tipo de relação
                </Label>
                <span className="text-sm text-muted-foreground">
                  Filtrar por{' '}
                  <SeiTerm term="anexacao" definitionOnly>
                    anexação
                  </SeiTerm>
                  , referência ou interessado:
                </span>
                <select
                  id="edge-filter"
                  className={nativeSelectClass}
                  value={edgeFilter}
                  onChange={(event) =>
                    setEdgeFilter(event.target.value as RelacaoEdgeFilter)
                  }
                >
                  {EDGE_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <RelationGraph
                graph={graph}
                selectedNodeId={selectedNode?.id ?? graph.processo_central_id}
                edgeFilter={edgeFilter}
                onNodeSelect={handleNodeSelect}
              />
              <RelacaoLegend />
            </div>

            <FluxoPanel
              fluxo={fluxo}
              loading={loadingFluxo}
              nup={selectedNode?.nup ?? activeNup}
            />
          </div>

          <SimilaridadePanel
            data={similaridade}
            loading={loadingSimilaridade}
          />
        </>
      ) : null}
    </div>
  );
}

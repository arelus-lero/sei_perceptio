'use client';

import Link from 'next/link';
import { Loader2, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { processoHref } from '@/lib/utils/processo-url';
import type { SimilaridadeApiResponse } from '@/types/similaridade';

interface SimilaridadePanelProps {
  data: SimilaridadeApiResponse | null;
  loading: boolean;
  className?: string;
}

function scorePercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function ScoreBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span>{scorePercent(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function SimilaridadePanel({
  data,
  loading,
  className,
}: SimilaridadePanelProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Buscando processos similares...
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Informe um NUP para buscar precedentes e processos semelhantes.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" aria-hidden />
          Semelhança processual (RF-037)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Referência: {data.nup_referencia} · pesos tipo {Math.round(data.pesos.tipo * 100)}% ·
          conteúdo {Math.round(data.pesos.conteudo * 100)}% · fluxo{' '}
          {Math.round(data.pesos.fluxo * 100)}% · interessados{' '}
          {Math.round(data.pesos.interessados * 100)}%
        </p>
      </CardHeader>
      <CardContent>
        {data.resultados.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum processo similar encontrado com score mínimo de 20%.
          </p>
        ) : (
          <ul className="space-y-4">
            {data.resultados.map((item) => (
              <li
                key={item.processo_id}
                className="rounded-lg border border-border p-4 transition-colors hover:bg-muted/30"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={processoHref(item.nup)}
                    className="font-mono text-sm font-medium hover:underline"
                  >
                    {item.nup}
                  </Link>
                  <Badge variant="default">{scorePercent(item.score_total)} similar</Badge>
                </div>

                <p className="mb-2 text-xs text-muted-foreground">
                  {item.tipo_processo_desc} · {item.status}
                </p>

                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  <ScoreBar value={item.dimensoes.tipo} label="Tipo" />
                  <ScoreBar value={item.dimensoes.conteudo} label="Conteúdo (pgvector)" />
                  <ScoreBar value={item.dimensoes.fluxo} label="Fluxo" />
                  <ScoreBar value={item.dimensoes.interessados} label="Interessados" />
                </div>

                {item.motivos.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {item.motivos.map((motivo) => (
                      <Badge key={motivo} variant="outline" className="text-[10px]">
                        {motivo}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

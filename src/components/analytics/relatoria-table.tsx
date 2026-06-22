'use client';

import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionTitle } from '@/components/layout/headings';
import { cn } from '@/lib/utils';
import type { RelatoriaRegistro } from '@/types/analytics-relatoria';

interface RelatoriaTableProps {
  registros: RelatoriaRegistro[];
  className?: string;
}

function formatDataHora(value: string): string {
  try {
    return format(parseISO(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return value;
  }
}

export function RelatoriaTable({ registros, className }: RelatoriaTableProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return registros;
    }

    return registros.filter((registro) => {
      const haystack = [
        registro.nup,
        registro.relator_nome,
        registro.sessao_distribuicao,
        registro.resultado_deliberativo,
        registro.unidade,
        registro.descricao,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [registros, search]);

  return (
    <article className={cn('rounded-xl border border-border bg-card p-4 shadow-sm', className)}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionTitle>Registros de distribuição</SectionTitle>
          <p className="text-sm text-muted-foreground">
            {filtered.length} de {registros.length} registro(s)
          </p>
        </div>

        <div className="w-full max-w-sm space-y-1">
          <Label htmlFor="relatoria-table-search" className="sr-only">
            Buscar na tabela
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="relatoria-table-search"
              type="search"
              placeholder="Filtrar por NUP, relator, sessão…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum registro corresponde aos filtros aplicados.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-3 py-2 font-medium">NUP</th>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Diretor-relator</th>
                <th className="px-3 py-2 font-medium">Sessão</th>
                <th className="px-3 py-2 font-medium">Resultado deliberativo</th>
                <th className="px-3 py-2 font-medium">Unidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((registro) => (
                <tr key={registro.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs">{registro.nup}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {formatDataHora(registro.data_hora)}
                  </td>
                  <td className="px-3 py-2">{registro.relator_nome ?? '—'}</td>
                  <td className="px-3 py-2">{registro.sessao_distribuicao ?? '—'}</td>
                  <td className="max-w-md px-3 py-2 text-muted-foreground">
                    {registro.resultado_deliberativo ?? '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{registro.unidade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

'use client';

import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_LOG_ACTIONS,
  AUDIT_LOG_RETENTION_YEARS,
} from '@/lib/governance/constants';
import { cn } from '@/lib/utils';
import type { AuditLogListItem, AuditLogListResponse } from '@/types/governance';

interface AuditLogTableProps {
  initialData: AuditLogListResponse;
  className?: string;
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDetalhes(detalhes: Record<string, unknown>): string {
  try {
    const text = JSON.stringify(detalhes);
    return text.length > 120 ? `${text.slice(0, 117)}…` : text;
  } catch {
    return '—';
  }
}

export function AuditLogTable({ initialData, className }: AuditLogTableProps) {
  const [data, setData] = useState(initialData);
  const [acao, setAcao] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [pagina, setPagina] = useState(initialData.pagina);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = useCallback(async (page: number) => {
    setIsLoading(true);

    const params = new URLSearchParams({
      pagina: String(page),
      por_pagina: String(data.por_pagina),
    });

    if (acao) {
      params.set('acao', acao);
    }
    if (dataInicio) {
      params.set('data_inicio', dataInicio);
    }
    if (dataFim) {
      params.set('data_fim', dataFim);
    }

    try {
      const response = await fetch(`/api/admin/auditoria?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Falha ao carregar logs');
      }

      const json = (await response.json()) as { data: AuditLogListResponse };
      setData(json.data);
      setPagina(page);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [acao, data.por_pagina, dataInicio, dataFim]);

  const totalPaginas = Math.max(1, Math.ceil(data.total / data.por_pagina));

  return (
    <div className={cn('space-y-4', className)}>
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              void fetchLogs(1);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="audit-acao">Ação</Label>
              <Select
                value={acao || 'all'}
                onValueChange={(value) => setAcao(value === 'all' ? '' : value)}
              >
                <SelectTrigger id="audit-acao">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {AUDIT_LOG_ACTIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {AUDIT_ACTION_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-inicio">Data início</Label>
              <Input
                id="audit-inicio"
                type="date"
                value={dataInicio}
                onChange={(event) => setDataInicio(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-fim">Data fim</Label>
              <Input
                id="audit-fim"
                type="date"
                value={dataFim}
                onChange={(event) => setDataFim(event.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Carregando…
                  </>
                ) : (
                  'Filtrar'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Retenção mínima: {AUDIT_LOG_RETENTION_YEARS} anos (RF-040). Registros imutáveis
        (INSERT-only).
      </p>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Usuário</th>
              <th className="px-3 py-2 font-medium">Ação</th>
              <th className="px-3 py-2 font-medium">Entidade</th>
              <th className="px-3 py-2 font-medium">Detalhes</th>
              <th className="px-3 py-2 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {data.logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              data.logs.map((log: AuditLogListItem) => (
                <tr key={log.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDateTime(log.data_criacao)}
                  </td>
                  <td className="px-3 py-2">{log.usuario_nome ?? '—'}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">
                      {AUDIT_ACTION_LABELS[log.acao] ?? log.acao}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs">{log.entidade_tipo}</span>
                    {log.entidade_id ? (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {log.entidade_id}
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-xs px-3 py-2 text-xs text-muted-foreground">
                    {formatDetalhes(log.detalhes_json)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {log.ip_address ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {data.total} registro(s) · página {pagina} de {totalPaginas}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pagina <= 1 || isLoading}
            onClick={() => void fetchLogs(pagina - 1)}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pagina >= totalPaginas || isLoading}
            onClick={() => void fetchLogs(pagina + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}

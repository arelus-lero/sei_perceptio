'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Share2, ShieldAlert, UserMinus } from 'lucide-react';
import { toast } from 'sonner';

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
import type { CompartilhamentoPermissao } from '@/lib/db/schema';
import { cn } from '@/lib/utils';
import type {
  NotebookShareItem,
  NotebookShareListResponse,
  OrgaoMembroItem,
} from '@/types/notebook-share';

const PERMISSAO_LABELS: Record<CompartilhamentoPermissao, string> = {
  leitura: 'Leitura',
  comentario: 'Comentário',
  edicao: 'Edição',
};

interface ShareDialogProps {
  notebookId: string;
  className?: string;
}

export function ShareDialog({ notebookId, className }: ShareDialogProps) {
  const [data, setData] = useState<NotebookShareListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usuarioDestinoId, setUsuarioDestinoId] = useState('');
  const [permissao, setPermissao] = useState<CompartilhamentoPermissao>('leitura');
  const [sigiloConfirmacao, setSigiloConfirmacao] = useState('');

  const fetchShares = useCallback(async (): Promise<
    { ok: true; data: NotebookShareListResponse } | { ok: false; error: string }
  > => {
    try {
      const response = await fetch(`/api/notebooks/${notebookId}/share`);
      if (!response.ok) {
        throw new Error('Não foi possível carregar compartilhamentos');
      }

      const json = (await response.json()) as { data: NotebookShareListResponse };
      return { ok: true, data: json.data };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Erro ao carregar',
      };
    }
  }, [notebookId]);

  const loadShares = useCallback(async () => {
    setIsLoading(true);

    const result = await fetchShares();
    if (result.ok) {
      setData(result.data);
    } else {
      toast.error(result.error);
    }

    setIsLoading(false);
  }, [fetchShares]);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (active) {
        setIsLoading(true);
      }
    });

    void fetchShares()
      .then((result) => {
        if (!active) {
          return;
        }

        if (result.ok) {
          setData(result.data);
        } else {
          toast.error(result.error);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fetchShares]);

  async function handleShare(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!usuarioDestinoId) {
      toast.error('Selecione um usuário');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/notebooks/${notebookId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_destino_id: usuarioDestinoId,
          permissao,
          sigilo_confirmacao: sigiloConfirmacao || undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'Falha ao compartilhar');
      }

      toast.success('Notebook compartilhado.');
      setUsuarioDestinoId('');
      setSigiloConfirmacao('');
      await loadShares();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao compartilhar');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevoke(share: NotebookShareItem) {
    try {
      const response = await fetch(
        `/api/notebooks/${notebookId}/share/${share.id}`,
        { method: 'DELETE' },
      );

      if (!response.ok) {
        throw new Error('Falha ao revogar compartilhamento');
      }

      toast.success('Compartilhamento revogado.');
      await loadShares();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao revogar');
    }
  }

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <Loader2 className="size-4 animate-spin" />
        Carregando compartilhamentos…
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className={cn('space-y-4', className)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="size-4" />
            Compartilhar notebook
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.sigilo.contem_sigiloso ? (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">Conteúdo sigiloso detectado</p>
                <p className="text-muted-foreground">
                  NUPs: {data.sigilo.nups_sigilosos.join(', ')}. Compartilhamento
                  exige confirmação de administrador.
                </p>
              </div>
            </div>
          ) : null}

          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleShare}>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="share-usuario">Usuário do órgão</Label>
              <Select
                value={usuarioDestinoId || undefined}
                onValueChange={setUsuarioDestinoId}
              >
                <SelectTrigger id="share-usuario">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {data.membros_orgao.map((membro: OrgaoMembroItem) => (
                    <SelectItem key={membro.user_id} value={membro.user_id}>
                      {membro.nome_completo}
                      {membro.email ? ` (${membro.email})` : ''} — {membro.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="share-permissao">Permissão</Label>
              <Select
                value={permissao}
                onValueChange={(value) =>
                  setPermissao(value as CompartilhamentoPermissao)
                }
              >
                <SelectTrigger id="share-permissao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leitura">
                    Leitura — visualizar e consultar RAG
                  </SelectItem>
                  <SelectItem value="comentario">
                    Comentário — leitura + conversas
                  </SelectItem>
                  <SelectItem value="edicao">Edição — upload e alterações</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {data.sigilo.contem_sigiloso ? (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="share-sigilo">Confirmação sigilo (admin)</Label>
                <Input
                  id="share-sigilo"
                  value={sigiloConfirmacao}
                  onChange={(event) => setSigiloConfirmacao(event.target.value)}
                  placeholder="Descreva a autorização para compartilhar conteúdo sigiloso (mín. 15 caracteres)"
                  minLength={15}
                />
              </div>
            ) : null}

            <div className="md:col-span-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Compartilhando…
                  </>
                ) : (
                  'Compartilhar'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Usuário</th>
              <th className="px-3 py-2 font-medium">Permissão</th>
              <th className="px-3 py-2 font-medium">Desde</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {data.compartilhamentos.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum compartilhamento ativo.
                </td>
              </tr>
            ) : (
              data.compartilhamentos.map((share) => (
                <tr key={share.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2">
                    <div>{share.usuario_nome}</div>
                    <div className="text-xs text-muted-foreground">{share.usuario_email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{PERMISSAO_LABELS[share.permissao]}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(share.data_compartilhamento).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRevoke(share)}
                    >
                      <UserMinus className="size-4" />
                      Revogar
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

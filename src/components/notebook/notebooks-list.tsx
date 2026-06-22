'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';

import { NotebookCard } from '@/components/notebook/notebook-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { NotebookListItem } from '@/types/notebook';

interface NotebooksListProps {
  initialNotebooks: NotebookListItem[];
  canCreate: boolean;
}

export function NotebooksList({ initialNotebooks, canCreate }: NotebooksListProps) {
  const router = useRouter();
  const [notebooks, setNotebooks] = useState(initialNotebooks);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedNome = nome.trim();
    if (!trimmedNome || isCreating) {
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      const response = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: trimmedNome,
          descricao: descricao.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? `Erro ${response.status}`);
      }

      const created = (await response.json()) as {
        id: string;
        nome: string;
        descricao: string | null;
        data_criacao: string;
      };

      setNotebooks((current) => [
        {
          id: created.id,
          nome: created.nome,
          descricao: created.descricao,
          fontes_count: 0,
          data_criacao: created.data_criacao,
          compartilhado: false,
        },
        ...current,
      ]);

      setNome('');
      setDescricao('');
      router.push(`/notebooks/${created.id}`);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Erro ao criar notebook';
      setError(message);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(notebookId: string) {
    if (deletingId) {
      return;
    }

    const confirmed = window.confirm('Excluir este notebook e todas as fontes/conversas?');
    if (!confirmed) {
      return;
    }

    setDeletingId(notebookId);
    setError(null);

    try {
      const response = await fetch(`/api/notebooks/${notebookId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? `Erro ${response.status}`);
      }

      setNotebooks((current) => current.filter((entry) => entry.id !== notebookId));
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Erro ao excluir notebook';
      setError(message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {canCreate ? (
        <Card data-tour="create-notebook">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="size-4" />
              Novo notebook
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="notebook-nome">Nome</Label>
                <Input
                  id="notebook-nome"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  placeholder="Ex.: Licitações 2025"
                  maxLength={200}
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notebook-descricao">Descrição (opcional)</Label>
                <Textarea
                  id="notebook-descricao"
                  value={descricao}
                  onChange={(event) => setDescricao(event.target.value)}
                  placeholder="Descreva o tema ou escopo deste notebook"
                  maxLength={2000}
                  rows={2}
                />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={isCreating || nome.trim().length === 0}>
                  {isCreating ? <Loader2 className="animate-spin" /> : <Plus />}
                  Criar notebook
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {notebooks.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum notebook encontrado. {canCreate ? 'Crie o primeiro acima.' : ''}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-tour="notebook-list">
          {notebooks.map((notebook) => (
            <div key={notebook.id} className="relative">
              <NotebookCard notebook={notebook} />
              {canCreate && !notebook.compartilhado ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-2 text-destructive hover:text-destructive"
                  disabled={deletingId === notebook.id}
                  onClick={(event) => {
                    event.preventDefault();
                    void handleDelete(notebook.id);
                  }}
                  aria-label={`Excluir ${notebook.nome}`}
                >
                  {deletingId === notebook.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

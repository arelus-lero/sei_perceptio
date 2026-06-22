import Link from 'next/link';
import { redirect } from 'next/navigation';

import { NotebooksList } from '@/components/notebook/notebooks-list';
import { PageTitle } from '@/components/layout/headings';
import { Button } from '@/components/ui/button';
import { createServerClient } from '@/lib/supabase/server';
import type { NotebookListItem } from '@/types/notebook';

function parseUserRole(value: unknown): 'admin' | 'analista' | 'consultor' | null {
  if (value === 'admin' || value === 'analista' || value === 'consultor') {
    return value;
  }
  return null;
}

export default async function NotebooksPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const role = parseUserRole(user.app_metadata?.role);
  const canCreate = role === 'admin' || role === 'analista';

  const { data: notebooks, error } = await supabase
    .from('notebook')
    .select('id, nome, descricao, created_at, usuario_criador_id')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load notebooks: ${error.message}`);
  }

  const notebookRows = notebooks ?? [];
  const notebookIds = notebookRows.map((row) => row.id);
  const fonteCountByNotebook = new Map<string, number>();

  if (notebookIds.length > 0) {
    const { data: fonteRows } = await supabase
      .from('fonte')
      .select('notebook_id')
      .in('notebook_id', notebookIds);

    for (const row of fonteRows ?? []) {
      fonteCountByNotebook.set(
        row.notebook_id,
        (fonteCountByNotebook.get(row.notebook_id) ?? 0) + 1,
      );
    }
  }

  const initialNotebooks: NotebookListItem[] = notebookRows.map((row) => ({
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    fontes_count: fonteCountByNotebook.get(row.id) ?? 0,
    data_criacao: row.created_at,
    compartilhado: row.usuario_criador_id !== user.id,
  }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6" data-tour="notebooks-page">
      <div className="flex items-center justify-between gap-4">
        <div>
          <PageTitle className="font-heading">Notebooks</PageTitle>
          <p className="text-sm text-muted-foreground">
            Espaços temáticos com fontes e histórico de conversa independentes (RF-030).
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>

      <NotebooksList initialNotebooks={initialNotebooks} canCreate={canCreate} />
    </div>
  );
}

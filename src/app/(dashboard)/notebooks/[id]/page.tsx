import { notFound, redirect } from 'next/navigation';

import { ChatPanel } from '@/components/chat/chat-panel';
import { PageTitle } from '@/components/layout/headings';
import { readFonteIngestionStatus } from '@/lib/ingestion/ingestion-status';
import { createServerClient } from '@/lib/supabase/server';
import type { NotebookFonte } from '@/types/chat';

interface NotebookPageProps {
  params: Promise<{ id: string }>;
}

function parseUserRole(value: unknown): 'admin' | 'analista' | 'consultor' | null {
  if (value === 'admin' || value === 'analista' || value === 'consultor') {
    return value;
  }
  return null;
}

export default async function NotebookPage({ params }: NotebookPageProps) {
  const { id } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const role = parseUserRole(user.app_metadata?.role);

  const { data: notebook, error: notebookError } = await supabase
    .from('notebook')
    .select('id, nome, descricao, orgao_id, usuario_criador_id')
    .eq('id', id)
    .single();

  if (notebookError || !notebook) {
    notFound();
  }

  const { data: fontes, error: fontesError } = await supabase
    .from('fonte')
    .select(
      `
      id,
      titulo,
      ativa,
      tipo_origem,
      metadados_json,
      fonte_tag (
        tag:tag_id (
          id,
          nome,
          cor,
          created_at
        )
      )
    `,
    )
    .eq('notebook_id', id)
    .order('created_at', { ascending: true });

  if (fontesError) {
    notFound();
  }

  const notebookFontes: NotebookFonte[] = (fontes ?? []).map((fonte) => {
    const tagRows = fonte.fonte_tag as unknown as Array<{
      tag: { id: string; nome: string; cor: string; created_at: string } | null;
    }> | null;

    return {
      id: fonte.id,
      titulo: fonte.titulo,
      ativa: fonte.ativa,
      tipo_origem: fonte.tipo_origem,
      ingestion_status: readFonteIngestionStatus(
        fonte.metadados_json as Record<string, unknown> | null,
      ),
      tags: (tagRows ?? [])
        .map((row) => row.tag)
        .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag)),
    };
  });

  const canAssignTags = role === 'admin' || role === 'analista';
  const canUpload =
    canAssignTags && notebook.usuario_criador_id === user.id;

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <PageTitle className="sr-only">{notebook.nome}</PageTitle>
      <ChatPanel
        notebookId={notebook.id}
        notebookName={notebook.nome}
        fontes={notebookFontes}
        canUpload={canUpload}
        canAssignTags={canAssignTags}
        className="min-h-0"
      />
    </div>
  );
}

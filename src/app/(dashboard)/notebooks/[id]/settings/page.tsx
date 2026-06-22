import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Settings } from 'lucide-react';

import { ExportPanel } from '@/components/notebook/export-panel';
import { ShareDialog } from '@/components/notebook/share-dialog';
import { PageTitle } from '@/components/layout/headings';
import { Button } from '@/components/ui/button';
import { getServerAuthContext } from '@/lib/auth/server-context';
import { resolveNotebookAccess } from '@/lib/notebook/access';
import { scanNotebookSigilo } from '@/lib/notebook/sigilo-notebook';

interface NotebookSettingsPageProps {
  params: Promise<{ id: string }>;
}

export default async function NotebookSettingsPage({
  params,
}: NotebookSettingsPageProps) {
  const auth = await getServerAuthContext();
  if (!auth) {
    redirect('/login');
  }

  const { id } = await params;

  const access = await resolveNotebookAccess({
    supabase: auth.supabase,
    notebookId: id,
    orgaoId: auth.orgaoId,
    userId: auth.user.id,
    userRole: auth.role,
  });

  if (!access?.canRead) {
    redirect('/notebooks');
  }

  const { data: notebook } = await auth.supabase
    .from('notebook')
    .select('id, nome, descricao')
    .eq('id', id)
    .eq('orgao_id', auth.orgaoId)
    .single();

  if (!notebook) {
    redirect('/notebooks');
  }

  const sigilo = await scanNotebookSigilo(auth.supabase, id, auth.orgaoId);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6">
      <header className="space-y-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/notebooks/${id}`}>
            <ArrowLeft className="size-4" />
            Voltar ao notebook
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Settings className="size-5 text-primary" aria-hidden />
          <PageTitle>Configurações — {notebook.nome}</PageTitle>
        </div>
        {notebook.descricao ? (
          <p className="text-sm text-muted-foreground">{notebook.descricao}</p>
        ) : null}
      </header>

      {access.canShare ? (
        <ShareDialog notebookId={id} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Somente o criador ou administrador pode gerenciar compartilhamentos.
        </p>
      )}

      <ExportPanel
        notebookId={id}
        notebookNome={notebook.nome}
        canExport={access.canExport}
        contemSigiloso={sigilo.contem_sigiloso}
      />
    </div>
  );
}

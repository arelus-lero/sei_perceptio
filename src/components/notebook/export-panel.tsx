'use client';

import { useState } from 'react';
import { Download, FileText, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, nativeSelectClass } from '@/lib/utils';
import type { NotebookExportFormat } from '@/types/notebook-share';

interface ExportPanelProps {
  notebookId: string;
  notebookNome: string;
  canExport: boolean;
  contemSigiloso?: boolean;
  className?: string;
}

export function ExportPanel({
  notebookId,
  notebookNome,
  canExport,
  contemSigiloso = false,
  className,
}: ExportPanelProps) {
  const [formato, setFormato] = useState<NotebookExportFormat>('markdown');
  const [sigiloConfirmacao, setSigiloConfirmacao] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    if (!canExport) {
      toast.error('Sem permissão para exportar este notebook');
      return;
    }

    setIsExporting(true);
    try {
      const params = new URLSearchParams({ formato });
      if (sigiloConfirmacao.trim()) {
        params.set('sigilo_confirmacao', sigiloConfirmacao.trim());
      }

      const response = await fetch(
        `/api/notebooks/${notebookId}/export?${params.toString()}`,
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'Falha na exportação');
      }

      const blob = await response.blob();
      const checksum = response.headers.get('X-Export-Checksum');
      const extension = formato === 'pdf' ? 'pdf' : 'md';
      const safeName = notebookNome.replace(/[^\w.-]+/g, '_').slice(0, 80);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `notebook-${safeName}.${extension}`;
      anchor.click();
      URL.revokeObjectURL(url);

      toast.success(
        checksum
          ? `Exportação concluída. Checksum: ${checksum.slice(0, 12)}…`
          : 'Exportação concluída.',
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro na exportação');
    } finally {
      setIsExporting(false);
    }
  }

  if (!canExport) {
    return (
      <Card className={className}>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Exportação disponível apenas para o criador ou usuários com permissão de
          edição (analista/admin).
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="size-4" />
          Exportar notebook (RF-033)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Inclui fontes, histórico de conversas, sínteses IA e metadados de
          rastreabilidade (checksum SHA-256, selo IA, exportador).
        </p>

        {contemSigiloso ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>
              Este notebook contém processos sigilosos. Exportação exige confirmação
              de administrador.
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="export-formato">Formato</Label>
            <select
              id="export-formato"
              className={nativeSelectClass}
              value={formato}
              onChange={(event) =>
                setFormato(event.target.value as NotebookExportFormat)
              }
            >
              <option value="markdown">Markdown (.md)</option>
              <option value="pdf">PDF (.pdf)</option>
            </select>
          </div>

          {contemSigiloso ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="export-sigilo">Confirmação sigilo</Label>
              <Input
                id="export-sigilo"
                value={sigiloConfirmacao}
                onChange={(event) => setSigiloConfirmacao(event.target.value)}
                placeholder="Autorização para exportar conteúdo sigiloso (mín. 15 caracteres)"
                minLength={15}
              />
            </div>
          ) : null}
        </div>

        <Button type="button" onClick={() => void handleExport()} disabled={isExporting}>
          {isExporting ? (
            <>
              <Loader2 className="animate-spin" />
              Exportando…
            </>
          ) : (
            <>
              <FileText className="size-4" />
              Baixar {formato === 'pdf' ? 'PDF' : 'Markdown'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

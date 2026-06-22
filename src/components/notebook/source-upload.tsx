'use client';

import { useCallback, useState } from 'react';
import { type FileRejection, useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Copy, Link2, Loader2, UploadCloud } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  buildIngestionProgressState,
  buildUploadingProgressState,
  type IngestionProgressState,
  SourceIngestionProgress,
} from '@/components/notebook/source-ingestion-progress';
import {
  isEmbeddingDegradedStatus,
  isIngestionFailure,
  isTerminalIngestionSnapshot,
  type IngestionStatusSnapshot,
} from '@/lib/ingestion/ingestion-status';
import { cn } from '@/lib/utils';
import type {
  DuplicateFonteMatch,
  SimilarFonteMatch,
  UploadDedupAlertPayload,
} from '@/types/dedup';

const MAX_UPLOAD_BYTES = 524_288_000;
const MAX_UPLOAD_LABEL = '500 MB';

const ACCEPTED_MIME_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
  'text/html': ['.html', '.htm'],
  'application/xhtml+xml': ['.html', '.htm'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/tiff': ['.tiff', '.tif'],
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
};

interface UploadConfirmFlags {
  confirmChecksumDuplicate?: boolean;
  confirmSimilarContent?: boolean;
}

interface PendingUrlSource {
  url: string;
  titulo?: string;
}

interface SourceUploadProps {
  notebookId: string;
  canUpload: boolean;
  className?: string;
  onIngestionComplete?: () => void;
}

interface UploadSuccessPayload {
  fonte_id: string;
  status: string;
  job_id?: string;
}

function isUploadSuccess(
  payload: unknown,
): payload is UploadSuccessPayload & { fetched_url?: string } {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const p = payload as Record<string, unknown>;

  return (
    typeof p.fonte_id === 'string'
    && typeof p.status === 'string'
    && (p.fetched_url === undefined || typeof p.fetched_url === 'string')
  );
}

interface IngestionStatusPayload {
  data: IngestionStatusSnapshot;
}

const POLL_MAX_ATTEMPTS = 60;
const POLL_DELAY_MS = 2000;

type IngestionPollOutcome =
  | { kind: 'success'; data: IngestionStatusSnapshot }
  | { kind: 'failed'; data: IngestionStatusSnapshot; message: string }
  | { kind: 'timeout'; message: string };

async function pollIngestionStatus(
  fonteId: string,
  onProgress?: (state: IngestionProgressState) => void,
): Promise<IngestionPollOutcome> {
  let lastSnapshot: IngestionStatusSnapshot | null = null;

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`/api/ingest/status/${fonteId}`);
    const payload = (await response.json()) as IngestionStatusPayload;

    if (!response.ok) {
      throw new Error('Falha ao consultar status da ingestão');
    }

    lastSnapshot = payload.data;
    onProgress?.(
      buildIngestionProgressState(payload.data, attempt + 1, POLL_MAX_ATTEMPTS),
    );

    if (isIngestionFailure(payload.data)) {
      const message =
        payload.data.ingestion_job?.error
        ?? 'Falha no processamento assíncrono da fonte';
      return { kind: 'failed', data: payload.data, message };
    }

    if (isTerminalIngestionSnapshot(payload.data)) {
      return { kind: 'success', data: payload.data };
    }

    await new Promise((resolve) => {
      setTimeout(resolve, POLL_DELAY_MS);
    });
  }

  if (lastSnapshot) {
    onProgress?.(
      buildIngestionProgressState(lastSnapshot, POLL_MAX_ATTEMPTS, POLL_MAX_ATTEMPTS, true),
    );
  }

  return {
    kind: 'timeout',
    message: 'Tempo esgotado aguardando conclusão da ingestão',
  };
}

function formatSimilarity(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function parseDedupAlert(
  status: number,
  payload: Record<string, unknown>,
): UploadDedupAlertPayload | null {
  if (status !== 409) {
    return null;
  }

  if (payload.code === 'DUPLICATE_CHECKSUM') {
    return {
      kind: 'checksum',
      message:
        typeof payload.error === 'string'
          ? payload.error
          : 'Arquivo idêntico já existe neste órgão.',
      duplicates: (payload.duplicates as DuplicateFonteMatch[] | undefined) ?? [],
    };
  }

  if (payload.code === 'SIMILAR_CONTENT') {
    return {
      kind: 'similar',
      message:
        typeof payload.error === 'string'
          ? payload.error
          : 'Conteúdo similar detectado em fontes existentes.',
      matches: (payload.matches as SimilarFonteMatch[] | undefined) ?? [],
    };
  }

  return null;
}

export function SourceUpload({ notebookId, canUpload, className, onIngestionComplete }: SourceUploadProps) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpload, setLastUpload] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingUrl, setPendingUrl] = useState<PendingUrlSource | null>(null);
  const [dedupAlert, setDedupAlert] = useState<UploadDedupAlertPayload | null>(null);
  const [confirmFlags, setConfirmFlags] = useState<UploadConfirmFlags>({});
  const [urlInput, setUrlInput] = useState('');
  const [urlTitulo, setUrlTitulo] = useState('');
  const [ingestionProgress, setIngestionProgress] = useState<IngestionProgressState | null>(
    null,
  );
  const [retryFonteId, setRetryFonteId] = useState<string | null>(null);

  const pollUntilTerminal = useCallback(async (fonteId: string): Promise<IngestionPollOutcome> => {
    const outcome = await pollIngestionStatus(fonteId, (state) => {
      setIngestionProgress(state);
    });

    if (outcome.kind === 'success') {
      setIngestionProgress(
        buildIngestionProgressState(outcome.data, POLL_MAX_ATTEMPTS, POLL_MAX_ATTEMPTS),
      );
      setRetryFonteId(null);
      return outcome;
    }

    if (outcome.kind === 'failed') {
      setIngestionProgress(
        buildIngestionProgressState(outcome.data, POLL_MAX_ATTEMPTS, POLL_MAX_ATTEMPTS),
      );
      setRetryFonteId(fonteId);
      return outcome;
    }

    setRetryFonteId(fonteId);
    return outcome;
  }, []);

  const finalizeIngestion = useCallback(
    async (label: string, fonteId: string | undefined, successStatus: string) => {
      if (successStatus === 'processando' && fonteId) {
        const outcome = await pollUntilTerminal(fonteId);

        if (outcome.kind === 'failed') {
          throw new Error(outcome.message);
        }

        if (outcome.kind === 'timeout') {
          throw new Error(outcome.message);
        }

        setLastUpload(`${label} (${outcome.data.status})`);
      } else {
        setLastUpload(`${label} (${successStatus})`);
      }

      router.refresh();
      onIngestionComplete?.();
    },
    [onIngestionComplete, pollUntilTerminal, router],
  );

  const retryIngestion = useCallback(async () => {
    if (!retryFonteId) {
      return;
    }

    const useReembed =
      ingestionProgress?.snapshot.status === 'erro_embeddings'
      || isEmbeddingDegradedStatus(ingestionProgress?.snapshot.status ?? 'processando');

    setIsUploading(true);
    setError(null);
    setIngestionProgress(buildUploadingProgressState(POLL_MAX_ATTEMPTS));

    try {
      const endpoint = useReembed
        ? `/api/ingest/reembed/${retryFonteId}`
        : `/api/ingest/reprocess/${retryFonteId}`;
      const response = await fetch(endpoint, {
        method: 'POST',
      });
      const payload = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        throw new Error(
          typeof payload.error === 'string' ? payload.error : `Erro ${response.status}`,
        );
      }

      const outcome = await pollUntilTerminal(retryFonteId);

      if (outcome.kind === 'failed') {
        throw new Error(outcome.message);
      }

      if (outcome.kind === 'timeout') {
        throw new Error(outcome.message);
      }

      setIngestionProgress(null);
      setRetryFonteId(null);
      onIngestionComplete?.();
      router.refresh();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Erro ao reprocessar fonte';
      setError(message);
    } finally {
      setIsUploading(false);
    }
  }, [ingestionProgress?.snapshot.status, onIngestionComplete, pollUntilTerminal, retryFonteId, router]);

  const uploadFile = useCallback(
    async (file: File, flags: UploadConfirmFlags = {}) => {
      setIsUploading(true);
      setError(null);
      setRetryFonteId(null);
      setIngestionProgress(buildUploadingProgressState(POLL_MAX_ATTEMPTS));

      try {
        const formData = new FormData();
        formData.append('file', file);

        if (flags.confirmChecksumDuplicate) {
          formData.append('confirm_checksum_duplicate', 'true');
        }

        if (flags.confirmSimilarContent) {
          formData.append('confirm_similar_content', 'true');
        }

        const response = await fetch(`/api/notebooks/${notebookId}/sources`, {
          method: 'POST',
          body: formData,
        });

        const payload = (await response.json()) as Record<string, unknown>;

        if (!response.ok) {
          const alert = parseDedupAlert(response.status, payload);

          if (alert) {
            setPendingFile(file);
            setDedupAlert(alert);
            setConfirmFlags((current) => ({
              confirmChecksumDuplicate:
                current.confirmChecksumDuplicate || flags.confirmChecksumDuplicate === true,
              confirmSimilarContent:
                current.confirmSimilarContent || flags.confirmSimilarContent === true,
            }));
            setIngestionProgress(null);
            return;
          }

          throw new Error(
            typeof payload.error === 'string' ? payload.error : `Erro ${response.status}`,
          );
        }

        if (!isUploadSuccess(payload)) {
          throw new Error('Resposta inválida do servidor');
        }

        const success = payload;
        setPendingFile(null);
        setPendingUrl(null);
        setDedupAlert(null);
        setConfirmFlags({});

        await finalizeIngestion(file.name, success.fonte_id, success.status);
        setIngestionProgress(null);
        setRetryFonteId(null);
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : 'Erro no upload';
        setError(message);
        onIngestionComplete?.();
      } finally {
        setIsUploading(false);
      }
    },
    [finalizeIngestion, notebookId, onIngestionComplete],
  );

  const importUrl = useCallback(
    async (source: PendingUrlSource, flags: UploadConfirmFlags = {}) => {
      setIsUploading(true);
      setError(null);
      setRetryFonteId(null);
      setIngestionProgress(buildUploadingProgressState(POLL_MAX_ATTEMPTS));

      try {
        const response = await fetch('/api/fontes/url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notebook_id: notebookId,
            url: source.url,
            titulo: source.titulo?.trim() || undefined,
            confirm_checksum_duplicate: flags.confirmChecksumDuplicate === true,
            confirm_similar_content: flags.confirmSimilarContent === true,
          }),
        });

        const payload = (await response.json()) as Record<string, unknown>;

        if (!response.ok) {
          const alert = parseDedupAlert(response.status, payload);

          if (alert) {
            setPendingUrl(source);
            setPendingFile(null);
            setDedupAlert(alert);
            setConfirmFlags((current) => ({
              confirmChecksumDuplicate:
                current.confirmChecksumDuplicate || flags.confirmChecksumDuplicate === true,
              confirmSimilarContent:
                current.confirmSimilarContent || flags.confirmSimilarContent === true,
            }));
            setIngestionProgress(null);
            return;
          }

          throw new Error(
            typeof payload.error === 'string' ? payload.error : `Erro ${response.status}`,
          );
        }

        if (!isUploadSuccess(payload)) {
          throw new Error('Resposta inválida do servidor');
        }

        const success = payload;
        setPendingFile(null);
        setPendingUrl(null);
        setDedupAlert(null);
        setConfirmFlags({});
        setUrlInput('');
        setUrlTitulo('');

        const label = source.titulo?.trim() || success.fetched_url || source.url;
        await finalizeIngestion(label, success.fonte_id, success.status);
        setIngestionProgress(null);
        setRetryFonteId(null);
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : 'Erro ao importar URL';
        setError(message);
        onIngestionComplete?.();
      } finally {
        setIsUploading(false);
      }
    },
    [finalizeIngestion, notebookId, onIngestionComplete],
  );

  const handleConfirmDuplicate = useCallback(() => {
    if (!dedupAlert) {
      return;
    }

    const nextFlags: UploadConfirmFlags = { ...confirmFlags };

    if (dedupAlert.kind === 'checksum') {
      nextFlags.confirmChecksumDuplicate = true;
    }

    if (dedupAlert.kind === 'similar') {
      nextFlags.confirmSimilarContent = true;
    }

    setConfirmFlags(nextFlags);

    if (pendingFile) {
      void uploadFile(pendingFile, nextFlags);
      return;
    }

    if (pendingUrl) {
      void importUrl(pendingUrl, nextFlags);
    }
  }, [confirmFlags, dedupAlert, importUrl, pendingFile, pendingUrl, uploadFile]);

  const handleCancelDedup = useCallback(() => {
    setPendingFile(null);
    setPendingUrl(null);
    setDedupAlert(null);
    setConfirmFlags({});
    setError(null);
  }, []);

  const handleSubmitUrl = useCallback(() => {
    const trimmedUrl = urlInput.trim();

    if (!trimmedUrl) {
      setError('Informe uma URL pública http(s).');
      return;
    }

    setPendingFile(null);
    setDedupAlert(null);
    setConfirmFlags({});
    void importUrl({
      url: trimmedUrl,
      titulo: urlTitulo.trim() || undefined,
    });
  }, [importUrl, urlInput, urlTitulo]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        setPendingUrl(null);
        setPendingFile(null);
        setDedupAlert(null);
        setConfirmFlags({});
        void uploadFile(file);
      }
    },
    [uploadFile],
  );

  const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
    const rejection = fileRejections[0];
    if (!rejection) {
      return;
    }

    const { errors } = rejection;

    if (errors.some((error) => error.code === 'file-too-large')) {
      toast.error(`Arquivo excede o limite de ${MAX_UPLOAD_LABEL}`);
      return;
    }

    if (errors.some((error) => error.code === 'file-invalid-type')) {
      toast.error('Formato não suportado');
      return;
    }

    if (errors.some((error) => error.code === 'too-many-files')) {
      toast.error('Envie apenas um arquivo por vez');
      return;
    }

    toast.error(errors[0]?.message ?? 'Arquivo não aceito');
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    onDropRejected,
    accept: ACCEPTED_MIME_TYPES,
    maxFiles: 1,
    maxSize: MAX_UPLOAD_BYTES,
    disabled: !canUpload || isUploading || Boolean(dedupAlert),
    noClick: true,
    noKeyboard: true,
  });

  if (!canUpload) {
    return null;
  }

  return (
    <div className={cn('space-y-2 border-t p-4', className)} data-tour="source-upload">
      <div>
        <p className="text-sm font-semibold">Adicionar fonte</p>
        <p className="text-xs text-muted-foreground">
          Envie arquivos (até {MAX_UPLOAD_LABEL}) ou importe conteúdo público via URL (HTML,
          PDF, TXT, MD).
        </p>
      </div>

      <Tabs defaultValue="file" className="gap-3">
        <TabsList className="w-full">
          <TabsTrigger value="file" className="flex-1">
            <UploadCloud aria-hidden />
            Arquivo
          </TabsTrigger>
          <TabsTrigger value="url" className="flex-1">
            <Link2 aria-hidden />
            URL pública
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file" className="space-y-3">
          <div
            {...getRootProps()}
            className={cn(
              'rounded-lg border border-dashed p-4 text-center transition-colors',
              isDragActive && 'border-primary bg-primary/5',
              (isUploading || dedupAlert) && 'opacity-60',
            )}
          >
            <input {...getInputProps()} />
            <UploadCloud className="mx-auto mb-2 size-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Arraste um arquivo ou selecione do computador (até {MAX_UPLOAD_LABEL})
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={isUploading || Boolean(dedupAlert)}
              onClick={open}
            >
              {isUploading ? <Loader2 className="animate-spin" /> : <UploadCloud />}
              Enviar arquivo
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="url" className="space-y-3">
          <div className="space-y-3 rounded-lg border border-dashed p-4">
            <div className="space-y-1">
              <Label htmlFor="source-url">URL pública</Label>
              <Input
                id="source-url"
                type="url"
                inputMode="url"
                placeholder="https://www.gov.br/aneel/..."
                value={urlInput}
                disabled={isUploading || Boolean(dedupAlert)}
                onChange={(event) => setUrlInput(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Apenas endereços abertos, sem login. Timeout de 30s; redirecionamentos validados.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="source-url-titulo">Título (opcional)</Label>
              <Input
                id="source-url-titulo"
                value={urlTitulo}
                disabled={isUploading || Boolean(dedupAlert)}
                onChange={(event) => setUrlTitulo(event.target.value)}
                placeholder="Ex.: Edital de consulta pública"
              />
            </div>

            <Button
              type="button"
              size="sm"
              disabled={isUploading || Boolean(dedupAlert) || urlInput.trim().length === 0}
              onClick={handleSubmitUrl}
            >
              {isUploading ? <Loader2 className="animate-spin" /> : <Link2 />}
              Importar URL
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {ingestionProgress ? (
        <SourceIngestionProgress
          state={ingestionProgress}
          onRetry={retryFonteId ? retryIngestion : undefined}
          retryDisabled={isUploading}
        />
      ) : null}

      {dedupAlert ? (
        <div
          className={cn(
            'space-y-3 rounded-lg border p-3 text-xs',
            dedupAlert.kind === 'checksum'
              ? 'border-destructive/40 bg-destructive/5'
              : 'border-amber-500/40 bg-amber-500/5',
          )}
          role="alert"
        >
          <div className="flex items-start gap-2">
            {dedupAlert.kind === 'checksum' ? (
              <Copy className="mt-0.5 size-4 shrink-0 text-destructive" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            )}
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                {dedupAlert.kind === 'checksum'
                  ? 'Duplicata exata detectada'
                  : 'Sobreposição de conteúdo detectada'}
              </p>
              <p className="text-muted-foreground">{dedupAlert.message}</p>
              {pendingFile ? (
                <p className="text-muted-foreground">Arquivo: {pendingFile.name}</p>
              ) : pendingUrl ? (
                <p className="text-muted-foreground">URL: {pendingUrl.url}</p>
              ) : null}
            </div>
          </div>

          {dedupAlert.kind === 'checksum' && dedupAlert.duplicates?.length ? (
            <ul className="space-y-1 rounded-md border bg-background/80 p-2">
              {dedupAlert.duplicates.map((duplicate) => (
                <li key={duplicate.fonte_id} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{duplicate.titulo}</span>
                  {' · '}
                  checksum {duplicate.checksum.slice(0, 12)}…
                </li>
              ))}
            </ul>
          ) : null}

          {dedupAlert.kind === 'similar' && dedupAlert.matches?.length ? (
            <ul className="space-y-1 rounded-md border bg-background/80 p-2">
              {dedupAlert.matches.map((match) => (
                <li key={match.fonte_id} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{match.titulo}</span>
                  {' · '}
                  similaridade {formatSimilarity(match.similarity)}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleCancelDedup}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              variant={dedupAlert.kind === 'checksum' ? 'destructive' : 'default'}
              disabled={isUploading}
              onClick={handleConfirmDuplicate}
            >
              {isUploading ? (
                <Loader2 className="animate-spin" />
              ) : dedupAlert.kind === 'checksum' ? (
                'Enviar mesmo assim'
              ) : pendingUrl ? (
                'Continuar importação'
              ) : (
                'Continuar upload'
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {lastUpload ? (
        <p className="text-xs text-muted-foreground">Última fonte: {lastUpload}</p>
      ) : null}

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

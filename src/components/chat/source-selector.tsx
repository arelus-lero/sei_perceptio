'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FonteIngestionStatusBadge,
  FonteReembedButton,
} from '@/components/notebook/fonte-ingestion-status';
import { TagFilter } from '@/components/tags/tag-filter';
import { TagSelector } from '@/components/tags/tag-selector';
import { cn } from '@/lib/utils';
import type { NotebookFonte } from '@/types/chat';
import type { TagItem } from '@/types/tag';

interface SourceSelectorProps {
  fontes: NotebookFonte[];
  activeSourceIds: string[];
  onToggle: (sourceId: string, active: boolean) => void;
  highlightedSourceId?: string | null;
  orgTags: TagItem[];
  tagsLoading?: boolean;
  tagsError?: string | null;
  filterTagIds: string[];
  onToggleFilterTag: (tagId: string) => void;
  canAssignTags?: boolean;
  onLinkTag: (fonteId: string, tagId: string) => Promise<void>;
  onUnlinkTag: (fonteId: string, tagId: string) => Promise<void>;
  onCreateTag?: (nome: string) => Promise<TagItem>;
  canReembed?: boolean;
  onReembedStarted?: () => void;
  className?: string;
}

function fonteMatchesTagFilter(fonte: NotebookFonte, filterTagIds: string[]): boolean {
  if (filterTagIds.length === 0) {
    return true;
  }

  const fonteTagIds = new Set((fonte.tags ?? []).map((tag) => tag.id));
  return filterTagIds.some((tagId) => fonteTagIds.has(tagId));
}

export function SourceSelector({
  fontes,
  activeSourceIds,
  onToggle,
  highlightedSourceId,
  orgTags,
  tagsLoading = false,
  tagsError = null,
  filterTagIds,
  onToggleFilterTag,
  canAssignTags = false,
  onLinkTag,
  onUnlinkTag,
  onCreateTag,
  canReembed = false,
  onReembedStarted,
  className,
}: SourceSelectorProps) {
  const visibleFontes = fontes.filter((fonte) => fonteMatchesTagFilter(fonte, filterTagIds));

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="space-y-4 p-4">
        <div>
          <p className="font-heading text-sm font-semibold">Fontes ativas</p>
          <p className="text-xs text-muted-foreground">
            Selecione as fontes usadas na consulta RAG (RF-016).
          </p>
        </div>

        <TagFilter
          tags={orgTags}
          activeTagIds={filterTagIds}
          onToggle={onToggleFilterTag}
          loading={tagsLoading}
          error={tagsError}
          label="Filtrar fontes por tags"
        />

        {visibleFontes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {fontes.length === 0
              ? 'Nenhuma fonte disponível neste notebook.'
              : 'Nenhuma fonte corresponde às tags selecionadas.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {visibleFontes.map((fonte) => {
              const checked = activeSourceIds.includes(fonte.id);
              const highlighted = highlightedSourceId === fonte.id;

              return (
                <li
                  key={fonte.id}
                  id={`fonte-${fonte.id}`}
                  className={cn(
                    'flex flex-col gap-2 rounded-lg border p-3 transition-colors',
                    highlighted && 'border-primary bg-primary/5',
                    !fonte.ativa && 'opacity-60',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`source-${fonte.id}`}
                      checked={checked}
                      disabled={!fonte.ativa}
                      onChange={(event) => onToggle(fonte.id, event.target.checked)}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Label htmlFor={`source-${fonte.id}`} className="cursor-pointer">
                          {fonte.titulo}
                        </Label>
                        {fonte.ingestion_status ? (
                          <FonteIngestionStatusBadge status={fonte.ingestion_status} />
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{fonte.tipo_origem}</p>
                      {fonte.ingestion_status && canReembed ? (
                        <FonteReembedButton
                          fonteId={fonte.id}
                          status={fonte.ingestion_status}
                          onReembedStarted={onReembedStarted}
                        />
                      ) : null}
                    </div>
                  </div>

                  <TagSelector
                    availableTags={orgTags}
                    assignedTags={fonte.tags ?? []}
                    loading={tagsLoading}
                    canAssign={canAssignTags}
                    canCreate={canAssignTags}
                    disabled={!fonte.ativa}
                    onLink={(tagId) => onLinkTag(fonte.id, tagId)}
                    onUnlink={(tagId) => onUnlinkTag(fonte.id, tagId)}
                    onCreate={onCreateTag}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ScrollArea>
  );
}

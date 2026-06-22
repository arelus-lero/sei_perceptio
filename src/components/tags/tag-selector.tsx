'use client';

import { Loader2, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { TagBadge } from '@/components/tags/tag-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { TagItem } from '@/types/tag';

interface TagSelectorProps {
  availableTags: TagItem[];
  assignedTags: TagItem[];
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  canCreate?: boolean;
  canAssign?: boolean;
  onLink: (tagId: string) => Promise<void>;
  onUnlink: (tagId: string) => Promise<void>;
  onCreate?: (nome: string) => Promise<TagItem>;
  className?: string;
}

export function TagSelector({
  availableTags,
  assignedTags,
  loading = false,
  error = null,
  disabled = false,
  canCreate = false,
  canAssign = false,
  onLink,
  onUnlink,
  onCreate,
  className,
}: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const assignedIds = useMemo(
    () => new Set(assignedTags.map((tag) => tag.id)),
    [assignedTags],
  );

  const unassigned = useMemo(
    () =>
      availableTags.filter(
        (tag) =>
          !assignedIds.has(tag.id)
          && tag.nome.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [assignedIds, availableTags, query],
  );

  const trimmedQuery = query.trim();

  async function handleLink(tagId: string) {
    setBusy(true);
    setLocalError(null);
    try {
      await onLink(tagId);
      setOpen(false);
      setQuery('');
    } catch (linkError) {
      setLocalError(
        linkError instanceof Error ? linkError.message : 'Erro ao vincular tag',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (!onCreate || trimmedQuery.length === 0) {
      return;
    }

    setBusy(true);
    setLocalError(null);
    try {
      const created = await onCreate(trimmedQuery);
      await onLink(created.id);
      setOpen(false);
      setQuery('');
    } catch (createError) {
      setLocalError(
        createError instanceof Error ? createError.message : 'Erro ao criar tag',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink(tagId: string) {
    setBusy(true);
    setLocalError(null);
    try {
      await onUnlink(tagId);
    } catch (unlinkError) {
      setLocalError(
        unlinkError instanceof Error ? unlinkError.message : 'Erro ao desvincular tag',
      );
    } finally {
      setBusy(false);
    }
  }

  const displayError = localError ?? error;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-1.5">
        {assignedTags.map((tag) => (
          <TagBadge
            key={tag.id}
            tag={tag}
            onRemove={canAssign && !disabled ? () => void handleUnlink(tag.id) : undefined}
          />
        ))}
        {assignedTags.length === 0 && !loading ? (
          <span className="text-xs text-muted-foreground">Sem tags</span>
        ) : null}
        {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
      </div>

      {canAssign && !disabled ? (
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={busy}
            onClick={() => setOpen((current) => !current)}
          >
            <Plus className="size-3" />
            Atribuir tag
          </Button>

          {open ? (
            <div className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-border bg-popover p-2 shadow-md">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar ou criar tag…"
                className="mb-2"
                disabled={busy}
                autoFocus
              />
              <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                {unassigned.map((tag) => (
                  <li key={tag.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                      disabled={busy}
                      onClick={() => void handleLink(tag.id)}
                    >
                      <TagBadge tag={tag} />
                    </button>
                  </li>
                ))}
                {unassigned.length === 0 && !canCreate ? (
                  <li className="px-2 py-2 text-xs text-muted-foreground">
                    Nenhuma tag disponível.
                  </li>
                ) : null}
              </ul>
              {canCreate && trimmedQuery.length > 0
                && !availableTags.some(
                  (tag) => tag.nome.toLowerCase() === trimmedQuery.toLowerCase(),
                ) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full justify-start"
                    disabled={busy}
                    onClick={() => void handleCreate()}
                  >
                    Criar &quot;{trimmedQuery}&quot;
                  </Button>
                ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {displayError ? (
        <p className="text-xs text-destructive" role="alert">
          {displayError}
        </p>
      ) : null}
    </div>
  );
}

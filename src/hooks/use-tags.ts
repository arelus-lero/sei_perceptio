'use client';

import { useCallback, useEffect, useState } from 'react';

import type { TagItem } from '@/types/tag';

interface UseTagsState {
  tags: TagItem[];
  loading: boolean;
  error: string | null;
}

interface UseTagsActions {
  refresh: () => Promise<void>;
  createTag: (params: { nome: string; cor?: string }) => Promise<TagItem>;
  linkTag: (fonteId: string, tagId: string) => Promise<void>;
  unlinkTag: (fonteId: string, tagId: string) => Promise<void>;
}

export function useTags(): UseTagsState & UseTagsActions {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const response = await fetch('/api/tags');
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? 'Erro ao carregar tags');
    }
    const payload = (await response.json()) as { tags: TagItem[] };
    setTags(payload.tags);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        await refresh();
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : 'Erro ao carregar tags',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const createTag = useCallback(
    async (params: { nome: string; cor?: string }) => {
      setError(null);
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'Erro ao criar tag');
      }

      const payload = (await response.json()) as { tag: TagItem };
      setTags((current) =>
        [...current, payload.tag].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      );
      return payload.tag;
    },
    [],
  );

  const linkTag = useCallback(async (fonteId: string, tagId: string) => {
    setError(null);
    const response = await fetch(`/api/fontes/${fonteId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: tagId }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? 'Erro ao vincular tag');
    }
  }, []);

  const unlinkTag = useCallback(async (fonteId: string, tagId: string) => {
    setError(null);
    const response = await fetch(`/api/fontes/${fonteId}/tags`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: tagId }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? 'Erro ao desvincular tag');
    }
  }, []);

  return {
    tags,
    loading,
    error,
    refresh,
    createTag,
    linkTag,
    unlinkTag,
  };
}

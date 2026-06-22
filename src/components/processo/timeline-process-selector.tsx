'use client';

import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { truncateNupLabel } from '@/lib/processo/timeline-colors';
import { cn } from '@/lib/utils';
import { validarNup } from '@/lib/utils/nup';
import { MAX_TIMELINE_COMPARE } from '@/types/timeline';

interface TimelineProcessSelectorProps {
  primaryNup: string;
  selectedNups: string[];
  processColors: Record<string, string>;
  onAdd: (nup: string) => void;
  onRemove: (nup: string) => void;
  className?: string;
}

export function TimelineProcessSelector({
  primaryNup,
  selectedNups,
  processColors,
  onAdd,
  onRemove,
  className,
}: TimelineProcessSelectorProps) {
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const allNups = [primaryNup, ...selectedNups.filter((value) => value !== primaryNup)];
  const canAddMore = allNups.length < MAX_TIMELINE_COMPARE;

  function handleAdd() {
    const trimmed = input.trim();

    if (!trimmed) {
      setInputError('Informe um NUP.');
      return;
    }

    if (!validarNup(trimmed)) {
      setInputError('NUP inválido. Use o formato 48500.NNNNNN/AAAA-NN.');
      return;
    }

    if (allNups.includes(trimmed)) {
      setInputError('Este processo já está selecionado.');
      return;
    }

    if (!canAddMore) {
      setInputError(`Máximo de ${MAX_TIMELINE_COMPARE} processos na comparação.`);
      return;
    }

    setInputError(null);
    setInput('');
    onAdd(trimmed);
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap gap-2">
        {allNups.map((nup) => {
          const isPrimary = nup === primaryNup;

          return (
            <Badge
              key={nup}
              variant="outline"
              className="gap-1.5 py-1 pl-2 font-mono text-xs"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: processColors[nup] ?? 'var(--muted-foreground)' }}
                aria-hidden
              />
              <span title={nup}>{truncateNupLabel(nup, 26)}</span>
              {isPrimary ? (
                <span className="text-[10px] text-muted-foreground">(atual)</span>
              ) : (
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Remover ${nup} da comparação`}
                  onClick={() => onRemove(nup)}
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          );
        })}
      </div>

      {canAddMore ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[240px] flex-1 space-y-1">
            <Label htmlFor="timeline-compare-nup">Adicionar processo</Label>
            <Input
              id="timeline-compare-nup"
              value={input}
              placeholder="48500.000001/2025-01"
              className="font-mono text-sm"
              onChange={(event) => {
                setInput(event.target.value);
                setInputError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAdd();
                }
              }}
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
            <Plus className="size-4" aria-hidden />
            Adicionar
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Limite de {MAX_TIMELINE_COMPARE} processos atingido.
        </p>
      )}

      {inputError ? (
        <p className="text-xs text-destructive" role="alert">
          {inputError}
        </p>
      ) : null}
    </div>
  );
}

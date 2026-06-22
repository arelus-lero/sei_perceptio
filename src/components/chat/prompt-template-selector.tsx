'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  buildPromptFromTemplate,
  listPromptTemplates,
  type PromptTemplateId,
} from '@/lib/prompts/templates';
import { cn } from '@/lib/utils';

interface PromptTemplateSelectorProps {
  disabled?: boolean;
  onSelect: (payload: { templateId: PromptTemplateId; prompt: string }) => void;
}

export function PromptTemplateSelector({
  disabled = false,
  onSelect,
}: PromptTemplateSelectorProps) {
  const templates = useMemo(() => listPromptTemplates(), []);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<PromptTemplateId | null>(null);

  const selected = selectedId
    ? templates.find((template) => template.id === selectedId)
    : null;

  function handleSelect(templateId: PromptTemplateId) {
    const prompt = buildPromptFromTemplate(templateId);
    setSelectedId(templateId);
    setOpen(false);
    onSelect({ templateId, prompt });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected ? selected.label : 'Template de análise (RF-018)'}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="p-0">
        <Command
          key={open ? 'template-command-open' : 'template-command-closed'}
          filter={(value, search) => {
            const normalized = search.trim().toLowerCase();
            if (!normalized) {
              return 1;
            }
            return value.toLowerCase().includes(normalized) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar template…" aria-label="Buscar template" />
          <CommandList>
            <CommandEmpty>Nenhum template encontrado.</CommandEmpty>
            <CommandGroup>
              {templates.map((template) => {
                const isSelected = template.id === selectedId;
                const searchValue = `${template.label} ${template.description}`;

                return (
                  <CommandItem
                    key={template.id}
                    value={searchValue}
                    onSelect={() => handleSelect(template.id)}
                  >
                    <Check
                      className={cn(
                        'mt-0.5 size-4 shrink-0',
                        isSelected ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{template.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {template.description}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

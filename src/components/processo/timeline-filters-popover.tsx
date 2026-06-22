'use client';

import { CalendarRange, Filter, Landmark } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type { TimelineFilters, TimelinePeriodoPreset } from '@/types/timeline';

const PERIOD_OPTIONS: { value: TimelinePeriodoPreset; label: string }[] = [
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: '180d', label: '6 meses' },
  { value: '365d', label: '1 ano' },
  { value: 'tudo', label: 'Tudo' },
];

export function countActiveTimelineFilters(filters: TimelineFilters): number {
  let count = 0;

  if (filters.periodo !== 'tudo') {
    count += 1;
  }

  if (filters.unidade) {
    count += 1;
  }

  if (filters.apenasMarcos) {
    count += 1;
  }

  return count;
}

export function getTimelinePeriodLabel(periodo: TimelinePeriodoPreset): string {
  return PERIOD_OPTIONS.find((option) => option.value === periodo)?.label ?? periodo;
}

interface TimelineFiltersFieldsProps {
  filters: TimelineFilters;
  unidades: string[];
  onChange: (filters: TimelineFilters) => void;
}

function TimelineFiltersFields({
  filters,
  unidades,
  onChange,
}: TimelineFiltersFieldsProps) {
  return (
    <div className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="timeline-periodo" className="flex items-center gap-1.5">
          <CalendarRange className="size-3.5" aria-hidden />
          Período
        </Label>
        <Select
          value={filters.periodo}
          onValueChange={(value) =>
            onChange({
              ...filters,
              periodo: value as TimelinePeriodoPreset,
            })
          }
        >
          <SelectTrigger id="timeline-periodo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="timeline-unidade">Unidade</Label>
        <Select
          value={filters.unidade ?? 'all'}
          onValueChange={(value) =>
            onChange({
              ...filters,
              unidade: value === 'all' ? null : value,
            })
          }
        >
          <SelectTrigger id="timeline-unidade">
            <SelectValue placeholder="Todas as unidades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as unidades</SelectItem>
            {unidades.map((unidade) => (
              <SelectItem key={unidade} value={unidade}>
                {unidade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="timeline-marcos"
          checked={filters.apenasMarcos}
          onChange={(event) =>
            onChange({
              ...filters,
              apenasMarcos: event.target.checked,
            })
          }
        />
        <Label htmlFor="timeline-marcos" className="flex items-center gap-1.5">
          <Landmark className="size-3.5" aria-hidden />
          Apenas marcos
        </Label>
      </div>
    </div>
  );
}

interface TimelineFiltersPopoverProps {
  filters: TimelineFilters;
  unidades: string[];
  onChange: (filters: TimelineFilters) => void;
  className?: string;
}

export function TimelineFiltersPopover({
  filters,
  unidades,
  onChange,
  className,
}: TimelineFiltersPopoverProps) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = countActiveTimelineFilters(filters);

  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('gap-1.5', className)}
      aria-label={
        activeCount > 0
          ? `Filtros (${activeCount} ativo${activeCount > 1 ? 's' : ''})`
          : 'Filtros'
      }
      onClick={isMobile ? () => setSheetOpen(true) : undefined}
    >
      <Filter className="size-4" aria-hidden />
      Filtros
      {activeCount > 0 ? (
        <Badge variant="secondary" className="min-w-5 px-1.5 py-0 text-[0.65rem]">
          {activeCount}
        </Badge>
      ) : null}
    </Button>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-xl">
            <SheetHeader>
              <SheetTitle>Filtros da linha do tempo</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">
              <TimelineFiltersFields
                filters={filters}
                unidades={unidades}
                onChange={onChange}
              />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4">
        <p className="mb-3 text-sm font-medium">Filtros da linha do tempo</p>
        <TimelineFiltersFields
          filters={filters}
          unidades={unidades}
          onChange={onChange}
        />
      </PopoverContent>
    </Popover>
  );
}

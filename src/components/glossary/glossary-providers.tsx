'use client';

import type { ReactNode } from 'react';

import { TooltipProvider } from '@/components/ui/tooltip';

interface GlossaryProvidersProps {
  children: ReactNode;
}

export function GlossaryProviders({ children }: GlossaryProvidersProps) {
  return <TooltipProvider delayDuration={300}>{children}</TooltipProvider>;
}

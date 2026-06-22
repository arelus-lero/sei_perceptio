'use client';

import type { ReactNode } from 'react';

import { useInactivityTimeout } from '@/hooks/use-inactivity-timeout';

interface InactivityTimeoutGuardProps {
  children: ReactNode;
}

export function InactivityTimeoutGuard({ children }: InactivityTimeoutGuardProps) {
  useInactivityTimeout();

  return children;
}

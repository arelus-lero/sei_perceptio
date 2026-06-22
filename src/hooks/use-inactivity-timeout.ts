'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';

import { createBrowserClient } from '@/lib/supabase/client';

/** Tempo total sem interação antes do signOut (RNF-010). */
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

/** Aviso exibido este tempo antes do signOut por inatividade. */
export const INACTIVITY_WARNING_LEAD_MS = 2 * 60 * 1000;

const WARNING_TOAST_ID = 'inactivity-warning';
const ACTIVITY_THROTTLE_MS = 1000;

interface UseInactivityTimeoutOptions {
  enabled?: boolean;
}

export function useInactivityTimeout(
  options: UseInactivityTimeoutOptions = {},
): void {
  const { enabled = true } = options;
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningShownRef = useRef(false);
  const lastResetRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  const performSignOut = useCallback(async () => {
    toast.dismiss(WARNING_TOAST_ID);
    await supabase.auth.signOut();
    router.push('/login?reason=inactive');
    router.refresh();
  }, [router, supabase]);

  const showWarning = useCallback(() => {
    if (warningShownRef.current) {
      return;
    }

    warningShownRef.current = true;
    toast.warning(
      'Sua sessão expira em 2 minutos por inatividade. Mova o mouse, clique ou pressione uma tecla para continuar.',
      {
        id: WARNING_TOAST_ID,
        duration: INACTIVITY_WARNING_LEAD_MS,
      },
    );

    logoutTimerRef.current = setTimeout(() => {
      void performSignOut();
    }, INACTIVITY_WARNING_LEAD_MS);
  }, [performSignOut]);

  const scheduleTimers = useCallback(() => {
    clearTimers();
    warningShownRef.current = false;
    toast.dismiss(WARNING_TOAST_ID);

    const warningDelay = INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_LEAD_MS;
    warningTimerRef.current = setTimeout(showWarning, warningDelay);
  }, [clearTimers, showWarning]);

  const resetActivity = useCallback(() => {
    scheduleTimers();
  }, [scheduleTimers]);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastResetRef.current < ACTIVITY_THROTTLE_MS) {
      return;
    }

    lastResetRef.current = now;
    resetActivity();
  }, [resetActivity]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    scheduleTimers();

    const events = ['mousemove', 'keydown', 'click'] as const;
    for (const event of events) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    return () => {
      clearTimers();
      for (const event of events) {
        window.removeEventListener(event, handleActivity);
      }
      toast.dismiss(WARNING_TOAST_ID);
    };
  }, [clearTimers, enabled, handleActivity, scheduleTimers]);
}

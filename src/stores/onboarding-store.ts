import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface OnboardingStore {
  isActive: boolean;
  stepIndex: number;
  notebookId: string | null;
  hasUserInteracted: boolean;
  autoStartSuppressed: boolean;
  startTour: () => void;
  stopTour: () => void;
  setStepIndex: (index: number) => void;
  nextStep: (maxIndex: number) => void;
  prevStep: () => void;
  setNotebookId: (notebookId: string | null) => void;
  recordUserInteraction: () => void;
  suppressAutoStart: () => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      isActive: false,
      stepIndex: 0,
      notebookId: null,
      hasUserInteracted: false,
      autoStartSuppressed: false,
      startTour: () =>
        set({
          isActive: true,
          stepIndex: 0,
          autoStartSuppressed: true,
        }),
      stopTour: () => set({ isActive: false, stepIndex: 0 }),
      setStepIndex: (index) => set({ stepIndex: index }),
      nextStep: (maxIndex) => {
        const next = Math.min(get().stepIndex + 1, maxIndex);
        set({ stepIndex: next });
      },
      prevStep: () => {
        const prev = Math.max(get().stepIndex - 1, 0);
        set({ stepIndex: prev });
      },
      setNotebookId: (notebookId) => set({ notebookId }),
      recordUserInteraction: () =>
        set({
          hasUserInteracted: true,
          autoStartSuppressed: true,
        }),
      suppressAutoStart: () => set({ autoStartSuppressed: true }),
    }),
    {
      name: 'sei-perceptio-onboarding',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        isActive: state.isActive,
        stepIndex: state.stepIndex,
        notebookId: state.notebookId,
        hasUserInteracted: state.hasUserInteracted,
        autoStartSuppressed: state.autoStartSuppressed,
      }),
    },
  ),
);

async function completeOnboardingRequest(): Promise<void> {
  const response = await fetch('/api/perfil/onboarding', { method: 'POST' });

  if (!response.ok) {
    throw new Error('Falha ao salvar conclusão do onboarding');
  }
}

export async function markOnboardingComplete(): Promise<void> {
  await completeOnboardingRequest();
  useOnboardingStore.getState().stopTour();
}

export async function skipOnboarding(): Promise<void> {
  await markOnboardingComplete();
}

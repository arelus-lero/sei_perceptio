'use client';

import { CitationCard } from '@/components/chat/citation-card';
import type { ChatCitation } from '@/types/chat';

const DEMO_CITATION: ChatCitation = {
  chunk_id: 'onboarding-demo-chunk',
  source_id: 'onboarding-demo-source',
  numero_sei: '48500.123456/2025-01',
  tipo: 'Despacho',
  unidade: 'STD',
  trecho:
    '"... conforme análise técnica apresentada nos autos, recomenda-se a aprovação do pleito, observados os prazos regulamentares ..."',
  score: 0.87,
};

export function OnboardingCitationDemo() {
  return (
    <div className="mt-3 space-y-2" data-tour="citations-demo">
      <p className="text-xs text-muted-foreground">Exemplo de citação:</p>
      <CitationCard citation={DEMO_CITATION} className="pointer-events-none opacity-95" />
    </div>
  );
}

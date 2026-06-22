import { Inngest } from 'inngest';

type InngestEventMap = {
  'ingestion/process.requested': {
    data: {
      fonteId: string;
      orgaoId: string;
      userRole: 'admin' | 'analista' | 'consultor' | null;
      sigiloExceptionJustificativa?: string;
      confirmChecksumDuplicate?: boolean;
      confirmSimilarContent?: boolean;
    };
  };
  'ingestion/embed.requested': {
    data: {
      fonteId: string;
      orgaoId: string;
    };
  };
  'monitoring/check.requested': {
    data: {
      jobId: string;
      orgaoId: string;
      userId: string;
      processoId?: string;
      nup?: string;
    };
  };
  'retention/apply.manual': {
    data: {
      jobId?: string;
      orgaoId?: string;
      userId?: string;
      dryRun?: boolean;
      triggeredBy?: string;
    };
  };
};

export const inngest = new Inngest({
  id: 'sei-perceptio',
});

export type InngestEvents = InngestEventMap;

import { serve } from 'inngest/next';

import { inngestFunctions } from '../../../../inngest/functions/index';
import { inngest } from '@/lib/inngest/client';

export const runtime = 'nodejs';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});

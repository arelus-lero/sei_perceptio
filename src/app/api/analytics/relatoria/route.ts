import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { getRelatoriaAnalytics } from '@/lib/db/queries/analytics-relatoria';

const QuerySchema = z.object({
  relator_id: z.string().uuid().optional(),
  sessao_distribuicao: z.string().min(1).optional(),
  resultado_deliberativo: z.string().min(1).optional(),
  q: z.string().min(1).max(200).optional(),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    const validated = QuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const data = await getRelatoriaAnalytics(auth.supabase, auth.orgaoId, validated);

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    console.error('GET /api/analytics/relatoria error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getDashboardProcessosPage } from '@/lib/db/queries/dashboard';
import { createServerClient } from '@/lib/supabase/server';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  cursor_updated_at: z.string().datetime({ offset: true }).optional(),
  cursor_id: z.uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgaoId = request.headers.get('x-orgao-id');
    if (!orgaoId) {
      return NextResponse.json({ error: 'Missing orgao context' }, { status: 400 });
    }

    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = QuerySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { limit, offset, cursor_updated_at, cursor_id } = parsed.data;

    if ((cursor_updated_at && !cursor_id) || (!cursor_updated_at && cursor_id)) {
      return NextResponse.json(
        { error: 'cursor_updated_at e cursor_id devem ser informados juntos' },
        { status: 400 },
      );
    }

    const page = await getDashboardProcessosPage(supabase, orgaoId, {
      limit,
      offset,
      cursorUpdatedAt: cursor_updated_at,
      cursorId: cursor_id,
    });

    return NextResponse.json({ data: page }, { status: 200 });
  } catch (error) {
    console.error('GET /api/dashboard/processos:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

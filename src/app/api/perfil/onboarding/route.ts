import { NextRequest, NextResponse } from 'next/server';

import {
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';

export async function GET(request: NextRequest) {
  const auth = await getApiAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { data, error } = await auth.supabase
    .from('perfil')
    .select('onboarding_concluido')
    .eq('user_id', auth.user.id)
    .eq('orgao_id', auth.orgaoId)
    .maybeSingle();

  if (error) {
    console.error('GET /api/perfil/onboarding error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  return NextResponse.json(
    {
      data: {
        onboarding_concluido: data?.onboarding_concluido === true,
      },
    },
    { status: 200 },
  );
}

export async function POST(request: NextRequest) {
  const auth = await getApiAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { error } = await auth.supabase.rpc('complete_user_onboarding');

  if (error) {
    console.error('POST /api/perfil/onboarding error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  return NextResponse.json(
    {
      data: {
        onboarding_concluido: true,
      },
    },
    { status: 200 },
  );
}

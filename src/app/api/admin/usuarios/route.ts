import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  requireApiAuth,
  requireRole,
} from '@/lib/auth/api-context';
import { provisionAuthUser } from '@/lib/auth/provision-user';
import { USER_ROLES } from '@/lib/auth/constants';
import { createAdminClient } from '@/lib/supabase/admin-client';
import type { AdminUsuarioListItem } from '@/types/governance';

const CreateUsuarioSchema = z.object({
  email: z.string().email(),
  role: z.enum(USER_ROLES),
  nome_completo: z.string().min(2).max(200),
  password: z.string().min(8).max(128).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const roleError = requireRole(auth, ['admin'], 'Somente administradores podem listar usuários');
    if (roleError) {
      return roleError;
    }

    const { data: perfis, error } = await auth.supabase
      .from('perfil')
      .select('user_id, role, nome_completo, sigla_unidade, created_at')
      .eq('orgao_id', auth.orgaoId)
      .order('nome_completo', { ascending: true });

    if (error) {
      console.error('GET /api/admin/usuarios error:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    const admin = createAdminClient();

    const usuarios: AdminUsuarioListItem[] = await Promise.all(
      (perfis ?? []).map(async (perfil) => {
        const { data: userData } = await admin.auth.admin.getUserById(perfil.user_id);

        return {
          user_id: perfil.user_id,
          email: userData.user?.email ?? null,
          role: perfil.role,
          nome_completo: perfil.nome_completo,
          sigla_unidade: perfil.sigla_unidade,
          created_at: perfil.created_at,
        };
      }),
    );

    return NextResponse.json({ data: usuarios }, { status: 200 });
  } catch (error) {
    console.error('GET /api/admin/usuarios unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const roleError = requireRole(auth, ['admin'], 'Somente administradores podem provisionar usuários');
    if (roleError) {
      return roleError;
    }

    const body = await request.json();
    const validated = CreateUsuarioSchema.parse(body);

    const { userId } = await provisionAuthUser({
      email: validated.email,
      orgaoId: auth.orgaoId,
      role: validated.role,
      nomeCompleto: validated.nome_completo,
      password: validated.password,
    });

    return NextResponse.json(
      {
        data: {
          user_id: userId,
          email: validated.email,
          role: validated.role,
          nome_completo: validated.nome_completo,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('POST /api/admin/usuarios unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

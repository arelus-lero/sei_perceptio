import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  requireApiAuth,
  requireRole,
} from '@/lib/auth/api-context';
import { USER_ROLES } from '@/lib/auth/constants';
import { updateAuthUserRole } from '@/lib/auth/provision-user';

const UpdateUsuarioSchema = z.object({
  role: z.enum(USER_ROLES),
  nome_completo: z.string().min(2).max(200).optional(),
});

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const roleError = requireRole(
      auth,
      ['admin'],
      'Somente administradores podem alterar perfis',
    );
    if (roleError) {
      return roleError;
    }

    const { userId } = await context.params;
    const body = await request.json();
    const validated = UpdateUsuarioSchema.parse(body);

    if (userId === auth.user.id && validated.role !== 'admin') {
      return NextResponse.json(
        { error: 'Não é permitido remover o próprio perfil de administrador' },
        { status: 400 },
      );
    }

    await updateAuthUserRole({
      userId,
      orgaoId: auth.orgaoId,
      role: validated.role,
      nomeCompleto: validated.nome_completo,
    });

    return NextResponse.json(
      {
        data: {
          user_id: userId,
          role: validated.role,
          nome_completo: validated.nome_completo,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('PATCH /api/admin/usuarios/[userId] unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

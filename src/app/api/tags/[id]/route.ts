import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { isAdmin } from '@/lib/auth/rbac';
import { mapTagRow, normalizeTagColor } from '@/lib/tags/helpers';

const UpdateTagSchema = z
  .object({
    nome: z.string().trim().min(1).max(80).optional(),
    cor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser hexadecimal (#RRGGBB)')
      .optional(),
  })
  .refine((value) => value.nome !== undefined || value.cor !== undefined, {
    message: 'Informe nome ou cor para atualizar',
  });

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    if (!isAdmin(auth.role)) {
      return forbiddenResponse('Somente administradores podem editar tags');
    }

    const { id: tagId } = await context.params;
    if (!z.uuid().safeParse(tagId).success) {
      return NextResponse.json({ error: 'ID de tag inválido' }, { status: 400 });
    }

    const body = await request.json();
    const validated = UpdateTagSchema.parse(body);

    const payload: Record<string, string> = {};
    if (validated.nome !== undefined) {
      payload.nome = validated.nome;
    }
    if (validated.cor !== undefined) {
      payload.cor = normalizeTagColor(validated.cor);
    }

    const { data, error } = await auth.supabase
      .from('tag')
      .update(payload)
      .eq('id', tagId)
      .eq('orgao_id', auth.orgaoId)
      .select('id, nome, cor, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Já existe uma tag com este nome no órgão' },
          { status: 409 },
        );
      }
      console.error('PATCH /api/tags/[id] error:', error);
      return NextResponse.json({ error: 'Erro ao atualizar tag' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Tag não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ tag: mapTagRow(data) }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('PATCH /api/tags/[id] unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await getApiAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (!isAdmin(auth.role)) {
    return forbiddenResponse('Somente administradores podem excluir tags');
  }

  const { id: tagId } = await context.params;
  if (!z.uuid().safeParse(tagId).success) {
    return NextResponse.json({ error: 'ID de tag inválido' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('tag')
    .delete()
    .eq('id', tagId)
    .eq('orgao_id', auth.orgaoId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('DELETE /api/tags/[id] error:', error);
    return NextResponse.json({ error: 'Erro ao excluir tag' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Tag não encontrada' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true }, { status: 200 });
}

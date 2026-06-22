import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { isAnalistaOrAdmin } from '@/lib/auth/rbac';
import { assertFonteAccess, mapTagRow } from '@/lib/tags/helpers';
import type { TagItem } from '@/types/tag';

const LinkTagSchema = z.object({
  tag_id: z.uuid(),
});

const UnlinkTagSchema = z.object({
  tag_id: z.uuid(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await getApiAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { id: fonteId } = await context.params;
  if (!z.uuid().safeParse(fonteId).success) {
    return NextResponse.json({ error: 'ID de fonte inválido' }, { status: 400 });
  }

  const access = await assertFonteAccess({
    supabase: auth.supabase,
    fonteId,
    orgaoId: auth.orgaoId,
    userId: auth.user.id,
    userRole: auth.role,
    require: 'read',
  });

  if (!access) {
    return NextResponse.json({ error: 'Fonte não encontrada' }, { status: 404 });
  }

  const { data, error } = await auth.supabase
    .from('fonte_tag')
    .select('tag:tag_id ( id, nome, cor, created_at )')
    .eq('fonte_id', fonteId);

  if (error) {
    console.error('GET /api/fontes/[id]/tags error:', error);
    return NextResponse.json({ error: 'Erro ao listar tags da fonte' }, { status: 500 });
  }

  type FonteTagRow = {
    id: string;
    nome: string;
    cor: string;
    created_at: string;
  };

  const tags: TagItem[] = (data ?? [])
    .map((row) => row.tag as unknown as FonteTagRow | null)
    .filter((tag): tag is FonteTagRow => Boolean(tag))
    .map((tag) => mapTagRow(tag));

  return NextResponse.json({ tags }, { status: 200 });
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    if (!isAnalistaOrAdmin(auth.role)) {
      return forbiddenResponse('Consultores não podem vincular tags');
    }

    const { id: fonteId } = await context.params;
    if (!z.uuid().safeParse(fonteId).success) {
      return NextResponse.json({ error: 'ID de fonte inválido' }, { status: 400 });
    }

    const access = await assertFonteAccess({
      supabase: auth.supabase,
      fonteId,
      orgaoId: auth.orgaoId,
      userId: auth.user.id,
      userRole: auth.role,
      require: 'edit',
    });

    if (!access) {
      return NextResponse.json(
        { error: 'Sem permissão para editar tags desta fonte' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const validated = LinkTagSchema.parse(body);

    const { data: tag, error: tagError } = await auth.supabase
      .from('tag')
      .select('id')
      .eq('id', validated.tag_id)
      .eq('orgao_id', auth.orgaoId)
      .maybeSingle();

    if (tagError || !tag) {
      return NextResponse.json({ error: 'Tag não encontrada no órgão' }, { status: 404 });
    }

    const { error: linkError } = await auth.supabase.from('fonte_tag').insert({
      fonte_id: fonteId,
      tag_id: validated.tag_id,
    });

    if (linkError) {
      if (linkError.code === '23505') {
        return NextResponse.json(
          { error: 'Tag já vinculada a esta fonte' },
          { status: 409 },
        );
      }
      console.error('POST /api/fontes/[id]/tags error:', linkError);
      return NextResponse.json({ error: 'Erro ao vincular tag' }, { status: 500 });
    }

    const { data: linkedTag, error: fetchError } = await auth.supabase
      .from('tag')
      .select('id, nome, cor, created_at')
      .eq('id', validated.tag_id)
      .single();

    if (fetchError || !linkedTag) {
      return NextResponse.json({ linked: true }, { status: 201 });
    }

    return NextResponse.json({ tag: mapTagRow(linkedTag) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('POST /api/fontes/[id]/tags unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    if (!isAnalistaOrAdmin(auth.role)) {
      return forbiddenResponse('Consultores não podem desvincular tags');
    }

    const { id: fonteId } = await context.params;
    if (!z.uuid().safeParse(fonteId).success) {
      return NextResponse.json({ error: 'ID de fonte inválido' }, { status: 400 });
    }

    const access = await assertFonteAccess({
      supabase: auth.supabase,
      fonteId,
      orgaoId: auth.orgaoId,
      userId: auth.user.id,
      userRole: auth.role,
      require: 'edit',
    });

    if (!access) {
      return NextResponse.json(
        { error: 'Sem permissão para editar tags desta fonte' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const validated = UnlinkTagSchema.parse(body);

    const { data, error } = await auth.supabase
      .from('fonte_tag')
      .delete()
      .eq('fonte_id', fonteId)
      .eq('tag_id', validated.tag_id)
      .select('fonte_id')
      .maybeSingle();

    if (error) {
      console.error('DELETE /api/fontes/[id]/tags error:', error);
      return NextResponse.json({ error: 'Erro ao desvincular tag' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Vínculo não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ unlinked: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('DELETE /api/fontes/[id]/tags unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

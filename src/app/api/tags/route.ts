import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { isAnalistaOrAdmin } from '@/lib/auth/rbac';
import { mapTagRow, normalizeTagColor } from '@/lib/tags/helpers';
import type { TagItem } from '@/types/tag';

const CreateTagSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  cor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser hexadecimal (#RRGGBB)')
    .optional(),
});

export async function GET(request: NextRequest) {
  const auth = await getApiAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { data, error } = await auth.supabase
    .from('tag')
    .select('id, nome, cor, created_at')
    .eq('orgao_id', auth.orgaoId)
    .order('nome', { ascending: true });

  if (error) {
    console.error('GET /api/tags error:', error);
    return NextResponse.json({ error: 'Erro ao listar tags' }, { status: 500 });
  }

  const tags: TagItem[] = (data ?? []).map(mapTagRow);
  return NextResponse.json({ tags }, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    if (!isAnalistaOrAdmin(auth.role)) {
      return forbiddenResponse('Consultores não podem criar tags');
    }

    const body = await request.json();
    const validated = CreateTagSchema.parse(body);

    const { data, error } = await auth.supabase
      .from('tag')
      .insert({
        nome: validated.nome,
        cor: normalizeTagColor(validated.cor),
        orgao_id: auth.orgaoId,
      })
      .select('id, nome, cor, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Já existe uma tag com este nome no órgão' },
          { status: 409 },
        );
      }
      console.error('POST /api/tags error:', error);
      return NextResponse.json({ error: 'Erro ao criar tag' }, { status: 500 });
    }

    return NextResponse.json({ tag: mapTagRow(data) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('POST /api/tags unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

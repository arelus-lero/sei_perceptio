import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { logAuditSafe } from '@/lib/governance/audit-log';
import { assertNotebookAccess } from '@/lib/notebook/access';
import {
  scanNotebookSigilo,
  validateSigiloShareConfirmation,
} from '@/lib/notebook/sigilo-notebook';
import { createAdminClient } from '@/lib/supabase/admin-client';
import type {
  NotebookShareItem,
  NotebookShareListResponse,
  OrgaoMembroItem,
} from '@/types/notebook-share';

const ShareSchema = z.object({
  usuario_destino_id: z.uuid(),
  permissao: z.enum(['leitura', 'comentario', 'edicao']),
  sigilo_confirmacao: z.string().min(15).max(500).optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    const { id: notebookId } = await context.params;

    const access = await assertNotebookAccess({
      supabase: auth.supabase,
      notebookId,
      orgaoId: auth.orgaoId,
      userId: auth.user.id,
      userRole: auth.role,
      require: 'share',
    });

    if (!access) {
      return forbiddenResponse('Somente o criador ou administrador pode gerenciar compartilhamentos');
    }

    const sigilo = await scanNotebookSigilo(auth.supabase, notebookId, auth.orgaoId);

    const { data: shares, error: sharesError } = await auth.supabase
      .from('compartilhamento')
      .select(
        'id, usuario_destino_id, permissao, compartilhado_por_id, data_compartilhamento',
      )
      .eq('notebook_id', notebookId)
      .eq('orgao_id', auth.orgaoId)
      .order('data_compartilhamento', { ascending: false });

    if (sharesError) {
      console.error('GET /api/notebooks/[id]/share error:', sharesError);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    const { data: perfis, error: perfisError } = await auth.supabase
      .from('perfil')
      .select('user_id, nome_completo, role')
      .eq('orgao_id', auth.orgaoId)
      .order('nome_completo', { ascending: true });

    if (perfisError) {
      console.error('GET /api/notebooks/[id]/share perfis error:', perfisError);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    const admin = createAdminClient();
    const nomeByUserId = new Map(
      (perfis ?? []).map((perfil) => [perfil.user_id, perfil.nome_completo]),
    );

    const compartilhamentos: NotebookShareItem[] = await Promise.all(
      (shares ?? []).map(async (share) => {
        const { data: userData } = await admin.auth.admin.getUserById(share.usuario_destino_id);

        return {
          id: share.id,
          usuario_destino_id: share.usuario_destino_id,
          usuario_nome: nomeByUserId.get(share.usuario_destino_id) ?? 'Usuário',
          usuario_email: userData.user?.email ?? null,
          permissao: share.permissao,
          compartilhado_por_id: share.compartilhado_por_id,
          data_compartilhamento: share.data_compartilhamento,
        };
      }),
    );

    const membros: OrgaoMembroItem[] = await Promise.all(
      (perfis ?? [])
        .filter((perfil) => perfil.user_id !== auth.user.id)
        .map(async (perfil) => {
          const { data: userData } = await admin.auth.admin.getUserById(perfil.user_id);

          return {
            user_id: perfil.user_id,
            nome_completo: perfil.nome_completo,
            email: userData.user?.email ?? null,
            role: perfil.role,
          };
        }),
    );

    const response: NotebookShareListResponse = {
      compartilhamentos,
      membros_orgao: membros,
      sigilo,
    };

    return NextResponse.json({ data: response }, { status: 200 });
  } catch (error) {
    console.error('GET /api/notebooks/[id]/share unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    const { id: notebookId } = await context.params;

    const access = await assertNotebookAccess({
      supabase: auth.supabase,
      notebookId,
      orgaoId: auth.orgaoId,
      userId: auth.user.id,
      userRole: auth.role,
      require: 'share',
    });

    if (!access) {
      return forbiddenResponse('Somente o criador ou administrador pode compartilhar');
    }

    const body = await request.json();
    const validated = ShareSchema.parse(body);

    if (validated.usuario_destino_id === auth.user.id) {
      return NextResponse.json(
        { error: 'Não é possível compartilhar consigo mesmo' },
        { status: 400 },
      );
    }

    const { data: destino, error: destinoError } = await auth.supabase
      .from('perfil')
      .select('user_id')
      .eq('user_id', validated.usuario_destino_id)
      .eq('orgao_id', auth.orgaoId)
      .maybeSingle();

    if (destinoError || !destino) {
      return NextResponse.json(
        { error: 'Usuário destino não pertence a este órgão' },
        { status: 400 },
      );
    }

    const sigilo = await scanNotebookSigilo(auth.supabase, notebookId, auth.orgaoId);
    const sigiloValidation = validateSigiloShareConfirmation(
      sigilo,
      auth.role,
      validated.sigilo_confirmacao,
    );

    if (!sigiloValidation.allowed) {
      return NextResponse.json({ error: sigiloValidation.message }, { status: 403 });
    }

    const { data: share, error } = await auth.supabase
      .from('compartilhamento')
      .upsert(
        {
          notebook_id: notebookId,
          usuario_destino_id: validated.usuario_destino_id,
          permissao: validated.permissao,
          compartilhado_por_id: auth.user.id,
          orgao_id: auth.orgaoId,
          data_compartilhamento: new Date().toISOString(),
        },
        { onConflict: 'notebook_id,usuario_destino_id' },
      )
      .select(
        'id, usuario_destino_id, permissao, compartilhado_por_id, data_compartilhamento',
      )
      .single();

    if (error || !share) {
      console.error('POST /api/notebooks/[id]/share error:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    await logAuditSafe({
      supabase: auth.supabase,
      orgaoId: auth.orgaoId,
      usuarioId: auth.user.id,
      acao: 'compartilhamento',
      entidadeTipo: 'notebook',
      entidadeId: notebookId,
      detalhes: {
        operacao: 'compartilhar',
        usuario_destino_id: validated.usuario_destino_id,
        permissao: validated.permissao,
        contem_sigiloso: sigilo.contem_sigiloso,
      },
      request,
    });

    return NextResponse.json({ data: share }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    console.error('POST /api/notebooks/[id]/share unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

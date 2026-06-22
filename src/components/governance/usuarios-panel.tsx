'use client';

import { format, parseISO } from 'date-fns';
import { Loader2, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROLE_LABELS, USER_ROLES } from '@/lib/auth/constants';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/db/schema';
import type { AdminUsuarioListItem } from '@/types/governance';

interface UsuariosPanelProps {
  initialUsuarios: AdminUsuarioListItem[];
  currentUserId: string;
  className?: string;
}


export function UsuariosPanel({
  initialUsuarios,
  currentUserId,
  className,
}: UsuariosPanelProps) {
  const [usuarios, setUsuarios] = useState(initialUsuarios);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [role, setRole] = useState<UserRole>('analista');
  const [password, setPassword] = useState('');

  async function reloadUsuarios() {
    const response = await fetch('/api/admin/usuarios');
    if (!response.ok) {
      throw new Error('Falha ao recarregar usuários');
    }
    const json = (await response.json()) as { data: AdminUsuarioListItem[] };
    setUsuarios(json.data);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);

    try {
      const response = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          nome_completo: nomeCompleto,
          role,
          ...(password.trim().length > 0 ? { password } : {}),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(
          typeof payload.error === 'string'
            ? payload.error
            : 'Falha ao provisionar usuário',
        );
      }

      toast.success('Usuário provisionado com sucesso.');
      setEmail('');
      setNomeCompleto('');
      setRole('analista');
      setPassword('');
      await reloadUsuarios();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar usuário');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRoleChange(userId: string, nextRole: UserRole) {
    setUpdatingUserId(userId);

    try {
      const response = await fetch(`/api/admin/usuarios/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(
          typeof payload.error === 'string'
            ? payload.error
            : 'Falha ao atualizar perfil',
        );
      }

      toast.success('Perfil atualizado.');
      await reloadUsuarios();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar perfil');
    } finally {
      setUpdatingUserId(null);
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Provisionar usuário</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreate}>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="usuario-email">E-mail</Label>
              <Input
                id="usuario-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@orgao.gov.br"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="usuario-nome">Nome completo</Label>
              <Input
                id="usuario-nome"
                required
                value={nomeCompleto}
                onChange={(event) => setNomeCompleto(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="usuario-role">Perfil</Label>
              <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                <SelectTrigger id="usuario-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {ROLE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="usuario-password">Senha inicial (opcional)</Label>
              <Input
                id="usuario-password"
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Provisionando…
                  </>
                ) : (
                  'Adicionar usuário'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" aria-hidden />
            Usuários do órgão ({usuarios.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Nome</th>
                <th className="pb-2 pr-4 font-medium">E-mail</th>
                <th className="pb-2 pr-4 font-medium">Perfil</th>
                <th className="pb-2 font-medium">Desde</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => (
                <tr key={usuario.user_id} className="border-b border-border/60">
                  <td className="py-3 pr-4 font-medium">{usuario.nome_completo}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {usuario.email ?? '—'}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <Select
                        value={usuario.role}
                        disabled={updatingUserId === usuario.user_id}
                        onValueChange={(value) =>
                          void handleRoleChange(usuario.user_id, value as UserRole)
                        }
                      >
                        <SelectTrigger
                          id={`usuario-role-${usuario.user_id}`}
                          className="w-[min(100%,12rem)]"
                          aria-label={`Perfil de ${usuario.nome_completo}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {USER_ROLES.map((item) => (
                            <SelectItem key={item} value={item}>
                              {ROLE_LABELS[item]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {usuario.user_id === currentUserId ? (
                        <Badge variant="secondary">Você</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {format(parseISO(usuario.created_at), 'dd/MM/yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {usuarios.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum usuário cadastrado neste órgão.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

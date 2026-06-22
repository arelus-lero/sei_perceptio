'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Mail, KeyRound } from 'lucide-react';

import { LoginBranding } from '@/components/auth/login-branding';
import { Button } from '@/components/ui/button';
import { PageTitle } from '@/components/layout/headings';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  loginMagicLinkSchema,
  loginPasswordSchema,
} from '@/lib/auth/login-schemas';
import { createBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface LoginFormProps {
  className?: string;
  callbackError?: string | null;
  inactiveSessionMessage?: string | null;
}

function formatZodErrors(error: { issues: { message: string }[] }): string {
  return error.issues.map((issue) => issue.message).join(' ');
}

export function LoginForm({
  className,
  callbackError,
  inactiveSessionMessage,
}: LoginFormProps) {
  const router = useRouter();
  const [passwordEmail, setPasswordEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicEmail, setMagicEmail] = useState('');
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isMagicLoading, setIsMagicLoading] = useState(false);

  async function handlePasswordLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPasswordLoading(true);

    const parsed = loginPasswordSchema.safeParse({
      email: passwordEmail,
      password,
    });

    if (!parsed.success) {
      toast.error(formatZodErrors(parsed.error));
      setIsPasswordLoading(false);
      return;
    }

    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    setIsPasswordLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  async function handleMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsMagicLoading(true);

    const parsed = loginMagicLinkSchema.safeParse({ email: magicEmail });

    if (!parsed.success) {
      toast.error(formatZodErrors(parsed.error));
      setIsMagicLoading(false);
      return;
    }

    const supabase = createBrowserClient();
    const redirectTo = `${window.location.origin}/callback`;

    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: false,
      },
    });

    setIsMagicLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Enviamos um link de acesso para o seu e-mail.');
  }

  return (
    <Card className={cn('mx-auto w-full max-w-md', className)}>
      <CardHeader className="space-y-4">
        <LoginBranding />
        <PageTitle className="font-heading">SEI-Perceptio</PageTitle>
        <CardDescription>
          Acesse com e-mail e senha ou receba um magic link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {inactiveSessionMessage ? (
          <p
            className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200"
            role="status"
          >
            {inactiveSessionMessage}
          </p>
        ) : null}

        {callbackError ? (
          <p
            className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {callbackError}
          </p>
        ) : null}

        <Tabs defaultValue="password" className="w-full">
          <TabsList className="grid w-full grid-cols-2" aria-label="Método de autenticação">
            <TabsTrigger value="password">
              <KeyRound className="size-4" aria-hidden />
              Senha
            </TabsTrigger>
            <TabsTrigger value="magic">
              <Mail className="size-4" aria-hidden />
              Magic link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="password">
            <form className="space-y-4 pt-2" onSubmit={handlePasswordLogin}>
              <div className="space-y-2">
                <Label htmlFor="password-email">E-mail</Label>
                <Input
                  id="password-email"
                  type="email"
                  autoComplete="email"
                  placeholder="nome@aneel.gov.br"
                  value={passwordEmail}
                  onChange={(event) => setPasswordEmail(event.target.value)}
                  disabled={isPasswordLoading}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isPasswordLoading}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isPasswordLoading}
              >
                {isPasswordLoading ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Entrando…
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="magic">
            <form className="space-y-4 pt-2" onSubmit={handleMagicLink}>
              <div className="space-y-2">
                <Label htmlFor="magic-email">E-mail</Label>
                <Input
                  id="magic-email"
                  type="email"
                  autoComplete="email"
                  placeholder="nome@aneel.gov.br"
                  value={magicEmail}
                  onChange={(event) => setMagicEmail(event.target.value)}
                  disabled={isMagicLoading}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enviaremos um link único. O acesso é permitido apenas para
                usuários previamente cadastrados pelo administrador.
              </p>
              <Button
                type="submit"
                className="w-full"
                variant="secondary"
                disabled={isMagicLoading}
              >
                {isMagicLoading ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Enviando…
                  </>
                ) : (
                  'Enviar magic link'
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

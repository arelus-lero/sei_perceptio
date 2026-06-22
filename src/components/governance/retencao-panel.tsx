'use client';

import { useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
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
import {
  RETENCAO_ACAO_LABELS,
  RETENCAO_ACOES,
  RETENCAO_REGRA_TIPOS,
  RETENCAO_TIPO_ENTIDADE,
} from '@/lib/governance/constants';
import { cn } from '@/lib/utils';
import type { PoliticaRetencaoItem } from '@/types/governance';

interface RetencaoPanelProps {
  initialPoliticas: PoliticaRetencaoItem[];
  className?: string;
}

function formatRegra(regra: PoliticaRetencaoItem['regra']): string {
  if (regra.tipo === 'periodo_dias') {
    return `${regra.valor} dia(s) após ingestão`;
  }
  return `${regra.valor} dia(s) após conclusão do processo`;
}

export function RetencaoPanel({ initialPoliticas, className }: RetencaoPanelProps) {
  const [politicas, setPoliticas] = useState(initialPoliticas);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nome, setNome] = useState('');
  const [tipoEntidade, setTipoEntidade] = useState<(typeof RETENCAO_TIPO_ENTIDADE)[number]>('fonte');
  const [regraTipo, setRegraTipo] = useState<(typeof RETENCAO_REGRA_TIPOS)[number]>('periodo_dias');
  const [regraValor, setRegraValor] = useState('730');
  const [acao, setAcao] = useState<(typeof RETENCAO_ACOES)[number]>('anonimizar');

  async function reloadPoliticas() {
    const response = await fetch('/api/admin/retencao');
    if (!response.ok) {
      throw new Error('Falha ao recarregar políticas');
    }
    const json = (await response.json()) as { data: { politicas: PoliticaRetencaoItem[] } };
    setPoliticas(json.data.politicas);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const valor = Number.parseInt(regraValor, 10);
      if (!Number.isFinite(valor) || valor < 1) {
        toast.error('Informe um período válido em dias.');
        return;
      }

      const response = await fetch('/api/admin/retencao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          tipo_entidade: tipoEntidade,
          regra: { tipo: regraTipo, valor },
          acao,
          ativo: true,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'Falha ao criar política');
      }

      toast.success('Política de retenção criada.');
      setNome('');
      await reloadPoliticas();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar política');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleAtivo(politica: PoliticaRetencaoItem) {
    try {
      const response = await fetch(`/api/admin/retencao/${politica.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !politica.ativo }),
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar política');
      }

      await reloadPoliticas();
      toast.success(politica.ativo ? 'Política desativada.' : 'Política ativada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar');
    }
  }

  return (
    <div className={cn('space-y-6', className)}>
      <Card>
        <CardHeader>
          <CardTitle>Nova política de retenção (RF-043)</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="retencao-nome">Nome</Label>
              <Input
                id="retencao-nome"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                placeholder="Ex.: Fontes upload — 2 anos pós-conclusão"
                required
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="retencao-entidade">Tipo de entidade</Label>
              <Select
                value={tipoEntidade}
                onValueChange={(value) =>
                  setTipoEntidade(value as (typeof RETENCAO_TIPO_ENTIDADE)[number])
                }
              >
                <SelectTrigger id="retencao-entidade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETENCAO_TIPO_ENTIDADE.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="retencao-regra-tipo">Regra</Label>
              <Select
                value={regraTipo}
                onValueChange={(value) =>
                  setRegraTipo(value as (typeof RETENCAO_REGRA_TIPOS)[number])
                }
              >
                <SelectTrigger id="retencao-regra-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="periodo_dias">Período fixo (dias)</SelectItem>
                  <SelectItem value="apos_conclusao">
                    Após conclusão do processo (dias)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="retencao-valor">Valor (dias)</Label>
              <Input
                id="retencao-valor"
                type="number"
                min={1}
                max={36500}
                value={regraValor}
                onChange={(event) => setRegraValor(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="retencao-acao">Ação ao expirar</Label>
              <Select
                value={acao}
                onValueChange={(value) =>
                  setAcao(value as (typeof RETENCAO_ACOES)[number])
                }
              >
                <SelectTrigger id="retencao-acao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETENCAO_ACOES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {RETENCAO_ACAO_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {acao === 'anonimizar' ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm md:col-span-2">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
                <p>
                  A anonimização é <strong>irreversível</strong>: PII e conteúdo sensível
                  serão removidos ou mascarados permanentemente após o prazo configurado.
                </p>
              </div>
            ) : null}

            <div className="md:col-span-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Salvando…
                  </>
                ) : (
                  'Criar política'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Nome</th>
              <th className="px-3 py-2 font-medium">Entidade</th>
              <th className="px-3 py-2 font-medium">Regra</th>
              <th className="px-3 py-2 font-medium">Ação</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {politicas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhuma política configurada.
                </td>
              </tr>
            ) : (
              politicas.map((politica) => (
                <tr key={politica.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2 font-medium">{politica.nome}</td>
                  <td className="px-3 py-2">{politica.tipo_entidade}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatRegra(politica.regra)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={politica.acao === 'anonimizar' ? 'secondary' : 'outline'}>
                      {RETENCAO_ACAO_LABELS[politica.acao]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={politica.ativo ? 'default' : 'outline'}>
                      {politica.ativo ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void toggleAtivo(politica)}
                    >
                      {politica.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

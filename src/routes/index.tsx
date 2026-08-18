import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  ExternalLink,
  LifeBuoy,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import {
  cadastrarToner,
  definirMinimo,
  listHistory,
  listToners,
  registrarMovimento,
  type Toner,
} from "@/lib/toners.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Controle de Toners | Estoque de impressoras" },
      {
        name: "description",
        content:
          "Painel de controle de estoque de toners e cartuchos de impressoras, integrado à planilha do Google Sheets.",
      },
      { property: "og:title", content: "Controle de Toners | Estoque de impressoras" },
      {
        property: "og:description",
        content: "Entradas, saídas, alertas de estoque baixo e histórico direto na sua planilha.",
      },
    ],
  }),
  component: Painel,
});

function Painel() {
  const queryClient = useQueryClient();
  const fetchToners = useServerFn(listToners);
  const fetchHistory = useServerFn(listHistory);
  const movimentar = useServerFn(registrarMovimento);
  const criar = useServerFn(cadastrarToner);
  const salvarMinimo = useServerFn(definirMinimo);

  const tonersQuery = useQuery({ queryKey: ["toners"], queryFn: () => fetchToners() });
  const historyQuery = useQuery({ queryKey: ["historico"], queryFn: () => fetchHistory() });

  const [movDialog, setMovDialog] = useState<{ toner: Toner; tipo: "ENTRADA" | "SAIDA" } | null>(
    null,
  );
  const [novoAberto, setNovoAberto] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["toners"] });
    queryClient.invalidateQueries({ queryKey: ["historico"] });
  };

  const movMutation = useMutation({
    mutationFn: (vars: { row: number; tipo: "ENTRADA" | "SAIDA"; quantidade: number; observacao: string }) =>
      movimentar({ data: vars }),
    onSuccess: () => {
      toast.success("Movimentação registrada na planilha");
      setMovDialog(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const novoMutation = useMutation({
    mutationFn: (vars: { modelo: string; cartucho: string; quantidade: number; minimo: number }) =>
      criar({ data: vars }),
    onSuccess: () => {
      toast.success("Toner cadastrado");
      setNovoAberto(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const minimoMutation = useMutation({
    mutationFn: (vars: { row: number; minimo: number }) => salvarMinimo({ data: vars }),
    onSuccess: () => {
      toast.success("Estoque mínimo atualizado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toners = tonersQuery.data?.toners ?? [];
  const baixos = toners.filter((t) => t.quantidade <= t.minimo);
  const totalItens = toners.reduce((acc, t) => acc + t.quantidade, 0);

  return (
    <main className="min-h-screen bg-background">
      <Toaster />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-6">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Boxes className="size-6" />
          </div>
          <div className="mr-auto">
            <h1 className="text-xl font-semibold tracking-tight">Controle de Toners</h1>
            <p className="text-sm text-muted-foreground">
              Sincronizado com a planilha “Controle - Toners”
            </p>
          </div>
          <Button variant="outline" onClick={invalidate} disabled={tonersQuery.isFetching}>
            <RefreshCw className={tonersQuery.isFetching ? "animate-spin" : ""} />
            Atualizar
          </Button>
          <Button onClick={() => setNovoAberto(true)}>
            <Plus />
            Novo toner
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Modelos cadastrados" value={String(toners.length)} />
          <StatCard label="Unidades em estoque" value={String(totalItens)} />
          <StatCard label="Em estoque baixo" value={String(baixos.length)} alert={baixos.length > 0} />
        </section>

        {baixos.length > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <AlertTriangle className="mt-0.5 size-5 text-destructive" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Reposição necessária</p>
              <p className="text-muted-foreground">{baixos.map((t) => t.modelo).join(" • ")}</p>
            </div>
          </div>
        )}

        <Tabs defaultValue="estoque">
          <TabsList>
            <TabsTrigger value="estoque">Estoque</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="estoque" className="mt-4 space-y-3">
            {tonersQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando planilha…</p>}
            {tonersQuery.isError && (
              <p className="text-sm text-destructive">{(tonersQuery.error as Error).message}</p>
            )}
            {toners.map((t) => (
              <article
                key={t.row}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4"
              >
                <div className="min-w-56 flex-1">
                  <h2 className="font-medium">{t.modelo}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t.cartucho || "Cartucho não informado"}
                    {t.statusAtual.includes("(") ? ` • ${t.statusAtual.trim()}` : ""}
                  </p>
                </div>

                <div className="text-center">
                  <p className="text-2xl font-semibold tabular-nums">{t.quantidade}</p>
                  <p className="text-xs text-muted-foreground">em estoque</p>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor={`min-${t.row}`} className="text-xs text-muted-foreground">
                    Mínimo
                  </Label>
                  <Input
                    id={`min-${t.row}`}
                    type="number"
                    min={0}
                    defaultValue={t.minimo}
                    className="w-20"
                    onBlur={(e) => {
                      const valor = Number(e.target.value);
                      if (Number.isFinite(valor) && valor !== t.minimo) {
                        minimoMutation.mutate({ row: t.row, minimo: valor });
                      }
                    }}
                  />
                </div>

                {t.quantidade <= t.minimo ? (
                  <Badge variant="destructive">Estoque baixo</Badge>
                ) : (
                  <Badge variant="secondary">OK</Badge>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setMovDialog({ toner: t, tipo: "ENTRADA" })}>
                    <ArrowUpCircle />
                    Entrada
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setMovDialog({ toner: t, tipo: "SAIDA" })}>
                    <ArrowDownCircle />
                    Saída
                  </Button>
                  <Button size="sm" variant="default" asChild>
                    <a
                      href={chamadoDe(t).url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Abrir chamado com ${chamadoDe(t).nome}`}
                    >
                      <LifeBuoy />
                      Chamado {chamadoDe(t).nome}
                      <ExternalLink className="size-3.5 opacity-70" />
                    </a>
                  </Button>
                </div>
              </article>
            ))}
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {(historyQuery.data?.movimentos ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  Nenhuma movimentação registrada ainda. Ao lançar entradas ou saídas, elas aparecem aqui e
                  na aba “Movimentações” da planilha.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Modelo</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Qtd.</th>
                      <th className="px-4 py-3">Saldo</th>
                      <th className="px-4 py-3">Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(historyQuery.data?.movimentos ?? []).map((m, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-4 py-3 whitespace-nowrap">{m.data}</td>
                        <td className="px-4 py-3">{m.modelo}</td>
                        <td className="px-4 py-3">{m.tipo}</td>
                        <td className="px-4 py-3 tabular-nums">{m.quantidade}</td>
                        <td className="px-4 py-3 tabular-nums">{m.saldo}</td>
                        <td className="px-4 py-3 text-muted-foreground">{m.observacao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <MovimentoDialog
        state={movDialog}
        onClose={() => setMovDialog(null)}
        pending={movMutation.isPending}
        onSubmit={(quantidade, observacao) =>
          movDialog &&
          movMutation.mutate({ row: movDialog.toner.row, tipo: movDialog.tipo, quantidade, observacao })
        }
      />

      <NovoTonerDialog
        open={novoAberto}
        onClose={() => setNovoAberto(false)}
        pending={novoMutation.isPending}
        onSubmit={(vars) => novoMutation.mutate(vars)}
      />
    </main>
  );
}

function StatCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${alert ? "text-destructive" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function MovimentoDialog({
  state,
  onClose,
  pending,
  onSubmit,
}: {
  state: { toner: Toner; tipo: "ENTRADA" | "SAIDA" } | null;
  onClose: () => void;
  pending: boolean;
  onSubmit: (quantidade: number, observacao: string) => void;
}) {
  const [quantidade, setQuantidade] = useState("1");
  const [observacao, setObservacao] = useState("");

  return (
    <Dialog
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setQuantidade("1");
          setObservacao("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {state?.tipo === "ENTRADA" ? "Registrar entrada" : "Registrar saída"}
          </DialogTitle>
          <DialogDescription>{state?.toner.modelo}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qtd">Quantidade</Label>
            <Input
              id="qtd"
              type="number"
              min={1}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="obs">Observação (opcional)</Label>
            <Input
              id="obs"
              placeholder="Ex.: entregue ao setor financeiro"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={pending || Number(quantidade) < 1}
            onClick={() => onSubmit(Number(quantidade), observacao)}
          >
            {pending ? "Salvando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovoTonerDialog({
  open,
  onClose,
  pending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  pending: boolean;
  onSubmit: (vars: { modelo: string; cartucho: string; quantidade: number; minimo: number }) => void;
}) {
  const [modelo, setModelo] = useState("");
  const [cartucho, setCartucho] = useState("");
  const [quantidade, setQuantidade] = useState("0");
  const [minimo, setMinimo] = useState("2");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar toner</DialogTitle>
          <DialogDescription>A nova linha é criada direto na planilha.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="modelo">Modelo da impressora</Label>
            <Input id="modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cartucho">Cartucho / Toner</Label>
            <Input
              id="cartucho"
              placeholder="Ex.: TK1175"
              value={cartucho}
              onChange={(e) => setCartucho(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="q">Quantidade inicial</Label>
              <Input id="q" type="number" min={0} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m">Estoque mínimo</Label>
              <Input id="m" type="number" min={0} value={minimo} onChange={(e) => setMinimo(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={pending || modelo.trim().length < 2}
            onClick={() =>
              onSubmit({
                modelo: modelo.trim(),
                cartucho: cartucho.trim(),
                quantidade: Number(quantidade),
                minimo: Number(minimo),
              })
            }
          >
            {pending ? "Salvando…" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

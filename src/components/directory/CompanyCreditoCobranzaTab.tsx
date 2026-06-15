import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, FileDown, Save, CreditCard, TrendingUp, AlertTriangle, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { buildCompanyCreditoCobranzaData } from "@/lib/buildCompanyCreditoCobranzaData";
import { generateCompanyCreditoCobranzaPdf } from "@/lib/generateCompanyCreditoCobranzaPdf";

interface Props {
  companyId: string;
  initialLimiteCredito?: number | null;
}

export function CompanyCreditoCobranzaTab({ companyId, initialLimiteCredito }: Props) {
  const qc = useQueryClient();
  const [limiteInput, setLimiteInput] = useState<string>(
    initialLimiteCredito != null ? String(initialLimiteCredito) : ""
  );
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["company-credito-cobranza", companyId],
    enabled: !!companyId,
    queryFn: () => buildCompanyCreditoCobranzaData(companyId),
  });

  useEffect(() => {
    if (data) setLimiteInput(data.limiteCredito ? String(data.limiteCredito) : "");
  }, [data?.limiteCredito]);

  const handleSaveLimite = async () => {
    const val = limiteInput === "" ? null : Number(limiteInput);
    if (val != null && (Number.isNaN(val) || val < 0)) {
      toast.error("Ingresa un número válido");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("companies").update({ limite_credito: val }).eq("id", companyId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Límite de crédito actualizado");
    qc.invalidateQueries({ queryKey: ["companies"] });
    refetch();
  };

  const handleDownload = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      generateCompanyCreditoCobranzaPdf(data);
      toast.success("PDF descargado");
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading || !data) {
    return <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-32 w-full" /><Skeleton className="h-60 w-full" /></div>;
  }

  const maxBucket = Math.max(...data.buckets.map(b => b.monto), 1);

  return (
    <div className="space-y-4">
      {/* Límite + Descargar PDF */}
      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5 flex-1 min-w-[220px]">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <CreditCard className="h-3 w-3" /> Límite de Crédito
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={limiteInput}
                onChange={e => setLimiteInput(e.target.value)}
                className="h-9"
                placeholder="0.00"
              />
              <Button size="sm" onClick={handleSaveLimite} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ml-1">Guardar</span>
              </Button>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
            Descargar PDF
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard title="Total Facturado" value={formatCurrency(data.totalFacturadoImporte)} subtitle={`${data.totalFacturadoCount} facturas`} icon={<TrendingUp className="h-4 w-4" />} accent="text-primary" />
        <KpiCard title="Vigente" value={formatCurrency(data.vigenteImporte)} subtitle={`${data.vigenteCount} facturas`} icon={<Wallet className="h-4 w-4" />} accent="text-emerald-600" />
        <KpiCard title="Vencido" value={formatCurrency(data.vencidoImporte)} subtitle={`${data.vencidoCount} facturas`} icon={<AlertTriangle className="h-4 w-4" />} accent="text-destructive" />
      </div>

      {/* Buckets */}
      <div className="rounded-lg border p-3 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">Cartera por Antigüedad</div>
        <div className="space-y-2">
          {data.buckets.map(b => {
            const pct = (b.monto / maxBucket) * 100;
            const labelColor = b.variant === "destructive"
              ? "text-destructive"
              : b.variant === "warning"
                ? "text-emerald-600"
                : "text-foreground";
            const barColor = b.variant === "destructive" ? "bg-destructive" : "bg-blue-600";
            return (
              <div key={b.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className={`font-medium ${labelColor}`}>{b.label} <span className="text-muted-foreground">({b.count})</span></span>
                  <span className="font-mono font-semibold">{formatCurrency(b.monto)}</span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Vencidas */}
      <FacturasTable
        title="Facturas Vencidas"
        rows={data.vencidas}
        diasLabel="Días Vencida"
        diasColor="text-destructive"
      />

      {/* Por vencer ascendente */}
      <FacturasTable
        title="Facturas por Vencer (orden ascendente)"
        rows={data.porVencer}
        diasLabel="Días para Vencer"
        diasColor="text-amber-600"
      />
    </div>
  );
}

function KpiCard({ title, value, subtitle, icon, accent }: { title: string; value: string; subtitle: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className={`flex items-center gap-1 text-[10px] uppercase tracking-wide ${accent}`}>{icon}{title}</div>
      <div className="mt-1 font-mono text-lg font-bold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{subtitle}</div>
    </div>
  );
}

function FacturasTable({ title, rows, diasLabel, diasColor }: {
  title: string;
  rows: { numero: string; fechaDocumento: string; fechaVencimiento: string; dias?: number; tipoPago: string; total: number; saldo: number }[];
  diasLabel: string;
  diasColor: string;
}) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-3 py-2 border-b">
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">{title} <span className="text-muted-foreground">({rows.length})</span></div>
      </div>
      <div className="max-h-72 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Factura</TableHead>
              <TableHead>F. Documento</TableHead>
              <TableHead>F. Vencimiento</TableHead>
              <TableHead className="text-center">{diasLabel}</TableHead>
              <TableHead>Tipo Pago</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">Sin registros.</TableCell></TableRow>
            ) : rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{r.numero}</TableCell>
                <TableCell className="text-xs">{r.fechaDocumento}</TableCell>
                <TableCell className="text-xs">{r.fechaVencimiento}</TableCell>
                <TableCell className={`text-center font-semibold ${diasColor}`}>{r.dias ?? "-"}</TableCell>
                <TableCell className="text-xs">{r.tipoPago}</TableCell>
                <TableCell className="text-right font-mono text-xs">{formatCurrency(r.total)}</TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold">{formatCurrency(r.saldo)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

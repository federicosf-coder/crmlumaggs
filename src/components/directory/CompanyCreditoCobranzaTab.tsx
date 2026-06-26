import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, FileDown, Save, CreditCard, TrendingUp, AlertTriangle, Wallet, CheckCircle2, Mail, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { buildCompanyCreditoCobranzaData, type BrandKey } from "@/lib/buildCompanyCreditoCobranzaData";
import { generateCompanyCreditoCobranzaPdf } from "@/lib/generateCompanyCreditoCobranzaPdf";
import { generateCompanyCreditoCobranzaPdfArtifact } from "@/lib/templateDocumentGenerators";
import { WhatsAppActionDialog } from "@/components/whatsapp/WhatsAppActionDialog";

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
  const [preparandoWa, setPreparandoWa] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [waPhone, setWaPhone] = useState<string | null>(null);
  const [waMessage, setWaMessage] = useState<string>("");
  const [waCompanyName, setWaCompanyName] = useState<string>("");
  const [waContactId, setWaContactId] = useState<string | null>(null);

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
    setDownloading(true);
    try {
      const brands: BrandKey[] = ["lumaggs_chevron", "galsa_phillips66"];
      let generated = 0;
      for (const brand of brands) {
        const brandData = await buildCompanyCreditoCobranzaData(companyId, brand);
        // Solo generar PDF si la empresa tiene actividad con esa marca
        if (brandData.pagadasHistFacturadoCount === 0 && brandData.totalFacturadoCount === 0) continue;
        generateCompanyCreditoCobranzaPdf(brandData);
        generated++;
      }
      if (generated === 0) {
        toast.info("Sin facturación registrada para generar el PDF");
      } else {
        toast.success(`${generated} PDF${generated > 1 ? "s" : ""} descargado${generated > 1 ? "s" : ""}`);
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    // TODO (acción para automatizar): generar el PDF y enviarlo por correo
    // usando la Edge Function `process-email-queue`.
    toast.info("Próximamente: envío automático del PDF por correo");
  };

  const handleEnviarWhatsApp = async () => {
    setPreparandoWa(true);
    try {
      // 1) Generar PDF y subir a bucket con URL firmada (7 días)
      const { blob, fileName } = await generateCompanyCreditoCobranzaPdfArtifact(companyId);
      const safeName = fileName.replace(/[^A-Za-z0-9.:_-]+/g, "_");
      const key = `cobranza-estados-cuenta/${companyId}/${Date.now()}-${safeName}`;
      const up = await supabase.storage
        .from("document-files")
        .upload(key, blob, { contentType: "application/pdf", upsert: false });
      if (up.error) throw up.error;
      const { data: signed, error: serr } = await supabase.storage
        .from("document-files")
        .createSignedUrl(key, 60 * 60 * 24 * 7);
      if (serr) throw serr;
      const url = signed?.signedUrl || "";

      // Acortar URL usando nuestro propio dominio: /p/CÓDIGO
      let shortUrl = url;
      try {
        const expISO = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: code, error: cerr } = await supabase.rpc(
          "create_short_link" as any,
          { _target_url: url, _expires_at: expISO },
        );
        if (!cerr && code) {
          shortUrl = `https://portal.lumaggs.com.mx/p/${code}`;
        }
      } catch { /* si falla, usamos la URL larga */ }

      // 2) Buscar empresa y contacto preferente (cobranza/crédito)
      const { data: empresa } = await (supabase as any)
        .from("companies")
        .select("id, name, phone")
        .eq("id", companyId)
        .maybeSingle();

      const { data: contactos } = await (supabase as any)
        .from("contacts")
        .select("id, first_name, last_name, whatsapp, phone, mobile, contacto_cobranza, contacto_credito, is_primary")
        .eq("company_id", companyId);

      const list = (contactos || []) as any[];
      const elegido =
        list.find((c) => c.contacto_cobranza && (c.whatsapp || c.mobile || c.phone)) ||
        list.find((c) => c.contacto_credito && (c.whatsapp || c.mobile || c.phone)) ||
        list.find((c) => c.is_primary && (c.whatsapp || c.mobile || c.phone)) ||
        list.find((c) => c.whatsapp || c.mobile || c.phone) ||
        null;

      const tel: string | null =
        elegido?.whatsapp || elegido?.mobile || elegido?.phone || empresa?.phone || null;

      // 3) Construir mensaje
      const mensaje =
        `Buen día, enviamos estado de cuenta actualizado. Agradecemos su apoyo para mantener su cuenta en buen estado.\n\n` +
        `${shortUrl}`;

      setWaCompanyName(empresa?.name || "");
      setWaContactId(elegido?.id || null);
      setWaPhone(tel);
      setWaMessage(mensaje);
      setWaOpen(true);
    } catch (e: any) {
      console.error("[handleEnviarWhatsApp]", e);
      toast.error("No se pudo preparar el envío: " + (e?.message || e));
    } finally {
      setPreparandoWa(false);
    }
  };

  if (isLoading || !data) {
    return <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-32 w-full" /><Skeleton className="h-60 w-full" /></div>;
  }

  const maxBucket = Math.max(...data.buckets.map(b => b.monto), 1);

  return (
    <div className="space-y-4">
      {/* Límite + Acciones PDF */}
      <div className="rounded-lg border bg-muted/40 p-2">
        <div className="flex items-end justify-between gap-2">
          <div className="space-y-1">
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
                className="h-8 w-32"
                placeholder="0.00"
              />
              <Button size="sm" className="h-8" onClick={handleSaveLimite} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ml-1">Guardar</span>
              </Button>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Utilizado: <span className="font-mono font-semibold text-foreground">{formatCurrency(data.creditoUtilizado)}</span></span>
              <span>Disponible: <span className="font-mono font-semibold text-foreground">{formatCurrency(data.creditoDisponible)}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8" onClick={handleEnviarWhatsApp} disabled={preparandoWa}>
              {preparandoWa ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-1 text-emerald-600" />}
              Enviar PDF
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={handleDownload} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
              Descargar PDF
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={handleSendEmail}>
              <Mail className="h-4 w-4 mr-1" />
              Enviar PDF por Correo
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Total Facturado" value={formatCurrency(data.totalFacturadoImporte)} subtitle={`${data.totalFacturadoCount} facturas`} icon={<TrendingUp className="h-4 w-4" />} accent="text-primary" />
        <KpiCard title="En Tiempo" value={formatCurrency(data.vigenteImporte)} subtitle={`${data.vigenteCount} facturas`} icon={<Wallet className="h-4 w-4" />} accent="text-emerald-600" />
        <KpiCard title="Vencido" value={formatCurrency(data.vencidoImporte)} subtitle={`${data.vencidoCount} facturas`} icon={<AlertTriangle className="h-4 w-4" />} accent="text-destructive" />
        <KpiCard
          title="Total Facturas Pagadas"
          value={`${data.pagadasCount}`}
          subtitle={`Facturas pagadas en total`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="text-blue-600"
        />
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

      <WhatsAppActionDialog
        open={waOpen}
        onOpenChange={setWaOpen}
        phone={waPhone}
        variables={{ empresa_nombre: waCompanyName }}
        templateType="cobranza"
        defaultMessage={waMessage}
        context={{ company_id: companyId, contact_id: waContactId }}
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

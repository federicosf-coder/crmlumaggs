import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { FileText, Trash2, AlertTriangle, ExternalLink } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const CANAL_LABEL: Record<string, string> = {
  android_share: "Android",
  ios_shortcut: "iPhone",
  app_manual: "App",
  email: "Correo",
};

const FORMA_PAGO_OPTIONS = [
  { value: "contado", label: "Contado" },
  { value: "credito", label: "Crédito" },
  { value: "credito_cescemex", label: "Crédito Cescemex" },
];

const METODO_PAGO_OPTIONS = [
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "cheque", label: "Cheque" },
  { value: "otro", label: "Otro" },
];

const METODOS_VALIDOS = METODO_PAGO_OPTIONS.map((o) => o.value);
const FORMAS_VALIDAS = FORMA_PAGO_OPTIONS.map((o) => o.value);

function normalizarAlias(input: string): string {
  return input
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


interface IntakeRow {
  id: string;
  canal: string;
  created_at: string;
  storage_path: string;
  nombre_archivo: string | null;
  mime_type: string | null;
  monto_extraido: number | null;
  fecha_extraida: string | null;
  banco_extraido: string | null;
  referencia_extraida: string | null;
  clabe_extraida: string | null;
  tarjeta_ultimos4_extraida: string | null;
  extraccion_error: string | null;
  nombre_detectado: string | null;
  metodo_extraido: string | null;
  empresa_id: string | null;
}

export function ComprobantesIntakeTab() {
  const { data: comprobantes = [], isLoading, refetch } = useQuery({
    queryKey: ["comprobantes-intake-pendientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comprobantes_intake")
        .select(
          "id,canal,created_at,storage_path,nombre_archivo,mime_type,monto_extraido,fecha_extraida,banco_extraido,referencia_extraida,clabe_extraida,tarjeta_ultimos4_extraida,extraccion_error,nombre_detectado,metodo_extraido,empresa_id"
        )
        .eq("estatus", "pendiente")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as IntakeRow[];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-activas-intake"],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("id,name")
        .eq("is_active", true)
        .order("name");
      return (data || []) as { id: string; name: string }[];
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Cargando comprobantes...</p>;
  }

  if (comprobantes.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No hay comprobantes pendientes de clasificar.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {comprobantes.map((c) => (
        <ComprobanteCard key={c.id} row={c} companies={companies} onDone={() => refetch()} />
      ))}
    </div>
  );
}

function ComprobanteCard({
  row,
  companies,
  onDone,
}: {
  row: IntakeRow;
  companies: { id: string; name: string }[];
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState(row.empresa_id || "");
  const autoVinculado = !!row.empresa_id;
  const [empresaDatos, setEmpresaDatos] = useState<{ clabe_bancaria: string | null; tarjeta_ultimos4: string | null } | null>(null);
  const [monto, setMonto] = useState(row.monto_extraido != null ? String(row.monto_extraido) : "");
  const [fecha, setFecha] = useState(row.fecha_extraida || new Date().toISOString().slice(0, 10));
  const [banco, setBanco] = useState(row.banco_extraido || "");
  const [referencia, setReferencia] = useState(row.referencia_extraida || "");
  const [formaPago, setFormaPago] = useState("");
  const [formaPagoTocada, setFormaPagoTocada] = useState(false);
  const [metodoPago, setMetodoPago] = useState(
    row.metodo_extraido && METODOS_VALIDOS.includes(row.metodo_extraido) ? row.metodo_extraido : "transferencia"
  );
  const [saving, setSaving] = useState(false);

  const isImage = (row.mime_type || "").startsWith("image/");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.storage.from("comprobantes-intake").createSignedUrl(row.storage_path, 3600);
      if (active) setSignedUrl(data?.signedUrl ?? null);
    })();
    return () => {
      active = false;
    };
  }, [row.storage_path]);

  useEffect(() => {
    if (!empresaId) {
      setEmpresaDatos(null);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("clabe_bancaria,tarjeta_ultimos4,tipo_pago")
        .eq("id", empresaId)
        .maybeSingle();
      if (!active) return;
      setEmpresaDatos((data as any) ?? null);
      const tp = (data as any)?.tipo_pago as string | null;
      if (tp && FORMAS_VALIDAS.includes(tp) && !formaPagoTocada) setFormaPago(tp);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const mismatchClabe =
    !!empresaDatos?.clabe_bancaria &&
    !!row.clabe_extraida &&
    empresaDatos.clabe_bancaria.replace(/\D/g, "") !== row.clabe_extraida.replace(/\D/g, "");
  const mismatchTarjeta =
    !!empresaDatos?.tarjeta_ultimos4 &&
    !!row.tarjeta_ultimos4_extraida &&
    empresaDatos.tarjeta_ultimos4.replace(/\D/g, "") !== row.tarjeta_ultimos4_extraida.replace(/\D/g, "");

  const handleDescartar = async () => {
    if (!window.confirm("¿Descartar este comprobante?")) return;
    const { error } = await supabase.from("comprobantes_intake").update({ estatus: "descartado" as any }).eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Comprobante descartado");
    onDone();
  };

  const handleCrearPago = async () => {
    const montoNum = Number(monto);
    if (!empresaId) {
      toast.error("Selecciona el cliente");
      return;
    }
    if (!montoNum || montoNum <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    if (!formaPago) {
      toast.error("Selecciona la forma de pago");
      return;
    }
    setSaving(true);
    try {
      const { data: cp } = await supabase
        .from("company_plazas")
        .select("plaza_id")
        .eq("company_id", empresaId)
        .limit(1);
      const plazaId = cp && cp.length > 0 ? (cp[0] as any).plaza_id : null;
      if (!plazaId) toast.warning("El cliente no tiene plaza registrada. Completa la plaza manualmente en el pago.");

      const { data: pago, error: pagoErr } = await supabase
        .from("cobranza_pagos")
        .insert({
          empresa_id: empresaId,
          plaza_id: plazaId,
          fecha_pago: fecha,
          monto_total: montoNum,
          monto_disponible: montoNum,
          moneda: "MXN",
          tipo_pago: formaPago as any,
          referencia_pago: referencia || null,
          banco: banco || null,
          estatus_pago: "recibido" as any,
          observaciones: `Comprobante recibido vía ${CANAL_LABEL[row.canal] || row.canal}. Creado desde bandeja de clasificación.`,
          creado_por: user?.id,
        } as any)
        .select("id")
        .single();
      if (pagoErr) throw pagoErr;

      // Copiar archivo al bucket de documentos y registrarlo
      try {
        const { data: file, error: dlErr } = await supabase.storage.from("comprobantes-intake").download(row.storage_path);
        if (dlErr) throw dlErr;
        const nombre = row.nombre_archivo || row.storage_path.split("/").pop() || "comprobante";
        const path = `pagos/${pago.id}/${Date.now()}-${nombre}`;
        const { error: upErr } = await supabase.storage
          .from("document-files")
          .upload(path, file, { contentType: row.mime_type || undefined });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("document-files").getPublicUrl(path);
        await supabase.from("cobranza_pago_archivos").insert({
          pago_id: pago.id,
          url_archivo: pub.publicUrl,
          nombre_archivo: nombre,
          tipo_archivo: row.mime_type || "application/octet-stream",
          usuario_carga: user?.id,
        } as any);
      } catch (e: any) {
        console.error("copiar comprobante", e);
        toast.warning("El pago se creó, pero no se pudo adjuntar el archivo.");
      }

      const { error: updErr } = await supabase
        .from("comprobantes_intake")
        .update({
          estatus: "clasificado" as any,
          empresa_id: empresaId,
          cobranza_pago_id: pago.id,
          clasificado_at: new Date().toISOString(),
          clasificado_por: user?.id,
        } as any)
        .eq("id", row.id);
      if (updErr) throw updErr;

      toast.success("Pago creado y comprobante clasificado");
      onDone();
    } catch (e: any) {
      toast.error(e.message || "No se pudo crear el pago");
    } finally {
      setSaving(false);
    }
  };

  const dash = (v: any) => (v === null || v === undefined || v === "" ? "—" : v);

  return (
    <Card>
      <CardContent className="p-4 grid gap-4 md:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          {isImage && signedUrl ? (
            <img src={signedUrl} alt={row.nombre_archivo || "Comprobante"} className="w-full rounded-md border object-contain max-h-56" loading="lazy" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border bg-muted/30 p-6">
              <FileText className="h-10 w-10 text-muted-foreground" />
              {signedUrl && (
                <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1">
                  Ver archivo <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{formatDate(row.created_at)}</span>
            <Badge variant="secondary">{CANAL_LABEL[row.canal] || row.canal}</Badge>
          </div>
        </div>

        <div className="space-y-3">
          {row.extraccion_error ? (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
              <AlertTriangle className="h-3 w-3 mr-1" /> IA no pudo leer el comprobante
            </Badge>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div><span className="text-muted-foreground">Monto: </span>{row.monto_extraido != null ? formatCurrency(Number(row.monto_extraido)) : "—"}</div>
              <div><span className="text-muted-foreground">Fecha: </span>{row.fecha_extraida ? formatDate(row.fecha_extraida) : "—"}</div>
              <div><span className="text-muted-foreground">Banco: </span>{dash(row.banco_extraido)}</div>
              <div><span className="text-muted-foreground">Referencia: </span>{dash(row.referencia_extraida)}</div>
              <div><span className="text-muted-foreground">CLABE: </span>{dash(row.clabe_extraida)}</div>
              <div><span className="text-muted-foreground">Tarjeta: </span>{row.tarjeta_ultimos4_extraida ? `····${row.tarjeta_ultimos4_extraida}` : "—"}</div>
            </div>
          )}

          <div>
            <Label>Cliente *</Label>
            <SearchableSelect
              value={empresaId}
              onValueChange={setEmpresaId}
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Selecciona cliente..."
            />
          </div>

          {(mismatchClabe || mismatchTarjeta) && (
            <Alert className="border-amber-300 bg-amber-50 text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                La CLABE/tarjeta del comprobante no coincide con la registrada para este cliente. Verifica antes de continuar.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>Monto *</Label>
              <Input type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <Label>Banco</Label>
              <Input value={banco} onChange={(e) => setBanco(e.target.value)} />
            </div>
            <div>
              <Label>Referencia</Label>
              <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} />
            </div>
          </div>

          <div className="md:max-w-xs">
            <Label>Forma de pago *</Label>
            <SearchableSelect
              value={formaPago}
              onValueChange={setFormaPago}
              options={FORMA_PAGO_OPTIONS}
              placeholder="Selecciona forma de pago..."
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button onClick={handleCrearPago} disabled={saving}>
              {saving ? "Creando..." : "Crear pago"}
            </Button>
            <Button variant="ghost" onClick={handleDescartar} disabled={saving}>
              <Trash2 className="h-4 w-4 mr-1" /> Descartar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

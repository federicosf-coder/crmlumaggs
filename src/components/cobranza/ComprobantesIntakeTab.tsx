import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabasePagination";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { FileText, Trash2, AlertTriangle, ExternalLink, Mail } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useAuth } from "@/contexts/AuthContext";
import { EnviarConfirmacionPagoDialog } from "@/components/cobranza/EnviarConfirmacionPagoDialog";
import { buildValidacionEmailFlow, type ValidacionEmailFlow } from "@/lib/cobranzaValidacionEmail";
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

interface DocOption {
  id: string;
  tipo_documento: "factura" | "pedido" | "cotizacion";
  numero: string;
  fecha_documento: string;
  total: number;
  saldo: number;
}

/** Tolerancia en pesos para diferencias mínimas al aplicar pagos */
const TOLERANCIA = 5;

const TIPO_LABEL: Record<string, string> = {
  factura: "Factura",
  pedido: "Pedido",
  cotizacion: "Cotización",
};

type EmpresaVendedora = "lumaggs_chevron" | "galsa_phillips66" | null | undefined;

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
  email_html_storage_path: string | null;
  comprobante_generado_path: string | null;
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

export function ComprobantesIntakeTab({ empresaVendedora }: { empresaVendedora?: EmpresaVendedora }) {
  const { data: comprobantes = [], isLoading, refetch } = useQuery({
    queryKey: ["comprobantes-intake-pendientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comprobantes_intake")
        .select(
          "id,canal,created_at,storage_path,email_html_storage_path,comprobante_generado_path,nombre_archivo,mime_type,monto_extraido,fecha_extraida,banco_extraido,referencia_extraida,clabe_extraida,tarjeta_ultimos4_extraida,extraccion_error,nombre_detectado,metodo_extraido,empresa_id"
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
      return await fetchAllRows<{ id: string; name: string }>(
        (from, to) =>
          supabase
            .from("companies")
            .select("id,name")
            .eq("is_active", true)
            .order("name")
            .range(from, to),
        1000
      );
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
        <ComprobanteCard key={c.id} row={c} companies={companies} empresaVendedora={empresaVendedora} onDone={() => refetch()} />
      ))}
    </div>
  );
}

function ComprobanteCard({
  row,
  companies,
  empresaVendedora,
  onDone,
}: {
  row: IntakeRow;
  companies: { id: string; name: string }[];
  empresaVendedora?: EmpresaVendedora;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState(row.empresa_id || "");
  const autoVinculado = !!row.empresa_id;
  const [empresaDatos, setEmpresaDatos] = useState<{ clabe_bancaria: string | null; tarjeta_ultimos4: string | null } | null>(null);
  const [monto, setMonto] = useState(row.monto_extraido != null ? String(row.monto_extraido) : "");
  const [openPreview, setOpenPreview] = useState(false);
  const [previewFlow, setPreviewFlow] = useState<ValidacionEmailFlow | null>(null);
  const [previewPagoId, setPreviewPagoId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(row.fecha_extraida || new Date().toISOString().slice(0, 10));
  const [banco, setBanco] = useState(row.banco_extraido || "");
  const [referencia, setReferencia] = useState(row.referencia_extraida || "");
  const [formaPago, setFormaPago] = useState("");
  const [formaPagoTocada, setFormaPagoTocada] = useState(false);
  const [metodoPago, setMetodoPago] = useState(
    row.metodo_extraido && METODOS_VALIDOS.includes(row.metodo_extraido) ? row.metodo_extraido : "transferencia"
  );
  const [saving, setSaving] = useState(false);
  const [savingEnviar, setSavingEnviar] = useState(false);
  const [docs, setDocs] = useState<DocOption[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [seleccion, setSeleccion] = useState<Record<string, string>>({});
  const [tipoFiltro, setTipoFiltro] = useState<"factura" | "pedido" | "cotizacion">("factura");

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

  // Cargar documentos al cambiar empresa
  useEffect(() => {
    if (!empresaId) { setDocs([]); setSeleccion({}); return; }
    setLoadingDocs(true);
    supabase.from("documentos")
      .select("id,tipo_documento,numero_factura,numero_pedido,numero_cotizacion,fecha_documento,total,saldo_pendiente_cobranza,estatus_factura")
      .eq("empresa_id", empresaId)
      .eq("is_active", true)
      .gt("total", 0)
      .in("tipo_documento", ["factura", "pedido", "cotizacion"])
      .order("fecha_documento", { ascending: false })
      .then(({ data }) => {
        const mapped: DocOption[] = (data || [])
          .filter((d: any) => {
            const status = (d.estatus_factura || "").toLowerCase();
            return status !== "pagada" && status !== "cancelada";
          })
          .map((d: any) => ({
            id: d.id,
            tipo_documento: d.tipo_documento,
            numero: d.numero_factura || d.numero_pedido || d.numero_cotizacion || "—",
            fecha_documento: d.fecha_documento,
            total: Number(d.total || 0),
            saldo:
              d.tipo_documento === "factura"
                ? Number(d.saldo_pendiente_cobranza ?? d.total ?? 0)
                : Number(d.total || 0),
          }));
        setDocs(mapped);
        setSeleccion({});
        setLoadingDocs(false);
      });
  }, [empresaId]);

  const totalAsignado = useMemo(
    () => Object.values(seleccion).reduce((s, v) => s + (Number(v) || 0), 0),
    [seleccion]
  );
  const montoNum = Number(monto) || 0;
  const diferencia = montoNum - totalAsignado;

  const toggleDoc = (doc: DocOption, checked: boolean) => {
    setSeleccion((prev) => {
      const next = { ...prev };
      if (checked) {
        const restante = Math.max(0, montoNum - totalAsignado);
        let sugerido = montoNum > 0 ? Math.min(doc.saldo, restante) : doc.saldo;
        if (montoNum > 0 && restante > doc.saldo && restante - doc.saldo <= TOLERANCIA) sugerido = restante;
        next[doc.id] = String(sugerido.toFixed(2));
      } else {
        delete next[doc.id];
      }
      return next;
    });
  };



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

  const crearPago = async (aplicaciones: { doc_id: string; monto: number }[]): Promise<{ id: string } | null> => {
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
          metodo_pago: metodoPago,
          referencia_pago: referencia || null,
          banco: banco || null,
          estatus_pago: "recibido" as any,
          observaciones: `Comprobante recibido vía ${CANAL_LABEL[row.canal] || row.canal}. Creado desde bandeja de clasificación.`,
          creado_por: user?.id,
          ...(empresaVendedora ? { empresa_vendedora: empresaVendedora } : {}),
        } as any)
        .select("id")
        .single();
      if (pagoErr) throw pagoErr;

      // Aplicaciones a documentos seleccionados
      if (aplicaciones.length > 0) {
        const aplicacionesPayload = aplicaciones.map((a) => {
          const doc = docs.find((d) => d.id === a.doc_id)!;
          return {
            pago_id: pago.id,
            documento_id: a.doc_id,
            tipo_documento: doc.tipo_documento,
            monto_aplicado: a.monto,
            creado_por: user?.id,
          };
        });
        const { error: appErr } = await supabase.from("cobranza_aplicaciones").insert(aplicacionesPayload as any);
        if (appErr) toast.warning("Pago creado, pero falló alguna aplicación: " + appErr.message);
      }

      // Aprendizaje de alias cliente
      if (row.nombre_detectado) {
        const aliasNorm = normalizarAlias(row.nombre_detectado);
        if (aliasNorm) {
          const { data: existente } = await supabase
            .from("comprobante_cliente_aliases")
            .select("id,veces_usado")
            .eq("alias_normalizado", aliasNorm)
            .maybeSingle();
          if (existente) {
            await supabase
              .from("comprobante_cliente_aliases")
              .update({
                empresa_id: empresaId,
                veces_usado: ((existente as any).veces_usado || 0) + 1,
                updated_at: new Date().toISOString(),
              } as any)
              .eq("id", (existente as any).id);
          } else {
            await supabase.from("comprobante_cliente_aliases").insert({
              alias_normalizado: aliasNorm,
              empresa_id: empresaId,
              veces_usado: 1,
              created_by: user?.id,
            } as any);
          }
        }
      }

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

      return pago;
    } catch (e: any) {
      toast.error(e.message || "No se pudo crear el pago");
      return null;
    }
  };

  const handleCrearPago = async () => {
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
    const aplicaciones = Object.entries(seleccion)
      .map(([doc_id, m]) => ({ doc_id, monto: Number(m) || 0 }))
      .filter((a) => a.monto > 0);
    if (totalAsignado > montoNum + TOLERANCIA) { toast.error("La suma asignada excede el monto del pago"); return; }
    setSaving(true);
    try {
      const pago = await crearPago(aplicaciones);
      if (!pago) return;
      toast.success("Pago creado y comprobante clasificado");
      onDone();
      navigate(`/cobranza/${empresaVendedora === "galsa_phillips66" ? "phillips66" : "chevron"}?pagoId=${pago.id}`);
    } finally {
      setSaving(false);
    }
  };

  const handleGuardarYEnviar = async () => {
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
    const aplicaciones = Object.entries(seleccion)
      .map(([doc_id, m]) => ({ doc_id, monto: Number(m) || 0 }))
      .filter((a) => a.monto > 0);
    if (totalAsignado > montoNum + TOLERANCIA) { toast.error("La suma asignada excede el monto del pago"); return; }
    setSavingEnviar(true);
    try {
      const pago = await crearPago(aplicaciones);
      if (!pago) return;

      const flowData = await buildValidacionEmailFlow(
        pago.id,
        formaPago as any,
        user?.email || undefined
      );
      setPreviewFlow(flowData);
      setPreviewPagoId(pago.id);
      setOpenPreview(true);
    } finally {
      setSavingEnviar(false);
    }
  };

  const dash = (v: any) => (v === null || v === undefined || v === "" ? "—" : v);

  const handleVerCorreo = async () => {
    if (!row.email_html_storage_path) return;
    const { data, error } = await supabase.storage
      .from("comprobantes-intake")
      .createSignedUrl(row.email_html_storage_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("No se pudo generar la liga del correo");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleVerPdfGenerado = async () => {
    if (!row.comprobante_generado_path) return;
    const { data, error } = await supabase.storage
      .from("comprobantes-intake")
      .createSignedUrl(row.comprobante_generado_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("No se pudo abrir el PDF generado");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <>
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
          {row.canal === "email" && row.email_html_storage_path && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={handleVerCorreo}
            >
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              Ver correo original
            </Button>
          )}
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
            <div className="flex items-center gap-2">
              <Label>Cliente *</Label>
              {autoVinculado && (
                <Badge variant="secondary" className="text-[10px]">Vinculado automáticamente</Badge>
              )}
            </div>
            <SearchableSelect
              value={empresaId}
              onValueChange={setEmpresaId}
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Selecciona cliente..."
            />
            {!autoVinculado && row.nombre_detectado && (
              <p className="text-xs text-muted-foreground mt-1">Nombre detectado: "{row.nombre_detectado}"</p>
            )}
          </div>

          {(mismatchClabe || mismatchTarjeta) && (
            <Alert className="border-amber-300 bg-amber-50 text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                La CLABE/tarjeta del comprobante no coincide con la registrada para este cliente. Verifica antes de continuar.
              </AlertDescription>
            </Alert>
          )}

          {empresaId && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Documentos a ligar</Label>
                {montoNum > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Asignado: <span className="font-medium text-foreground">{formatCurrency(totalAsignado)}</span> /{" "}
                    {formatCurrency(montoNum)}{" "}
                    {Math.abs(diferencia) > 0.01 && (
                      <span className={diferencia < 0 ? "text-destructive" : "text-amber-600"}>
                        ({diferencia > 0 ? "+" : ""}{formatCurrency(diferencia)})
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-1 mb-2">
                {(["factura", "pedido", "cotizacion"] as const).map((t) => {
                  const count = docs.filter((d) => d.tipo_documento === t).length;
                  return (
                    <Button
                      key={t}
                      type="button"
                      size="sm"
                      variant={tipoFiltro === t ? "default" : "outline"}
                      onClick={() => setTipoFiltro(t)}
                    >
                      {TIPO_LABEL[t]}s <span className="ml-1 opacity-70">({count})</span>
                    </Button>
                  );
                })}
              </div>
              <div className="border rounded-md">
                {loadingDocs && (
                  <div className="p-6 text-sm text-center text-muted-foreground">Cargando documentos...</div>
                )}
                {!loadingDocs && docs.filter((d) => d.tipo_documento === tipoFiltro).length === 0 && (
                  <div className="p-6 text-sm text-center text-muted-foreground">No hay {TIPO_LABEL[tipoFiltro].toLowerCase()}s para esta empresa</div>
                )}
                {!loadingDocs && docs.filter((d) => d.tipo_documento === tipoFiltro).length > 0 && (
                  <ScrollArea className="h-48">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/50 border-b">
                        <tr className="text-left">
                          <th className="p-2 w-8"></th>
                          <th className="p-2">Folio</th>
                          <th className="p-2">Fecha</th>
                          <th className="p-2 text-right">Total</th>
                          <th className="p-2 text-right">Saldo</th>
                          <th className="p-2 text-right w-32">Aplicar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docs.filter((d) => d.tipo_documento === tipoFiltro).map((d) => {
                          const checked = seleccion[d.id] !== undefined;
                          return (
                            <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="p-2">
                                <Checkbox checked={checked} onCheckedChange={(v) => toggleDoc(d, !!v)} />
                              </td>
                              <td className="p-2 font-mono text-xs">{d.numero}</td>
                              <td className="p-2 text-xs">{formatDate(d.fecha_documento)}</td>
                              <td className="p-2 text-right">{formatCurrency(d.total)}</td>
                              <td className="p-2 text-right font-medium">{formatCurrency(d.saldo)}</td>
                              <td className="p-2 text-right">
                                <Input
                                  type="number"
                                  step="0.01"
                                  disabled={!checked}
                                  value={seleccion[d.id] ?? ""}
                                  onChange={(e) => setSeleccion((p) => ({ ...p, [d.id]: e.target.value }))}
                                  className="h-8 text-right"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </ScrollArea>
                )}
              </div>
            </div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:max-w-2xl">
            <div>
              <Label>Forma de pago *</Label>
              <SearchableSelect
                value={formaPago}
                onValueChange={(v) => {
                  setFormaPagoTocada(true);
                  setFormaPago(v);
                }}
                options={FORMA_PAGO_OPTIONS}
                placeholder="Selecciona forma de pago..."
              />
            </div>
            <div>
              <Label>Método de pago *</Label>
              <SearchableSelect
                value={metodoPago}
                onValueChange={setMetodoPago}
                options={METODO_PAGO_OPTIONS}
                placeholder="Selecciona método..."
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button onClick={handleCrearPago} disabled={saving || savingEnviar}>
              {saving ? "Creando..." : "Crear pago"}
            </Button>
            <Button onClick={handleGuardarYEnviar} disabled={saving || savingEnviar || !formaPago}>
              {savingEnviar ? "Enviando..." : "Guardar y Enviar por Correo"}
            </Button>
            <Button variant="ghost" onClick={handleDescartar} disabled={saving || savingEnviar}>
              <Trash2 className="h-4 w-4 mr-1" /> Descartar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    <EnviarConfirmacionPagoDialog
      open={openPreview}
      onOpenChange={setOpenPreview}
      pagoId={previewPagoId || ""}
      empresa={previewFlow?.empresaNombre || ""}
      fechaPago={previewFlow?.fechaPagoFormateada || fecha}
      montoTotal={previewFlow?.montoTotalFormateado || ""}
      moneda={previewFlow?.moneda || "MXN"}
      observaciones={previewFlow?.observaciones}
      documentos={previewFlow?.documentosLigados || []}
      comprobantes={previewFlow?.comprobantes || []}
      registradoPor={user?.email || undefined}
      defaultEmails={previewFlow?.defaultEmails || []}
      blockedEmails={previewFlow?.blockedEmails || []}
      previouslySentEmails={previewFlow?.previouslySentEmails || []}
      templateName={previewFlow?.templateName}
      subjectOverride={previewFlow?.subjectOverride}
      htmlOverride={previewFlow?.htmlOverride}
      ccEmails={previewFlow?.cc}
      bccEmails={previewFlow?.bcc}
      replyTo={previewFlow?.replyTo}
      title={previewFlow?.title}
      description={previewFlow?.description}
      logContext={{ user_id: user?.id || null, company_id: empresaId || null }}
      onSent={async () => {
        if (previewPagoId) {
          await supabase
            .from("cobranza_pagos")
            .update({ estatus_pago: "enviado_validar" as any })
            .eq("id", previewPagoId);
        }
        toast.success("Pago enviado a validar");
        onDone();
        navigate(
          `/cobranza/${empresaVendedora === "galsa_phillips66" ? "phillips66" : "chevron"}?pagoId=${previewPagoId}`
        );
      }}
    />
    </>
  );
}

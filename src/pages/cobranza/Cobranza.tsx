import { useMemo, useState } from "react";
import { useSearchParams, useNavigate, useParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BackButton } from "@/components/BackButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Wallet, AlertTriangle, CheckCircle2, Clock, Eye, X, Paperclip, FileText, Image as ImageIcon, ExternalLink, Trash2, ArrowLeft, Mail, Pencil, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Calendar as CalendarIcon, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Label } from "@/components/ui/label";
import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PageBanner } from "@/components/PageBanner";
import { openDocFilesSignedUrl, extractDocFilesPath } from "@/lib/storageSignedUrl";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useCobranzaPagos, useDocumentosCobranza, useCobranzaAplicaciones, type CobranzaPago } from "@/hooks/useCobranza";
import { RegistrarPagoDialog } from "@/components/cobranza/RegistrarPagoDialog";
import { AplicarPagoDialog } from "@/components/cobranza/AplicarPagoDialog";
import { EnviarConfirmacionPagoDialog } from "@/components/cobranza/EnviarConfirmacionPagoDialog";
import { ColumnFilterBuilder, evaluateConditions, type ColumnFilterCondition, type ColumnFilterDef } from "@/components/cobranza/ColumnFilterBuilder";
import { FacturasListEmbedded, type CobranzaPrefilter, type DaysBucket } from "@/components/cobranza/FacturasListEmbedded";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { renderTemplate, resolveEmailRecipients, type EmailRecipientItem } from "@/lib/templates";

const FORMA_PAGO_TPL_LABEL: Record<string, string> = {
  contado: "Contado",
  credito: "Crédito Directo",
  credito_cescemex: "Crédito Cescemex",
};

function tipoPagoLabel(value: string | null | undefined): string {
  const v = (value || "").toLowerCase();
  if (!v) return "—";
  if (v === "contado") return "Contado";
  if (v === "credito_cescemex" || v.includes("cescemex")) return "Crédito Cescemex";
  if (v === "credito" || v.includes("directo")) return "Crédito Directo";
  return FORMA_PAGO_TPL_LABEL[v] || value || "—";
}

async function loadSystemTemplate(systemKey: string): Promise<{
  subject: string;
  body: string;
  to_emails: EmailRecipientItem[];
  cc_emails: EmailRecipientItem[];
  bcc_emails: EmailRecipientItem[];
  reply_to: string | null;
} | null> {
  const { data } = await (supabase as any)
    .from("templates")
    .select("subject, body, to_emails, cc_emails, bcc_emails, reply_to")
    .eq("system_key", systemKey)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!data || !data.body) return null;
  return {
    subject: data.subject || "",
    body: data.body,
    to_emails: (data.to_emails as EmailRecipientItem[]) || [],
    cc_emails: (data.cc_emails as EmailRecipientItem[]) || [],
    bcc_emails: (data.bcc_emails as EmailRecipientItem[]) || [],
    reply_to: data.reply_to || null,
  };
}

const ESTADO_PAGO_LABEL: Record<string, string> = {
  registrado: "Registrado",
  no_aplicado: "No aplicado",
  aplicado_parcial: "Parcial",
  aplicado_total: "Aplicado",
  cancelado: "Cancelado",
};

const ESTATUS_PAGO_LABEL: Record<string, string> = {
  recibido: "Recibido",
  enviado_validar: "Enviado a Validar",
  validado: "Validado",
  aplicado: "Aplicado",
};

const ESTATUS_PAGO_OPTIONS = [
  { value: "recibido", label: "Recibido" },
  { value: "enviado_validar", label: "Enviado a Validar" },
  { value: "validado", label: "Validado" },
  { value: "aplicado", label: "Aplicado" },
];

function EstatusPagoEditor({
  pagoId,
  value,
  canEdit,
  compact = false,
  onChanged,
}: {
  pagoId: string;
  value: string;
  canEdit: boolean;
  compact?: boolean;
  onChanged?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  if (!canEdit) {
    return <Badge variant="outline">{ESTATUS_PAGO_LABEL[value] || value}</Badge>;
  }
  const handleChange = async (next: string) => {
    if (next === value) return;
    setSaving(true);
    const { error } = await supabase
      .from("cobranza_pagos")
      .update({ estatus_pago: next as any })
      .eq("id", pagoId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Estatus actualizado");
    onChanged?.();
  };
  return (
    <Select value={value} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger className={compact ? "h-7 text-xs px-2 w-[150px]" : "h-8 w-[180px]"} onClick={(e) => e.stopPropagation()}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ESTATUS_PAGO_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const FORMA_PAGO_LABEL: Record<string, string> = {
  contado: "Contado",
  credito: "Crédito Directo",
  credito_cescemex: "Crédito Cescemex",
};

const ESTADO_COBRANZA_LABEL: Record<string, string> = {
  pendiente: "Vigente",
  vigente: "Vigente",
  parcial: "Parcial",
  pagada: "Pagada",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

const ESTADO_COBRANZA_BADGE_CLASS: Record<string, string> = {
  pendiente: "bg-blue-500 text-white hover:bg-blue-500/90 border-transparent",
  vigente: "bg-blue-500 text-white hover:bg-blue-500/90 border-transparent",
  parcial: "bg-amber-500 text-white hover:bg-amber-500/90 border-transparent",
  pagada: "bg-green-600 text-white hover:bg-green-600/90 border-transparent",
  vencida: "bg-red-600 text-white hover:bg-red-600/90 border-transparent",
  cancelada: "bg-gray-400 text-white hover:bg-gray-400/90 border-transparent",
};

function EstadoCobranzaBadge({ value }: { value: string | null | undefined }) {
  const key = (value || "vigente").toLowerCase();
  const label = ESTADO_COBRANZA_LABEL[key] || "Vigente";
  const cls = ESTADO_COBRANZA_BADGE_CLASS[key] || ESTADO_COBRANZA_BADGE_CLASS.vigente;
  return <Badge className={cls}>{label}</Badge>;
}

function diasParaVencer(fechaVenc: string | null): number | null {
  if (!fechaVenc) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const v = new Date(fechaVenc); v.setHours(0, 0, 0, 0);
  return Math.round((v.getTime() - hoy.getTime()) / 86400000);
}

/**
 * Calcula la fecha de vencimiento efectiva a partir de la fecha de emisión
 * y el tipo de pago. Contado = mismo día; Crédito y Crédito Cescemex = +30 días.
 * Si no hay tipo_pago se usa la fecha_vencimiento almacenada.
 */
function fechaVencimientoEfectiva(f: { fecha_documento?: string | null; fecha_vencimiento?: string | null; tipo_pago?: string | null }): string | null {
  const tp = (f.tipo_pago || "").toLowerCase();
  if (!f.fecha_documento) return f.fecha_vencimiento ?? null;
  if (tp === "contado") return f.fecha_documento;
  if (tp === "credito" || tp === "credito_directo" || tp === "credito_cescemex" || tp.includes("credito") || tp.includes("cescemex")) {
    const d = new Date(f.fecha_documento + "T12:00:00");
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }
  return f.fecha_vencimiento ?? null;
}

function bucketLabel(dias: number | null): string {
  if (dias === null) return "Sin vencimiento";
  if (dias < 0) return "Vencidas";
  if (dias === 0) return "Vencen hoy";
  if (dias <= 5) return "1-5 días";
  if (dias <= 10) return "6-10 días";
  if (dias <= 20) return "11-20 días";
  if (dias <= 30) return "21-30 días";
  return "Más de 30 días";
}

function bucketLabelToBucket(label: string): DaysBucket | undefined {
  switch (label) {
    case "Vencidas": return "vencidas";
    case "Vencen hoy": return "hoy";
    case "1-5 días": return "1-5";
    case "6-10 días": return "6-10";
    case "11-20 días": return "11-20";
    case "21-30 días": return "21-30";
    case "Más de 30 días": return "+30";
    default: return undefined;
  }
}

export default function Cobranza() {
  const { hasAnyRole, profile } = useAuth();
  const { brand } = useParams<{ brand: string }>();
  const invalidBrand = !!brand && brand !== "chevron" && brand !== "phillips66";
  const empresaVendedora: "lumaggs_chevron" | "galsa_phillips66" =
    brand === "phillips66" ? "galsa_phillips66" : "lumaggs_chevron";
  const brandTitle = brand === "phillips66" ? "Cobranza — Phillips 66" : "Cobranza — Chevron";
  const brandSubtitle = brand === "phillips66" ? "Galsa" : "Lumaggs";

  const isAdminOrManager = hasAnyRole(["admin", "manager", "accounting"]);
  const [selectedPlazaId, setSelectedPlazaId] = useState<string>(
    !isAdminOrManager && profile?.plaza_id ? profile.plaza_id : (profile?.plaza_id || "all")
  );
  const effectivePlazaId = !isAdminOrManager && profile?.plaza_id ? profile.plaza_id : selectedPlazaId;

  const { data: plazasList = [] } = useQuery({
    queryKey: ["cobranza-plazas-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre");
      return data || [];
    },
  });

  const navigate = useNavigate();
  const canDelete = hasAnyRole(["admin", "manager"]);
  const canEditEstatus = hasAnyRole(["admin", "manager", "accounting"]);
  const filterArgs = {
    empresaVendedora,
    plazaId: effectivePlazaId && effectivePlazaId !== "all" ? effectivePlazaId : null,
  };
  const { pagos, breakdowns, loading: loadingPagos, refetch: refetchPagos } = useCobranzaPagos(filterArgs);
  const { documentos, loading: loadingDocs, refetch: refetchDocs } = useDocumentosCobranza(filterArgs);

  if (invalidBrand) return <Navigate to="/cobranza" replace />;

  const [openRegistrar, setOpenRegistrar] = useState(false);
  const [openAplicar, setOpenAplicar] = useState(false);
  const [pagoSel, setPagoSel] = useState<CobranzaPago | null>(null);
  const [openDetalle, setOpenDetalle] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [pendingDetalleId, setPendingDetalleId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const fromSellerPortal = searchParams.get("from") === "seller-portal";

  // Deep link: open pago detail when ?pagoId=... is present
  useEffect(() => {
    const pid = searchParams.get("pagoId");
    if (!pid) return;
    setActiveTab("pagos");
    setPendingDetalleId(pid);
    // Clear param so the detail can be reopened by visiting again
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("pagoId");
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  const [searchPagos, setSearchPagos] = useState("");
  const [pagosSortKey, setPagosSortKey] = useState<string | null>(null);
  const [pagosSortDir, setPagosSortDir] = useState<"asc" | "desc">("asc");
  const togglePagosSort = (key: string) => {
    if (pagosSortKey === key) setPagosSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setPagosSortKey(key); setPagosSortDir("asc"); }
  };
  const [proxSortKey, setProxSortKey] = useState<string | null>(null);
  const [proxSortDir, setProxSortDir] = useState<"asc" | "desc" | null>(null);
  const toggleProxSort = (key: string) => {
    if (proxSortKey !== key) { setProxSortKey(key); setProxSortDir("asc"); return; }
    if (proxSortDir === "asc") setProxSortDir("desc");
    else if (proxSortDir === "desc") { setProxSortKey(null); setProxSortDir(null); }
    else setProxSortDir("asc");
  };
  const [searchFacturas, setSearchFacturas] = useState("");
  const [bucketSel, setBucketSel] = useState<{ label: string; scope: "all" | "credito" | "credito_cescemex" } | null>(null);
  const [facturasPrefilter, setFacturasPrefilter] = useState<"none" | "vencimiento" | "credito_directo" | "credito_cescemex">("none");
  const PREFILTER_LABEL: Record<typeof facturasPrefilter, string> = {
    none: "Todas",
    vencimiento: "Vencimiento",
    credito_directo: "Crédito Directo",
    credito_cescemex: "Crédito Cescemex",
  } as const;

  // Filtros por columna
  const [pagosConditions, setPagosConditions] = useState<ColumnFilterCondition[]>([]);
  const [pagosCombinator, setPagosCombinator] = useState<"AND" | "OR">("AND");
  const [facturasConditions, setFacturasConditions] = useState<ColumnFilterCondition[]>([]);
  const [facturasCombinator, setFacturasCombinator] = useState<"AND" | "OR">("AND");

  const pagosColumns: ColumnFilterDef[] = useMemo(() => [
    { key: "fecha_pago", label: "Fecha", type: "date" },
    { key: "empresa", label: "Cliente", type: "text" },
    { key: "plaza", label: "Plaza", type: "text" },
    { key: "referencia_pago", label: "Referencia", type: "text" },
    { key: "banco", label: "Banco", type: "text" },
    { key: "monto_total", label: "Total", type: "number" },
    { key: "aplicado_facturas", label: "Aplicado a Facturas", type: "number" },
    { key: "aplicado_otros", label: "Aplicado a Cot/Pedidos", type: "number" },
    { key: "disponible_facturas", label: "Disponible (facturas)", type: "number" },
    { key: "tipo_pago", label: "Forma", type: "select", options: [
      { value: "contado", label: "Contado" },
      { value: "credito", label: "Crédito Directo" },
      { value: "credito_cescemex", label: "Crédito Cescemex" },
    ]},
    { key: "estatus_pago", label: "Estatus Pago", type: "select", options: ESTATUS_PAGO_OPTIONS },
    { key: "estado_pago", label: "Estado", type: "select", options: [
      { value: "registrado", label: "Registrado" },
      { value: "no_aplicado", label: "No aplicado" },
      { value: "aplicado_parcial", label: "Parcial" },
      { value: "aplicado_total", label: "Aplicado" },
      { value: "cancelado", label: "Cancelado" },
    ]},
  ], []);

  const facturasColumns: ColumnFilterDef[] = useMemo(() => [
    { key: "numero_factura", label: "Folio", type: "text" },
    { key: "empresa", label: "Cliente", type: "text" },
    { key: "plaza", label: "Plaza", type: "text" },
    { key: "fecha_documento", label: "Emisión", type: "date" },
    { key: "fecha_vencimiento", label: "Vence", type: "date" },
    { key: "dias", label: "Días para vencer", type: "number" },
    { key: "total", label: "Total", type: "number" },
    { key: "saldo_pendiente_cobranza", label: "Saldo", type: "number" },
    { key: "tipo_pago", label: "Forma", type: "select", options: [
      { value: "contado", label: "Contado" },
      { value: "credito", label: "Crédito Directo" },
      { value: "credito_cescemex", label: "Crédito Cescemex" },
    ]},
    { key: "estado_cobranza", label: "Estado", type: "select", options: [
      { value: "pendiente", label: "Pendiente" },
      { value: "parcial", label: "Parcial" },
      { value: "pagada", label: "Pagada" },
      { value: "vencida", label: "Vencida" },
      { value: "cancelada", label: "Cancelada" },
    ]},
  ], []);

  // Dataset unificado: solo facturas activas con saldo pendiente, excluye canceladas y pagadas.
  // Esta es la MISMA fuente que usa "Seguimiento de Facturas" y todas las KPI cards.
  const facturas = useMemo(() => documentos.filter((d) => {
    if (d.tipo_documento !== "factura") return false;
    const ef = (d.estatus_factura || "").toString().toLowerCase();
    if (ef === "cancelada" || ef === "pagada") return false;
    if (Number(d.saldo_pendiente_cobranza || 0) <= 0) return false;
    return true;
  }), [documentos]);

  // Helpers de clasificación compartidos
  const isVencida = (f: typeof facturas[number]) => {
    const fv = fechaVencimientoEfectiva(f);
    if (!fv) return false;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const v = new Date(fv); v.setHours(0, 0, 0, 0);
    return v.getTime() < hoy.getTime();
  };
  const isCreditoDirecto = (f: typeof facturas[number]) => (f.tipo_pago || "").toLowerCase().includes("directo") || f.tipo_pago === "credito";
  const isCreditoCescemex = (f: typeof facturas[number]) => (f.tipo_pago || "").toLowerCase().includes("cescemex") || f.tipo_pago === "credito_cescemex";

  const facturasVencidasKpi = useMemo(() => facturas.filter(isVencida), [facturas]);
  const facturasCreditoDirectoKpi = useMemo(() => facturas.filter(isCreditoDirecto), [facturas]);
  const facturasCreditoCescemexKpi = useMemo(() => facturas.filter(isCreditoCescemex), [facturas]);

  const sumSaldo = (arr: typeof facturas) => arr.reduce((s, f) => s + Number(f.saldo_pendiente_cobranza || 0), 0);

  // KPIs
  const cartera = useMemo(() => {
    const abierta = facturas.reduce((s, f) => s + Number(f.saldo_pendiente_cobranza || 0), 0);
    const vencida = facturas.filter((f) => {
      const d = diasParaVencer(fechaVencimientoEfectiva(f));
      return d !== null && d < 0 && Number(f.saldo_pendiente_cobranza) > 0;
    }).reduce((s, f) => s + Number(f.saldo_pendiente_cobranza), 0);
    const porVencer = abierta - vencida;
    const noAplicado = pagos.filter((p) => p.estado_pago !== "cancelado").reduce((s, p) => s + (breakdowns[p.id]?.disponibleFacturas ?? Number(p.monto_disponible)), 0);
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    const cobradoMes = pagos.filter((p) => p.estado_pago !== "cancelado" && new Date(p.fecha_pago) >= inicioMes)
      .reduce((s, p) => s + Number(p.monto_total), 0);
    const facturasParciales = facturas.filter((f) => f.estado_cobranza === "parcial").length;
    const facturasPagadas = facturas.filter((f) => f.estado_cobranza === "pagada").length;
    return { abierta, vencida, porVencer, noAplicado, cobradoMes, facturasParciales, facturasPagadas };
  }, [facturas, pagos, breakdowns]);

  // Buckets de vencimiento (helper reusable)
  const buildBuckets = (lista: typeof facturas) => {
    const orden = ["Vencidas", "Vencen hoy", "1-5 días", "6-10 días", "11-20 días", "21-30 días", "Más de 30 días"];
    const acc: Record<string, { count: number; monto: number }> = {};
    orden.forEach((b) => acc[b] = { count: 0, monto: 0 });
    lista.forEach((f) => {
      if (Number(f.saldo_pendiente_cobranza) <= 0) return;
      const lbl = bucketLabel(diasParaVencer(fechaVencimientoEfectiva(f)));
      if (acc[lbl]) { acc[lbl].count++; acc[lbl].monto += Number(f.saldo_pendiente_cobranza); }
    });
    return orden.map((b) => ({ label: b, ...acc[b] }));
  };

  const buckets = useMemo(() => buildBuckets(facturas), [facturas]);
  const bucketsCreditoDirecto = useMemo(() => buildBuckets(facturasCreditoDirectoKpi), [facturasCreditoDirectoKpi]);
  const bucketsCreditoCescemex = useMemo(() => buildBuckets(facturasCreditoCescemexKpi), [facturasCreditoCescemexKpi]);

  const proximasVencer = useMemo(() => {
    return [...facturas]
      .filter((f) => Number(f.saldo_pendiente_cobranza) > 0 && fechaVencimientoEfectiva(f))
      .sort((a, b) => new Date(fechaVencimientoEfectiva(a)!).getTime() - new Date(fechaVencimientoEfectiva(b)!).getTime())
      .slice(0, 8);
  }, [facturas]);

  const pagosNoAplicados = useMemo(
    () => pagos.filter((p) => p.estado_pago !== "cancelado" && (breakdowns[p.id]?.disponibleFacturas ?? p.monto_disponible) > 0).slice(0, 10),
    [pagos, breakdowns]
  );

  const carteraPorPlaza = useMemo(() => {
    const map = new Map<string, number>();
    facturas.forEach((f) => {
      const k = f.plaza?.nombre || "Sin plaza";
      map.set(k, (map.get(k) || 0) + Number(f.saldo_pendiente_cobranza));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [facturas]);

  // Filtros listados
  const pagosFiltrados = useMemo(() => {
    const q = searchPagos.toLowerCase();
    const base = pagos.filter((p) =>
      !q || p.empresa?.name?.toLowerCase().includes(q) || p.referencia_pago?.toLowerCase().includes(q)
    );
    const filtered = evaluateConditions(base, pagosConditions, pagosCombinator, (p, key) => {
      const b = breakdowns[p.id];
      switch (key) {
        case "fecha_pago": return p.fecha_pago;
        case "empresa": return p.empresa?.name || "";
        case "plaza": return p.plaza?.nombre || "";
        case "referencia_pago": return p.referencia_pago || "";
        case "banco": return p.banco || "";
        case "monto_total": return Number(p.monto_total);
        case "aplicado_facturas": return b?.aplicadoFacturas ?? 0;
        case "aplicado_otros": return b?.aplicadoOtros ?? 0;
        case "disponible_facturas": return b?.disponibleFacturas ?? Number(p.monto_disponible);
        case "tipo_pago": return p.tipo_pago || "";
        case "estatus_pago": return p.estatus_pago;
        case "estado_pago": return p.estado_pago;
        default: return "";
      }
    });
    if (!pagosSortKey) return filtered;
    const getVal = (p: any) => {
      const b = breakdowns[p.id];
      switch (pagosSortKey) {
        case "fecha_pago": return p.fecha_pago || "";
        case "empresa": return p.empresa?.name || "";
        case "plaza": return p.plaza?.nombre || "";
        case "monto_total": return Number(p.monto_total) || 0;
        case "aplicado_facturas": return b?.aplicadoFacturas ?? 0;
        case "aplicado_otros": return b?.aplicadoOtros ?? 0;
        case "disponible_facturas": return b?.disponibleFacturas ?? Number(p.monto_disponible) ?? 0;
        case "tipo_pago": return FORMA_PAGO_LABEL[p.tipo_pago || ""] || p.tipo_pago || "";
        case "estatus_pago": return p.estatus_pago || "";
        case "estado_pago": return p.estado_pago || "";
        default: return "";
      }
    };
    const sorted = [...filtered].sort((a, b) => {
      const va = getVal(a); const vb = getVal(b);
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb), "es", { numeric: true });
    });
    return pagosSortDir === "desc" ? sorted.reverse() : sorted;
  }, [pagos, searchPagos, pagosConditions, pagosCombinator, breakdowns, pagosSortKey, pagosSortDir]);

  const facturasFiltradas = useMemo(() => {
    const q = searchFacturas.toLowerCase();
    const prefiltered = facturas.filter((f) => {
      if (facturasPrefilter === "vencimiento") return isVencida(f);
      if (facturasPrefilter === "credito_directo") return isCreditoDirecto(f);
      if (facturasPrefilter === "credito_cescemex") return isCreditoCescemex(f);
      return true;
    });
    const base = prefiltered.filter((f) =>
      !q || f.empresa?.name?.toLowerCase().includes(q) || f.numero_factura?.toLowerCase().includes(q)
    );
    return evaluateConditions(base, facturasConditions, facturasCombinator, (f, key) => {
      switch (key) {
        case "numero_factura": return f.numero_factura || "";
        case "empresa": return f.empresa?.name || "";
        case "plaza": return f.plaza?.nombre || "";
        case "fecha_documento": return f.fecha_documento;
        case "fecha_vencimiento": return fechaVencimientoEfectiva(f);
        case "dias": return diasParaVencer(fechaVencimientoEfectiva(f));
        case "total": return Number(f.total);
        case "saldo_pendiente_cobranza": return Number(f.saldo_pendiente_cobranza);
        case "tipo_pago": return f.tipo_pago || "";
        case "estado_cobranza": return f.estado_cobranza || "pendiente";
        default: return "";
      }
    }).sort((a, b) => {
      const afv = fechaVencimientoEfectiva(a);
      const bfv = fechaVencimientoEfectiva(b);
      const av = afv ? new Date(afv).getTime() : Infinity;
      const bv = bfv ? new Date(bfv).getTime() : Infinity;
      return av - bv;
    });
  }, [facturas, searchFacturas, facturasConditions, facturasCombinator, facturasPrefilter]);

  const handleAplicar = (p: CobranzaPago) => { setPagoSel(p); setOpenAplicar(true); };
  const handleVerDetalle = (p: CobranzaPago) => { setPagoSel(p); setOpenDetalle(true); };

  useEffect(() => {
    if (!pendingDetalleId) return;
    const found = pagos.find((p) => p.id === pendingDetalleId);
    if (found) {
      setPagoSel(found);
      setOpenDetalle(true);
      setPendingDetalleId(null);
    }
  }, [pendingDetalleId, pagos]);

  const handleCancelarPago = async (p: CobranzaPago) => {
    if (!confirm("¿Cancelar este pago? Se revertirán todas sus aplicaciones.")) return;
    // Cancelar aplicaciones activas
    await supabase.from("cobranza_aplicaciones")
      .update({ estatus_aplicacion: "cancelada" })
      .eq("pago_id", p.id)
      .eq("estatus_aplicacion", "activa");
    const { error } = await supabase.from("cobranza_pagos").update({ estado_pago: "cancelado" }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pago cancelado");
    refetchPagos(); refetchDocs();
  };

  const handleEliminarPago = async (p: CobranzaPago) => {
    if (!confirm("¿Eliminar permanentemente este pago? Se eliminarán también sus aplicaciones y archivos. Esta acción no se puede deshacer.")) return;
    const docIds = Array.from(new Set(((await supabase.from("cobranza_aplicaciones").select("documento_id").eq("pago_id", p.id)).data || []).map((a: any) => a.documento_id)));
    await supabase.from("cobranza_aplicaciones").delete().eq("pago_id", p.id);
    await supabase.from("cobranza_pago_archivos").delete().eq("pago_id", p.id);
    const { error } = await supabase.from("cobranza_pagos").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    for (const docId of docIds) {
      await supabase.rpc("recompute_documento_cobranza", { _documento_id: docId });
    }
    toast.success("Pago eliminado");
    refetchPagos(); refetchDocs();
  };

  return (
    <div className="space-y-6">
      {fromSellerPortal && (
        <Button variant="ghost" size="sm" onClick={() => navigate("/seller-portal")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver al Portal del Vendedor
        </Button>
      )}
      <PageBanner
        title={brandTitle}
        description={brandSubtitle}
        avatar={<div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Wallet className="h-5 w-5" /></div>}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BackButton fallback="/cobranza" />
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Plaza</Label>
            <Select
              value={effectivePlazaId || "all"}
              onValueChange={(v) => setSelectedPlazaId(v)}
              disabled={!isAdminOrManager && !!profile?.plaza_id}
            >
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue placeholder="Todas las plazas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las plazas</SelectItem>
                {plazasList.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={() => setOpenRegistrar(true)}>
          <Plus className="h-4 w-4 mr-2" /> Registrar pago
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="facturas">Seguimiento de facturas</TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6">
          {bucketSel ? (
            <BucketDetalle
              label={bucketSel.label}
              scopeLabel={bucketSel.scope === "credito" ? "Crédito Directo" : bucketSel.scope === "credito_cescemex" ? "Crédito Cescemex" : "Todas las facturas"}
              empresaVendedora={empresaVendedora}
              plazaId={effectivePlazaId && effectivePlazaId !== "all" ? effectivePlazaId : null}
              prefilter={bucketSel.scope === "credito" ? "credito_directo" : bucketSel.scope === "credito_cescemex" ? "credito_cescemex" : "none"}
              daysBucket={bucketLabelToBucket(bucketSel.label)}
              onBack={() => setBucketSel(null)}
            />
          ) : (
          <>
          {/* KPIs unificadas — clic abre Seguimiento prefiltrado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UnifiedKpiCard
              title="Vencimiento"
              count={facturasVencidasKpi.length}
              total={sumSaldo(facturasVencidasKpi)}
              icon={AlertTriangle}
              variant="destructive"
              onClick={() => { setFacturasPrefilter("vencimiento"); setActiveTab("facturas"); }}
            />
            <UnifiedKpiCard
              title="Crédito Directo"
              count={facturasCreditoDirectoKpi.length}
              total={sumSaldo(facturasCreditoDirectoKpi)}
              icon={Wallet}
              onClick={() => { setFacturasPrefilter("credito_directo"); setActiveTab("facturas"); }}
            />
            <UnifiedKpiCard
              title="Crédito Cescemex"
              count={facturasCreditoCescemexKpi.length}
              total={sumSaldo(facturasCreditoCescemexKpi)}
              icon={Wallet}
              onClick={() => { setFacturasPrefilter("credito_cescemex"); setActiveTab("facturas"); }}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard title="Cartera abierta" value={formatCurrency(cartera.abierta)} icon={Wallet} />
            <KpiCard title="Cartera vencida" value={formatCurrency(cartera.vencida)} icon={AlertTriangle} variant="destructive" />
            <KpiCard title="Por vencer" value={formatCurrency(cartera.porVencer)} icon={Clock} />
            <KpiCard title="Cobrado del mes" value={formatCurrency(cartera.cobradoMes)} icon={CheckCircle2} variant="success" />
            <KpiCard title="Pagos no aplicados" value={formatCurrency(cartera.noAplicado)} icon={Wallet} />
            <KpiCard title="Facturas parciales" value={String(cartera.facturasParciales)} icon={Clock} />
            <KpiCard title="Facturas pagadas" value={String(cartera.facturasPagadas)} icon={CheckCircle2} variant="success" />
            <KpiCard title="Total pagos" value={String(pagos.length)} icon={Wallet} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <BucketReportCard title="Vencimientos" buckets={buckets} onSelect={(label) => setBucketSel({ label, scope: "all" })} />
            <BucketReportCard title="Crédito Directo" buckets={bucketsCreditoDirecto} onSelect={(label) => setBucketSel({ label, scope: "credito" })} />
            <BucketReportCard title="Crédito Cescemex" buckets={bucketsCreditoCescemex} onSelect={(label) => setBucketSel({ label, scope: "credito_cescemex" })} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Cartera por plaza</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Plaza</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {carteraPorPlaza.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Sin datos</TableCell></TableRow>}
                    {carteraPorPlaza.map(([plaza, monto]) => (
                      <TableRow key={plaza}><TableCell>{plaza}</TableCell><TableCell className="text-right font-medium">{formatCurrency(monto)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Próximas facturas a vencer</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    {([
                      ["folio", "Folio", ""],
                      ["cliente", "Cliente", ""],
                      ["vence", "Vence", ""],
                      ["saldo", "Saldo", "text-right"],
                    ] as const).map(([key, label, align]) => {
                      const active = proxSortKey === key;
                      const Icon = !active ? ArrowUpDown : proxSortDir === "asc" ? ArrowUp : ArrowDown;
                      return (
                        <TableHead key={key} className={align}>
                          <button
                            type="button"
                            onClick={() => toggleProxSort(key)}
                            className={`inline-flex items-center gap-1 hover:text-foreground ${align === "text-right" ? "ml-auto" : ""} ${active ? "text-foreground font-semibold" : ""}`}
                          >
                            {label}
                            <Icon className="h-3.5 w-3.5 opacity-70" />
                          </button>
                        </TableHead>
                      );
                    })}
                    <TableHead className="w-10"></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {proximasVencer.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin facturas pendientes</TableCell></TableRow>}
                    {(() => {
                      if (!proxSortKey || !proxSortDir) return proximasVencer;
                      const getVal = (f: any) => {
                        switch (proxSortKey) {
                          case "folio": return f.numero_factura || "";
                          case "cliente": return f.empresa?.name || "";
                          case "vence": return fechaVencimientoEfectiva(f) || "";
                          case "saldo": return Number(f.saldo_pendiente_cobranza) || 0;
                          default: return "";
                        }
                      };
                      const sorted = [...proximasVencer].sort((a, b) => {
                        const va = getVal(a); const vb = getVal(b);
                        if (typeof va === "number" && typeof vb === "number") return va - vb;
                        return String(va).localeCompare(String(vb), "es", { numeric: true });
                      });
                      return proxSortDir === "desc" ? sorted.reverse() : sorted;
                    })().map((f) => {
                      const d = diasParaVencer(fechaVencimientoEfectiva(f));
                      return (
                        <TableRow key={f.id}>
                          <TableCell className="font-mono text-xs">{f.numero_factura || "—"}</TableCell>
                          <TableCell className="truncate max-w-[160px]">{f.empresa?.name}</TableCell>
                          <TableCell>
                            <span className={d !== null && d < 0 ? "text-destructive font-medium" : ""}>
                              {fechaVencimientoEfectiva(f) ? formatDate(fechaVencimientoEfectiva(f)!) : "—"}
                              {d !== null && <span className="text-xs text-muted-foreground ml-1">({d}d)</span>}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(f.saldo_pendiente_cobranza))}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => window.open(`/documentos/${f.id}`, "_blank")} title="Abrir documento">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Pagos no aplicados</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Fecha</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right">Disponible</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {pagosNoAplicados.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Todos los pagos están aplicados</TableCell></TableRow>}
                    {pagosNoAplicados.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.fecha_pago)}</TableCell>
                        <TableCell className="truncate max-w-[160px]">{p.empresa?.name}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(breakdowns[p.id]?.disponibleFacturas ?? p.monto_disponible)}</TableCell>
                        <TableCell><Button size="sm" variant="outline" onClick={() => handleAplicar(p)}>Aplicar</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          </>
          )}
        </TabsContent>

        {/* PAGOS */}
        <TabsContent value="pagos" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Buscar por empresa o referencia..." value={searchPagos} onChange={(e) => setSearchPagos(e.target.value)} className="max-w-md" />
            <ColumnFilterBuilder
              columns={pagosColumns}
              conditions={pagosConditions}
              onChange={setPagosConditions}
              combinator={pagosCombinator}
              onCombinatorChange={setPagosCombinator}
            />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  {([
                    ["fecha_pago", "Fecha", ""],
                    ["empresa", "Cliente", ""],
                    ["plaza", "Plaza", ""],
                    ["monto_total", "Total", "text-right"],
                    ["aplicado_facturas", "Aplicado a Facturas", "text-right"],
                    ["aplicado_otros", "Aplicado a Cot/Pedidos", "text-right"],
                    ["disponible_facturas", "Disponible (facturas)", "text-right"],
                    ["tipo_pago", "Forma", ""],
                    ["estatus_pago", "Estatus Pago", ""],
                    ["estado_pago", "Estado", ""],
                  ] as const).map(([key, label, align]) => {
                    const active = pagosSortKey === key;
                    const Icon = !active ? ArrowUpDown : pagosSortDir === "asc" ? ArrowUp : ArrowDown;
                    return (
                      <TableHead key={key} className={align}>
                        <button
                          type="button"
                          onClick={() => togglePagosSort(key)}
                          className={`inline-flex items-center gap-1 hover:text-foreground ${align === "text-right" ? "ml-auto" : ""} ${active ? "text-foreground font-semibold" : ""}`}
                        >
                          {label}
                          <Icon className="h-3.5 w-3.5 opacity-70" />
                        </button>
                      </TableHead>
                    );
                  })}
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {loadingPagos && <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>}
                  {!loadingPagos && pagosFiltrados.length === 0 && <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Sin pagos registrados</TableCell></TableRow>}
                  {pagosFiltrados.map((p) => {
                    const b = breakdowns[p.id];
                    const aplicadoFact = b?.aplicadoFacturas ?? 0;
                    const aplicadoOtros = b?.aplicadoOtros ?? 0;
                    const dispFact = b?.disponibleFacturas ?? Number(p.monto_disponible);
                    return (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.fecha_pago)}</TableCell>
                      <TableCell className="truncate max-w-[200px]">{p.empresa?.name}</TableCell>
                      <TableCell>{p.plaza?.nombre || "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.monto_total)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(aplicadoFact)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{aplicadoOtros > 0 ? formatCurrency(aplicadoOtros) : "—"}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(dispFact)}</TableCell>
                      <TableCell className="text-xs">{FORMA_PAGO_LABEL[p.tipo_pago || ""] || p.tipo_pago || "—"}</TableCell>
                      <TableCell><EstatusPagoEditor pagoId={p.id} value={p.estatus_pago} canEdit={canEditEstatus} compact onChanged={refetchPagos} /></TableCell>
                      <TableCell><Badge variant={p.estado_pago === "aplicado_total" ? "default" : p.estado_pago === "cancelado" ? "destructive" : "secondary"}>{ESTADO_PAGO_LABEL[p.estado_pago]}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleVerDetalle(p)}><Eye className="h-4 w-4" /></Button>
                          {p.estado_pago !== "cancelado" && dispFact > 0 && (
                            <Button size="sm" variant="outline" onClick={() => handleAplicar(p)}>Aplicar</Button>
                          )}
                          {p.estado_pago !== "cancelado" && (
                            <Button size="sm" variant="ghost" onClick={() => handleCancelarPago(p)} title="Cancelar"><X className="h-4 w-4" /></Button>
                          )}
                          {canDelete && (
                            <Button size="sm" variant="ghost" onClick={() => handleEliminarPago(p)} title="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FACTURAS */}
        <TabsContent value="facturas" className="space-y-4">
          {facturasPrefilter !== "none" && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                Filtro: {PREFILTER_LABEL[facturasPrefilter]}
                <button type="button" onClick={() => setFacturasPrefilter("none")} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          )}
          <FacturasListEmbedded
            empresaVendedora={empresaVendedora}
            plazaId={effectivePlazaId && effectivePlazaId !== "all" ? effectivePlazaId : null}
            prefilter={
              facturasPrefilter === "vencimiento" ? "vencidas" :
              facturasPrefilter === "credito_directo" ? "credito_directo" :
              facturasPrefilter === "credito_cescemex" ? "credito_cescemex" : "none"
            }
          />
        </TabsContent>
      </Tabs>

      <RegistrarPagoDialog open={openRegistrar} onOpenChange={setOpenRegistrar} empresaVendedora={empresaVendedora} onSaved={(newId) => { refetchPagos(); refetchDocs(); if (newId) { setActiveTab("pagos"); setPendingDetalleId(newId); } }} />
      <AplicarPagoDialog open={openAplicar} onOpenChange={setOpenAplicar} pago={pagoSel} onSaved={() => { refetchPagos(); refetchDocs(); }} />
      <DetallePagoSheet
        open={openDetalle}
        onOpenChange={setOpenDetalle}
        pago={pagoSel ? (pagos.find((p) => p.id === pagoSel.id) || pagoSel) : null}
        onChanged={() => { refetchPagos(); refetchDocs(); }}
        onAplicar={(p) => { setOpenDetalle(false); handleAplicar(p); }}
      />
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, variant }: { title: string; value: string; icon: any; variant?: "destructive" | "success" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className={`text-xl font-bold mt-1 ${variant === "destructive" ? "text-destructive" : variant === "success" ? "text-primary" : ""}`}>{value}</p>
          </div>
          <Icon className={`h-8 w-8 ${variant === "destructive" ? "text-destructive/30" : "text-muted-foreground/30"}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function UnifiedKpiCard({
  title,
  count,
  total,
  icon: Icon,
  variant,
  onClick,
}: {
  title: string;
  count: number;
  total: number;
  icon: any;
  variant?: "destructive" | "success";
  onClick: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${variant === "destructive" ? "text-destructive" : ""}`}>
              {formatCurrency(total)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{count} facturas</p>
          </div>
          <Icon className={`h-8 w-8 shrink-0 ${variant === "destructive" ? "text-destructive/30" : "text-muted-foreground/30"}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function DetallePagoSheet({ open, onOpenChange, pago, onChanged, onAplicar }: { open: boolean; onOpenChange: (o: boolean) => void; pago: CobranzaPago | null; onChanged: () => void; onAplicar: (p: CobranzaPago) => void }) {
  const { user, profile, hasAnyRole } = useAuth();
  const canEditEstatus = hasAnyRole(["admin", "manager", "accounting"]);
  const { aplicaciones, refetch } = useCobranzaAplicaciones(pago?.id || null);
  const [openEnviar, setOpenEnviar] = useState(false);
  const [ccEmailsFlow, setCcEmailsFlow] = useState<string[]>([]);
  const [replyToFlow, setReplyToFlow] = useState<string | undefined>(undefined);
  const [defaultEmails, setDefaultEmails] = useState<string[]>([]);
  const [blockedEmails, setBlockedEmails] = useState<string[]>([]);
  const [comprobantes, setComprobantes] = useState<{ nombre: string; url: string }[]>([]);
  const [previouslySentEmails, setPreviouslySentEmails] = useState<string[]>([]);
  const [loadingEmails, setLoadingEmails] = useState<null | "contado" | "credito" | "credito_cescemex" | "general">(null);
  const [editandoFormaPago, setEditandoFormaPago] = useState(false);
  const [nuevaFormaPago, setNuevaFormaPago] = useState<string>(pago?.tipo_pago || "");
  const [nuevaPlazaId, setNuevaPlazaId] = useState<string>(pago?.plaza_id || "");
  const { data: plazasEdit = [] } = useQuery({
    queryKey: ["pago-edit-plazas"],
    queryFn: async () => {
      const { data } = await supabase.from("plazas").select("id,nombre").eq("is_active", true).order("nombre");
      return data || [];
    },
  });
  const [activeFlow, setActiveFlow] = useState<{
    templateName: string;
    title: string;
    description: string;
    formaPago?: string;
    subjectOverride?: string;
    htmlOverride?: string;
    cc?: string[];
    bcc?: string[];
    replyTo?: string | null;
  }>({ templateName: "pago-confirmation", title: "Enviar confirmación", description: "" });

  useEffect(() => {
    setNuevaFormaPago(pago?.tipo_pago || "");
    setNuevaPlazaId(pago?.plaza_id || "");
    setEditandoFormaPago(false);
  }, [pago?.id, pago?.tipo_pago, pago?.plaza_id]);

  const handleCancelarAplicacion = async (id: string) => {
    if (!confirm("¿Cancelar esta aplicación?")) return;
    const { error } = await supabase.from("cobranza_aplicaciones").update({ estatus_aplicacion: "cancelada" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Aplicación cancelada");
    refetch(); onChanged();
  };

  const loadEmailsAndOpen = async (
    flow: "contado" | "credito" | "credito_cescemex" | "general"
  ) => {
    if (!pago) return;
    setLoadingEmails(flow);
    const emails: string[] = [];
    const isValidacion = flow !== "general";

    // Empresa email
    const { data: emp } = await supabase.from("companies").select("email").eq("id", pago.empresa_id).maybeSingle();

    // Correos PROHIBIDOS para validación: empresa + contactos relacionados
    const blocked: string[] = [];
    if (isValidacion) {
      if (emp?.email) blocked.push(emp.email.toLowerCase());
      const { data: contactos } = await supabase
        .from("contacts").select("email").eq("company_id", pago.empresa_id);
      (contactos || []).forEach((c: any) => {
        if (c.email) {
          const e = c.email.toLowerCase();
          if (!blocked.includes(e)) blocked.push(e);
        }
      });
    } else {
      // Confirmación general (no validación) mantiene comportamiento previo
      if (emp?.email) emails.push(emp.email);
    }

    // Determinar grupo según flujo
    const groupName =
      flow === "contado" ? "Cobranza Contado" :
      flow === "credito" ? "Cobranza Crédito Directo" :
      flow === "credito_cescemex" ? "Cobranza Cescemex" :
      "Contabilidad";

    // 1) Parámetros del sistema (system_settings) — fuente principal
    const settingKey =
      flow === "contado" ? "destinatarios_default_contado" :
      flow === "credito" ? "destinatarios_default_credito_directo" :
      flow === "credito_cescemex" ? "destinatarios_default_credito_cescemex" :
      null;
    if (settingKey) {
      const { data: setting } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", settingKey)
        .maybeSingle();
      const list = Array.isArray(setting?.value) ? (setting!.value as any[]) : [];
      list.forEach((e: any) => {
        if (typeof e === "string" && e && !emails.includes(e)) emails.push(e);
      });
    }

    // 2) Grupos de correo (compatibilidad / complementario)
    const { data: grp } = await supabase
      .from("email_groups").select("id").eq("nombre", groupName).eq("is_active", true).maybeSingle();
    if (grp?.id) {
      const { data: members } = await supabase
        .from("email_group_members").select("email").eq("group_id", grp.id);
      (members || []).forEach((m: any) => {
        if (m.email && !emails.includes(m.email)) emails.push(m.email);
      });
    }

    // Filtrar correos prohibidos para validación
    const filteredEmails = isValidacion
      ? emails.filter((e) => !blocked.includes(e.toLowerCase()))
      : emails;
    setBlockedEmails(blocked);


    // Comprobantes
    const { data: archivos } = await supabase
      .from("cobranza_pago_archivos")
      .select("nombre_archivo,url_archivo")
      .eq("pago_id", pago.id);
    // Generar URLs firmadas (7 días) en el momento del envío para el bucket privado
    const SIGNED_TTL = 60 * 60 * 24 * 7;
    const signedComprobantes = await Promise.all(
      (archivos || []).map(async (a: any) => {
        const path = extractDocFilesPath(a.url_archivo);
        const { data } = await supabase.storage
          .from("document-files")
          .createSignedUrl(path, SIGNED_TTL);
        return { nombre: a.nombre_archivo, url: data?.signedUrl || a.url_archivo };
      })
    );
    setComprobantes(signedComprobantes);

    // Configurar el flujo
    // Variables disponibles para placeholders en plantillas del sistema
    // Construir listas HTML para placeholders {documentos_lista} y {comprobantes_lista}
    const docsHtml = documentosLigados.length
      ? documentosLigados
          .map(
            (d) =>
              `<div style="display:flex;justify-content:space-between;padding:4px 0;"><span><strong>${d.tipo}</strong> ${d.numero}</span><span style="font-weight:600;">${d.monto}</span></div>`
          )
          .join("")
      : '<span style="color:#94a3b8;">Sin documentos ligados</span>';
    const compsHtml = signedComprobantes.length
      ? signedComprobantes
          .map(
            (a) =>
              `<div style="padding:4px 0;"><a href="${a.url}" style="color:#2563eb;text-decoration:underline;">${a.nombre}</a></div>`
          )
          .join("")
      : '<span style="color:#94a3b8;">Sin comprobantes</span>';
    const formaLabelTpl =
      flow === "contado" ? "Contado" :
      flow === "credito" ? "Crédito Directo" :
      flow === "credito_cescemex" ? "Crédito Cescemex" :
      FORMA_PAGO_TPL_LABEL[pago.tipo_pago || ""] || pago.tipo_pago || "—";

    const tplVars: Record<string, any> = {
      nombre_cliente: pago.empresa?.name || "",
      cliente: pago.empresa?.name || "",
      empresa: pago.empresa?.name || "",
      monto_pago: `${formatCurrency(Number(pago.monto_total))} ${pago.moneda || "MXN"}`,
      monto_total: formatCurrency(Number(pago.monto_total)),
      moneda: pago.moneda || "MXN",
      fecha_pago: formatDate(pago.fecha_pago),
      tipo_pago: FORMA_PAGO_TPL_LABEL[pago.tipo_pago || ""] || pago.tipo_pago || "—",
      forma_pago: formaLabelTpl,
      referencia: pago.referencia_pago || "—",
      referencia_pago: pago.referencia_pago || "—",
      banco: pago.banco || "—",
      observaciones: pago.observaciones || "—",
      registrado_por: profile?.full_name || user?.email || "—",
      documentos_lista: docsHtml,
      comprobantes_lista: compsHtml,
      liga_documento: signedComprobantes[0]?.url ?? "",
    };

    const systemKey = flow === "general" ? "pago_registrado_contabilidad" : "pago_validacion";
    const dbTpl = await loadSystemTemplate(systemKey);
    let resolvedSubject = dbTpl?.subject || "";
    let resolvedBody = dbTpl?.body || "";
    if (dbTpl) {
      try {
        const { resolveTemplate } = await import("@/lib/resolveTemplate");
        resolvedSubject = await resolveTemplate(resolvedSubject, { pagoId: pago.id });
        resolvedBody = await resolveTemplate(resolvedBody, { pagoId: pago.id });
      } catch (e) {
        console.warn("[cobranza] resolveTemplate failed", e);
      }
    }
    const subjectOverride = dbTpl ? renderTemplate(resolvedSubject, tplVars) : undefined;
    const htmlOverride = dbTpl ? renderTemplate(resolvedBody, tplVars) : undefined;

    // Resolve template-level recipients (to + cc + bcc + reply_to)
    const tplToEmails = dbTpl ? await resolveEmailRecipients(dbTpl.to_emails) : [];
    const tplCc = dbTpl ? await resolveEmailRecipients(dbTpl.cc_emails) : [];
    const tplBcc = dbTpl ? await resolveEmailRecipients(dbTpl.bcc_emails) : [];
    const tplReplyTo = dbTpl?.reply_to || null;
    // Merge template "to" addresses with grupo/system emails (skip blocked)
    tplToEmails.forEach((e) => {
      if (!emails.includes(e) && !(isValidacion && blocked.includes(e.toLowerCase()))) emails.push(e);
    });
console.log("DEBUG filteredEmails:", filteredEmails);
console.log("DEBUG tplCc:", tplCc);
console.log("DEBUG replyTo:", profile?.email, user?.email);
    if (flow === "general") {
      setActiveFlow({
        templateName: "pago-confirmation",
        title: "Enviar confirmación de pago",
        description: "Envía el detalle del pago a los destinatarios.",
        subjectOverride,
        htmlOverride,
        cc: Array.from(new Set([...filteredEmails, ...tplCc])),
        bcc: tplBcc,
        replyTo: profile?.email || user?.email || tplReplyTo || undefined,
      });
    } else {
      const formaLabel =
        flow === "contado" ? "Contado" :
        flow === "credito" ? "Crédito Directo" : "Crédito Cescemex";
      setActiveFlow({
        templateName: "pago-validacion",
        title: `Solicitud de validación — ${formaLabel}`,
        description: `Se enviará a los destinatarios del grupo "${groupName}". Al enviar, el estatus del pago cambiará a "Enviado a Validar".`,
        formaPago: flow,
        subjectOverride,
        htmlOverride,
        cc: Array.from(new Set([...filteredEmails, ...tplCc])),
        bcc: tplBcc,
        replyTo: profile?.email || user?.email || tplReplyTo || undefined,
      });
    }

    // Envíos previos del template seleccionado
    const tpl = flow === "general" ? "pago-confirmation" : "pago-validacion";
    const { data: sentLogs } = await supabase
      .from("email_send_log")
      .select("recipient_email,status")
      .eq("template_name", tpl)
      .eq("status", "sent");
    const sentSet = new Set(
      (sentLogs || []).map((l: any) => (l.recipient_email || "").toLowerCase())
    );
    setPreviouslySentEmails(filteredEmails.filter((e) => sentSet.has(e.toLowerCase())).map((e) => e.toLowerCase()));
    setDefaultEmails(filteredEmails);
    setCcEmailsFlow(Array.from(new Set([...filteredEmails, ...tplCc])));
    setReplyToFlow(profile?.email || user?.email || tplReplyTo || undefined);
    setLoadingEmails(null);
    setOpenEnviar(true);
  };

  const handleSentValidacion = async () => {
    if (!pago) return;
    // Solo avanzar si está en "recibido"
    if (pago.estatus_pago === "recibido") {
      const { error } = await supabase
        .from("cobranza_pagos")
        .update({ estatus_pago: "enviado_validar" })
        .eq("id", pago.id);
      if (!error) {
        toast.success("Estatus actualizado a 'Enviado a Validar'");
        onChanged();
      }
    }
  };

  if (!pago) return null;

  const TIPO_LABEL: Record<string, string> = { factura: "Factura", pedido: "Pedido", cotizacion: "Cotización" };
  const aplicacionesActivas = aplicaciones.filter((a) => a.estatus_aplicacion === "activa");
  const aplicadoFacturas = aplicacionesActivas.filter((a) => a.tipo_documento === "factura").reduce((s, a) => s + Number(a.monto_aplicado || 0), 0);
  const aplicadoOtros = aplicacionesActivas.filter((a) => a.tipo_documento !== "factura").reduce((s, a) => s + Number(a.monto_aplicado || 0), 0);
  const disponibleFacturas = Math.max(0, Number(pago.monto_total) - aplicadoFacturas);
  const documentosLigados = aplicacionesActivas.map((a) => ({
      tipo: TIPO_LABEL[a.tipo_documento] || a.tipo_documento,
      numero: a.documento?.numero_factura || a.documento?.numero_pedido || a.documento?.numero_cotizacion || a.documento_id.slice(0, 8),
      monto: formatCurrency(Number(a.monto_aplicado)),
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>Detalle del pago</DialogTitle>
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Regresar a Pagos
            </Button>
          </div>
        </DialogHeader>
        <div className="space-y-4 mt-6">
          <div className="flex flex-wrap justify-end gap-2">
            {(!pago.tipo_pago || pago.tipo_pago === "contado") && (
              <Button size="sm" variant="outline" onClick={() => loadEmailsAndOpen("contado")} disabled={loadingEmails !== null}>
                <Mail className="h-4 w-4 mr-2" /> {loadingEmails === "contado" ? "Cargando..." : "Enviar correo Contado"}
              </Button>
            )}
            {(!pago.tipo_pago || pago.tipo_pago === "credito") && (
              <Button size="sm" variant="outline" onClick={() => loadEmailsAndOpen("credito")} disabled={loadingEmails !== null}>
                <Mail className="h-4 w-4 mr-2" /> {loadingEmails === "credito" ? "Cargando..." : "Enviar correo Crédito Directo"}
              </Button>
            )}
            {(!pago.tipo_pago || pago.tipo_pago === "credito_cescemex") && (
              <Button size="sm" variant="outline" onClick={() => loadEmailsAndOpen("credito_cescemex")} disabled={loadingEmails !== null}>
                <Mail className="h-4 w-4 mr-2" /> {loadingEmails === "credito_cescemex" ? "Cargando..." : "Enviar correo Crédito Cescemex"}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setEditandoFormaPago(true)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </Button>
          </div>
          {editandoFormaPago && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <Label className="text-sm font-semibold">Editar Pago</Label>
                <div>
                  <Label className="text-xs">Forma de Pago</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={nuevaFormaPago}
                    onChange={(e) => setNuevaFormaPago(e.target.value)}
                  >
                    <option value="">— Sin definir —</option>
                    <option value="contado">Contado</option>
                    <option value="credito">Crédito Directo</option>
                    <option value="credito_cescemex">Crédito Cescemex</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Plaza *</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={nuevaPlazaId}
                    onChange={(e) => setNuevaPlazaId(e.target.value)}
                  >
                    <option value="">— Selecciona plaza —</option>
                    {plazasEdit.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                  {!nuevaPlazaId && <p className="text-xs text-destructive mt-1">La plaza es requerida</p>}
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditandoFormaPago(false)}>Cancelar</Button>
                  <Button size="sm" onClick={async () => {
                    if (!nuevaPlazaId) { toast.error("La plaza es requerida"); return; }
                    const { error } = await supabase
                      .from("cobranza_pagos")
                      .update({ tipo_pago: (nuevaFormaPago || null) as any, plaza_id: nuevaPlazaId })
                      .eq("id", pago.id);
                    if (error) { toast.error(error.message); return; }
                    toast.success("Pago actualizado");
                    setEditandoFormaPago(false);
                    onChanged();
                  }}>Guardar</Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground text-xs">Cliente</p><p className="font-medium">{pago.empresa?.name}</p></div>
              <div><p className="text-muted-foreground text-xs">Plaza</p><p>{pago.plaza?.nombre || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Fecha</p><p>{formatDate(pago.fecha_pago)}</p></div>
              <div><p className="text-muted-foreground text-xs">Forma de pago</p><p>{FORMA_PAGO_LABEL[pago.tipo_pago || ""] || pago.tipo_pago || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Estatus Pago</p><div className="mt-1"><EstatusPagoEditor pagoId={pago.id} value={pago.estatus_pago} canEdit={canEditEstatus} onChanged={onChanged} /></div></div>
              <div><p className="text-muted-foreground text-xs">Banco</p><p>{pago.banco || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Referencia</p><p>{pago.referencia_pago || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Monto total</p><p className="font-semibold">{formatCurrency(pago.monto_total)}</p></div>
              <div><p className="text-muted-foreground text-xs">Aplicado a Facturas</p><p>{formatCurrency(aplicadoFacturas)}</p></div>
              <div><p className="text-muted-foreground text-xs">Aplicado a Cot/Pedidos</p><p className="text-muted-foreground">{aplicadoOtros > 0 ? formatCurrency(aplicadoOtros) : "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Disponible (a facturas)</p><p className="text-lg font-bold text-primary">{formatCurrency(disponibleFacturas)}</p></div>
              {pago.observaciones && <div className="col-span-2"><p className="text-muted-foreground text-xs">Observaciones</p><p>{pago.observaciones}</p></div>}
            </CardContent>
          </Card>

          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Aplicaciones</h3>
            {pago.estado_pago !== "cancelado" && disponibleFacturas > 0 && (
              <Button size="sm" onClick={() => onAplicar(pago)}><Plus className="h-4 w-4 mr-1" /> Aplicar</Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Documento</TableHead>
                  <TableHead className="text-right">Monto</TableHead><TableHead>Estado</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {aplicaciones.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sin aplicaciones</TableCell></TableRow>}
                  {aplicaciones.map((a) => {
                    const folio = a.documento?.numero_factura || a.documento?.numero_pedido || a.documento?.numero_cotizacion || a.documento_id.slice(0, 8);
                    return (
                      <TableRow key={a.id}>
                        <TableCell>{formatDate(a.fecha_aplicacion)}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{a.tipo_documento}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{folio}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(Number(a.monto_aplicado))}</TableCell>
                        <TableCell><Badge variant={a.estatus_aplicacion === "activa" ? "default" : "secondary"}>{a.estatus_aplicacion}</Badge></TableCell>
                        <TableCell>
                          {a.estatus_aplicacion === "activa" && (
                            <Button size="sm" variant="ghost" onClick={() => handleCancelarAplicacion(a.id)}><X className="h-4 w-4" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <PagoArchivosSection pagoId={pago.id} />
        </div>
      </DialogContent>
      <EnviarConfirmacionPagoDialog
        open={openEnviar}
        onOpenChange={setOpenEnviar}
        pagoId={pago.id}
        empresa={pago.empresa?.name || "—"}
        fechaPago={pago.fecha_pago}
        montoTotal={formatCurrency(pago.monto_total)}
        moneda={pago.moneda || "MXN"}
        observaciones={pago.observaciones || undefined}
        documentos={documentosLigados}
        comprobantes={comprobantes}
        registradoPor={profile?.full_name || user?.email || undefined}
        defaultEmails={defaultEmails}
        blockedEmails={blockedEmails}
        previouslySentEmails={previouslySentEmails}
        templateName={activeFlow.templateName}
        subjectOverride={activeFlow.subjectOverride}
        htmlOverride={activeFlow.htmlOverride}
        ccEmails={ccEmailsFlow}
        bccEmails={activeFlow.bcc}
        replyTo={replyToFlow}
        title={activeFlow.title}
        description={activeFlow.description}
        extraTemplateData={{
          cliente: pago.empresa?.name,
          referencia: pago.referencia_pago,
          formaPago: activeFlow.formaPago || pago.tipo_pago,
        }}
        onSent={activeFlow.templateName === "pago-validacion" ? handleSentValidacion : undefined}
        logContext={{
          user_id: user?.id || null,
          company_id: pago.empresa_id || null,
        }}
      />
    </Dialog>
  );
}

interface PagoArchivo {
  id: string;
  url_archivo: string;
  nombre_archivo: string;
  tipo_archivo: string;
  fecha_carga: string;
}

function PagoArchivosSection({ pagoId }: { pagoId: string }) {
  const { user } = useAuth();
  const [archivos, setArchivos] = useState<PagoArchivo[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchArchivos = async () => {
    const { data } = await supabase
      .from("cobranza_pago_archivos")
      .select("id,url_archivo,nombre_archivo,tipo_archivo,fecha_carga")
      .eq("pago_id", pagoId)
      .order("fecha_carga", { ascending: false });
    setArchivos(data || []);
  };

  useEffect(() => { fetchArchivos(); /* eslint-disable-next-line */ }, [pagoId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    const valid = list.filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
    if (valid.length === 0) { toast.error("Solo PDF o imágenes"); return; }
    setUploading(true);
    try {
      for (const file of valid) {
        const ext = file.name.split(".").pop();
        const path = `pagos/${pagoId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("document-files").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("document-files").getPublicUrl(path);
        const { error: insErr } = await supabase.from("cobranza_pago_archivos").insert({
          pago_id: pagoId,
          url_archivo: pub.publicUrl,
          nombre_archivo: file.name,
          tipo_archivo: file.type,
          usuario_carga: user?.id,
        });
        if (insErr) throw insErr;
      }
      toast.success("Archivos subidos");
      fetchArchivos();
    } catch (e: any) {
      toast.error(e.message || "Error al subir");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este archivo?")) return;
    const { error } = await supabase.from("cobranza_pago_archivos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Archivo eliminado");
    fetchArchivos();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold">Comprobantes</h3>
        <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleUpload} />
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Paperclip className="h-4 w-4 mr-1" /> {uploading ? "Subiendo..." : "Adjuntar"}
        </Button>
      </div>
      <Card>
        <CardContent className="p-3">
          {archivos.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-4">Sin comprobantes</p>
          ) : (
            <div className="space-y-2">
              {archivos.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 bg-muted/50 rounded px-2 py-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {a.tipo_archivo === "application/pdf" ? <FileText className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <div className="min-w-0">
                      <p className="text-sm truncate">{a.nombre_archivo}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(a.fecha_carga)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openDocFilesSignedUrl(a.url_archivo)}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(a.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BucketReportCard({ title, buckets, onSelect }: { title: string; buckets: { label: string; count: number; monto: number }[]; onSelect: (label: string) => void }) {
  const max = Math.max(...buckets.map((x) => x.monto), 1);
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {buckets.map((b) => {
          const pct = (b.monto / max) * 100;
          const isVencida = b.label === "Vencidas" || b.label === "Vencen hoy";
          const disabled = b.count === 0;
          return (
            <button
              key={b.label}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(b.label)}
              className="w-full text-left rounded-md p-2 -mx-2 hover:bg-accent/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <div className="flex justify-between text-sm mb-1">
                <span className={isVencida ? "text-destructive font-medium" : ""}>{b.label} <span className="text-muted-foreground">({b.count})</span></span>
                <span className="font-medium">{formatCurrency(b.monto)}</span>
              </div>
              <div className="h-2 bg-muted rounded overflow-hidden">
                <div className={`h-full ${isVencida ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function BucketDetalle({ label, scopeLabel, empresaVendedora, plazaId, prefilter, daysBucket, onBack }: {
  label: string;
  scopeLabel: string;
  empresaVendedora: "lumaggs_chevron" | "galsa_phillips66";
  plazaId: string | null;
  prefilter: CobranzaPrefilter;
  daysBucket?: DaysBucket;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Regresar al dashboard
        </Button>
        <div className="text-sm text-muted-foreground font-medium text-foreground">
          {scopeLabel} · {label}
        </div>
      </div>
      <FacturasListEmbedded
        empresaVendedora={empresaVendedora}
        plazaId={plazaId}
        prefilter={prefilter}
        daysBucket={daysBucket}
      />
    </div>
  );
}

// Tabla heredada (no usada). Mantener stub vacío para evitar import dangling.
function _LegacyBucketTable({ facturas }: { facturas: any[] }) {
  const navigate = useNavigate();
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Plaza</TableHead>
                <TableHead>Emisión</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Días</TableHead>
                <TableHead>Tipo de Pago</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facturas.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Sin facturas en este grupo</TableCell></TableRow>
              )}
              {facturas.map((f) => {
                const d = diasParaVencer(fechaVencimientoEfectiva(f));
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-xs">{f.numero_factura || "—"}</TableCell>
                    <TableCell className="truncate max-w-[200px]">{f.empresa?.name || "—"}</TableCell>
                    <TableCell>{f.plaza?.nombre || "—"}</TableCell>
                    <TableCell>{formatDate(f.fecha_documento)}</TableCell>
                    <TableCell>{fechaVencimientoEfectiva(f) ? formatDate(fechaVencimientoEfectiva(f)!) : "—"}</TableCell>
                    <TableCell><span className={d !== null && d < 0 ? "text-destructive font-medium" : ""}>{d ?? "—"}</span></TableCell>
                    <TableCell className="text-xs">{tipoPagoLabel(f.tipo_pago)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(f.total))}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(f.saldo_pendiente_cobranza))}</TableCell>
                    <TableCell><EstadoCobranzaBadge value={f.estatus_factura || f.estado_cobranza} /></TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Ver documento"
                        title="Ver documento"
                        onClick={() => window.open(`/documents/${f.id}/edit`, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

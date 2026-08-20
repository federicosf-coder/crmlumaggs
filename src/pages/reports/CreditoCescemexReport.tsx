import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBanner } from "@/components/PageBanner";
import { BackButton } from "@/components/BackButton";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, ChevronUp, ArrowUpDown, ExternalLink, ShieldCheck, Wallet, HelpCircle, Download } from "lucide-react";
import { generateCreditoCescemexPdf } from "@/lib/generateCreditoCescemexPdf";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const MESES_ABBR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const ANIO = 2026;

type Cat = "cescemex" | "directo" | "sin_clasificar";

const CATS: { key: Cat; label: string; color: string; text: string; border: string; bar: string }[] = [
  { key: "cescemex", label: "Cescemex", color: "emerald", text: "text-emerald-600", border: "border-l-emerald-600", bar: "#059669" },
  { key: "directo", label: "Directo", color: "blue", text: "text-blue-600", border: "border-l-blue-600", bar: "#2563eb" },
  { key: "sin_clasificar", label: "Sin clasificar", color: "slate", text: "text-slate-400", border: "border-l-slate-400", bar: "#94a3b8" },
];

const CAT_ICON: Record<Cat, typeof ShieldCheck> = {
  cescemex: ShieldCheck,
  directo: Wallet,
  sin_clasificar: HelpCircle,
};

function clasificar(tipoPago: string | null): Cat {
  if (tipoPago === "credito_cescemex") return "cescemex";
  if (tipoPago === "credito_directo") return "directo";
  return "sin_clasificar";
}

const BUCKET_LABELS = [
  "En tiempo",
  "1-5 días",
  "6-10 días",
  "11-20 días",
  "21-30 días",
  "31-45 días",
  "45-60 días",
  "60-90 días",
  "Más de 90 días",
  "Sin cobrar",
] as const;

const BUCKET_ROW_CLASS: Record<string, string> = {
  "En tiempo": "text-emerald-700 bg-emerald-50/60",
  "1-5 días": "text-amber-700 bg-amber-50/50",
  "6-10 días": "text-orange-700 bg-orange-50/50",
  "11-20 días": "text-orange-800 bg-orange-100/50",
  "21-30 días": "text-red-700 bg-red-50/60",
  "31-45 días": "text-red-800 bg-red-100/60",
  "45-60 días": "text-rose-700 bg-rose-100/60",
  "60-90 días": "text-rose-800 bg-rose-200/60",
  "Más de 90 días": "text-red-900 bg-red-200/80",
  "Sin cobrar": "text-slate-700 bg-slate-100/60",
};

function retrasoBucket(retraso: number): string {
  if (retraso <= 0) return "En tiempo";
  if (retraso <= 5) return "1-5 días";
  if (retraso <= 10) return "6-10 días";
  if (retraso <= 20) return "11-20 días";
  if (retraso <= 30) return "21-30 días";
  if (retraso <= 45) return "31-45 días";
  if (retraso <= 60) return "45-60 días";
  if (retraso <= 90) return "60-90 días";
  return "Más de 90 días";
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

interface FacturaRow {
  fecha_documento: string | null;
  tipo_pago: string | null;
  subtotal: number | null;
  unidades_equivalentes_total: number | null;
  empresa_id: string | null;
  plaza_id: string | null;
  companies: { name: string | null; razon_social: string | null } | null;
}

export default function CreditoCescemexReport() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [plazasSel, setPlazasSel] = useState<string[]>([]);
  const [initPlazas, setInitPlazas] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [catsSel, setCatsSel] = useState<Cat[]>(["cescemex", "directo", "sin_clasificar"]);
  const [sortField, setSortField] = useState<"cliente" | "cat" | "ue" | "monto" | "utilidad">("monto");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const reclasificar = async (empresaId: string | null, cliente: string, nuevo: "credito_cescemex" | "credito_directo") => {
    if (!empresaId) return;
    const n = facturasRaw.filter((f: any) => f.empresa_id === empresaId && f.tipo_pago === "credito").length;
    const label = nuevo === "credito_cescemex" ? "Cescemex" : "Directo";
    if (!window.confirm(`Se reclasificarán ${n} factura(s) de ${ANIO} de ${cliente} como Crédito ${label}. ¿Continuar?`)) return;
    const { error } = await (supabase as any)
      .from("documentos")
      .update({ tipo_pago: nuevo })
      .eq("empresa_id", empresaId)
      .eq("tipo_pago", "credito")
      .gte("fecha_documento", `${ANIO}-01-01`);
    if (error) {
      toast.error("Error al reclasificar: " + error.message);
      return;
    }
    const { error: companyError } = await (supabase as any)
      .from("companies")
      .update({ tipo_pago: nuevo })
      .eq("id", empresaId)
      .or("tipo_pago.eq.credito,tipo_pago.is.null");
    if (companyError) {
      console.error("No se pudo sincronizar el tipo de pago de la empresa:", companyError);
    }
    toast.success(`${n} factura(s) reclasificadas como Crédito ${label} (ficha del cliente actualizada)`);
    queryClient.invalidateQueries({ queryKey: ["credito-cescemex"] });
  };

  const meses = useMemo(() => {
    const now = new Date();
    const last = now.getFullYear() > ANIO ? 12 : now.getMonth() + 1;
    return Array.from({ length: last }, (_, i) => `${ANIO}-${pad(i + 1)}`);
  }, []);

  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas-activas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plazas")
        .select("id, nombre")
        .eq("is_active", true)
        .order("nombre");
      if (error) throw error;
      return (data ?? []) as { id: string; nombre: string }[];
    },
  });

  useEffect(() => {
    if (!initPlazas && plazas.length) {
      setPlazasSel(plazas.map((p) => p.id));
      setInitPlazas(true);
    }
  }, [plazas, initPlazas]);

  const todas = plazas.length > 0 && plazasSel.length === plazas.length;

  const { data: margenUtilidadPct = 20 } = useQuery({
    queryKey: ["cescemex-margen", ANIO],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("cescemex_costos_config")
        .select("margen_utilidad_pct")
        .eq("anio", ANIO)
        .maybeSingle();
      return Number(data?.margen_utilidad_pct ?? 20);
    },
  });

  const { data: facturasRaw = [], isLoading } = useQuery({
    queryKey: ["credito-cescemex", todas ? "all" : plazasSel.join(",")],
    enabled: initPlazas,
    queryFn: async () => {
      let q = supabase
        .from("documentos")
        .select(
          "fecha_documento, tipo_pago, subtotal, unidades_equivalentes_total, empresa_id, plaza_id, companies(name, razon_social)"
        )
        .eq("tipo_documento", "factura")
        .neq("estatus_factura", "cancelada")
        .eq("is_active", true)
        .in("tipo_pago", ["credito_cescemex", "credito_directo", "credito"])
        .gte("fecha_documento", `${ANIO}-01-01`);
      if (!todas && plazasSel.length) q = q.in("plaza_id", plazasSel);
      const { data, error } = await q.limit(20000);
      if (error) throw error;
      return (data ?? []) as unknown as FacturaRow[];
    },
  });

  const facturas = useMemo(
    () => facturasRaw.filter((f) => catsSel.includes(clasificar(f.tipo_pago))),
    [facturasRaw, catsSel]
  );

  const totales = useMemo(() => {
    const base: Record<Cat, { monto: number; ue: number; utilidad: number }> = {
      cescemex: { monto: 0, ue: 0, utilidad: 0 },
      directo: { monto: 0, ue: 0, utilidad: 0 },
      sin_clasificar: { monto: 0, ue: 0, utilidad: 0 },
    };
    for (const f of facturas) {
      const c = clasificar(f.tipo_pago);
      base[c].monto += Number(f.subtotal ?? 0);
      base[c].ue += Number(f.unidades_equivalentes_total ?? 0);
    }
    (Object.keys(base) as Cat[]).forEach((k) => {
      base[k].utilidad = base[k].monto * (Number(margenUtilidadPct) / 100);
    });
    return base;
  }, [facturas, margenUtilidadPct]);

  const totalGeneral = totales.cescemex.monto + totales.directo.monto + totales.sin_clasificar.monto;
  const utilidadTotal = totales.cescemex.utilidad + totales.directo.utilidad + totales.sin_clasificar.utilidad;

  const porMes = useMemo(() => {
    const map = new Map<string, Record<Cat, { monto: number; ue: number }>>();
    meses.forEach((m) =>
      map.set(m, {
        cescemex: { monto: 0, ue: 0 },
        directo: { monto: 0, ue: 0 },
        sin_clasificar: { monto: 0, ue: 0 },
      })
    );
    for (const f of facturas) {
      const key = (f.fecha_documento ?? "").slice(0, 7);
      const row = map.get(key);
      if (!row) continue;
      const c = clasificar(f.tipo_pago);
      row[c].monto += Number(f.subtotal ?? 0);
      row[c].ue += Number(f.unidades_equivalentes_total ?? 0);
    }
    return meses.map((m) => {
      const r = map.get(m)!;
      return {
        key: m,
        label: MESES_ABBR[Number(m.slice(5)) - 1],
        ...r,
      };
    });
  }, [facturas, meses]);

  const porCliente = useMemo(() => {
    const map = new Map<
      string,
      { cliente: string; cat: Cat; empresaId: string | null; monto: number; ue: number; meses: Map<string, { monto: number; ue: number }> }
    >();
    for (const f of facturas) {
      const cat = clasificar(f.tipo_pago);
      const cliente = f.companies?.razon_social || f.companies?.name || "Sin cliente";
      const key = `${f.empresa_id ?? "none"}|${cat}`;
      let e = map.get(key);
      if (!e) {
        e = { cliente, cat, empresaId: f.empresa_id ?? null, monto: 0, ue: 0, meses: new Map() };
        map.set(key, e);
      }
      e.monto += Number(f.subtotal ?? 0);
      e.ue += Number(f.unidades_equivalentes_total ?? 0);
      const mk = (f.fecha_documento ?? "").slice(0, 7);
      const prev = e.meses.get(mk) ?? { monto: 0, ue: 0 };
      e.meses.set(mk, {
        monto: prev.monto + Number(f.subtotal ?? 0),
        ue: prev.ue + Number(f.unidades_equivalentes_total ?? 0),
      });
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v, utilidad: v.monto * (Number(margenUtilidadPct) / 100) }))
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        switch (sortField) {
          case "cliente": return a.cliente.localeCompare(b.cliente) * dir;
          case "cat": return a.cat.localeCompare(b.cat) * dir;
          case "ue": return (a.ue - b.ue) * dir;
          case "utilidad": return (a.utilidad - b.utilidad) * dir;
          default: return (a.monto - b.monto) * dir;
        }
      });
  }, [facturas, margenUtilidadPct, sortField, sortDir]);

  const { data: cobranzaKpis } = useQuery({
    queryKey: ["credito-cescemex-cobranza", ANIO],
    queryFn: async () => {
    // El análisis de comportamiento de pago sólo es válido a partir de que se
    // empezaron a registrar pagos en el sistema: antes de esa fecha muchas
    // facturas se marcaron como pagadas manualmente (sin aplicación), lo que
    // inflaba el renglón "Sin cobrar".
    const { data: primeraAplic } = await (supabase as any)
      .from("cobranza_aplicaciones")
      .select("fecha_aplicacion")
      .eq("estatus_aplicacion", "activa")
      .not("fecha_aplicacion", "is", null)
      .order("fecha_aplicacion", { ascending: true })
      .limit(1)
      .maybeSingle();
    const inicioAnio = `${ANIO}-01-01`;
    const primeraFecha = primeraAplic?.fecha_aplicacion
      ? String(primeraAplic.fecha_aplicacion).slice(0, 10)
      : null;
    const desde = primeraFecha && primeraFecha > inicioAnio ? primeraFecha : inicioAnio;
    const { data: facts, error } = await (supabase as any)
      .from("documentos")
      .select("id, empresa_id, tipo_pago, fecha_documento, fecha_vencimiento, total, saldo_pendiente_cobranza, estado_cobranza")
      .eq("tipo_documento", "factura")
      .neq("estatus_factura", "cancelada")
      .eq("is_active", true)
      .in("tipo_pago", ["credito_cescemex", "credito_directo"])
      .gte("fecha_documento", desde);
    if (error) throw error;
    const rows: any[] = facts ?? [];
    const ids = rows.map((r) => r.id);
    const ultimaAplic = new Map<string, string>();
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      if (chunk.length === 0) break;
      const { data: aplics, error: e2 } = await (supabase as any)
        .from("cobranza_aplicaciones")
        .select("documento_id, fecha_aplicacion")
        .in("documento_id", chunk)
        .eq("estatus_aplicacion", "activa");
      if (e2) throw e2;
      (aplics ?? []).forEach((a: any) => {
        if (!a.fecha_aplicacion) return;
        const prev = ultimaAplic.get(a.documento_id);
        if (!prev || a.fecha_aplicacion > prev) ultimaAplic.set(a.documento_id, a.fecha_aplicacion);
      });
    }

    const dayMs = 86400000;
    const hoy = new Date();
    const diffDias = (a: string, b: string) =>
      (new Date(a).getTime() - new Date(b).getTime()) / dayMs;

    const clientesTotales = new Set(rows.map((r) => r.empresa_id).filter(Boolean));
    // Una empresa puede tener facturas de ambos tipos; se asigna a un solo tipo
    // (el de mayor importe facturado) para que los porcentajes sumen 100%.
    const importePorEmpresa = new Map<string, { credito_cescemex: number; credito_directo: number }>();
    rows.forEach((r) => {
      if (!r.empresa_id) return;
      const acc = importePorEmpresa.get(r.empresa_id) ?? { credito_cescemex: 0, credito_directo: 0 };
      if (r.tipo_pago === "credito_cescemex" || r.tipo_pago === "credito_directo") {
        acc[r.tipo_pago as "credito_cescemex" | "credito_directo"] += Number(r.total ?? 0);
      }
      importePorEmpresa.set(r.empresa_id, acc);
    });
    const tipoPorEmpresa = new Map<string, string>();
    importePorEmpresa.forEach((v, empresaId) => {
      tipoPorEmpresa.set(
        empresaId,
        v.credito_cescemex >= v.credito_directo ? "credito_cescemex" : "credito_directo"
      );
    });
    const calc = (tipo: string) => {
      const g = rows.filter((r) => r.tipo_pago === tipo);
      const pagadas = g.filter((r) => r.estado_cobranza === "pagada");
      const conAplic = pagadas.filter((r) => ultimaAplic.get(r.id));
      const sinCobrar = g.filter((r) => !ultimaAplic.get(r.id));
      const aTiempo = conAplic.filter(
        (r) => r.fecha_vencimiento && ultimaAplic.get(r.id)! <= r.fecha_vencimiento
      );
      const clientes = new Set(
        Array.from(tipoPorEmpresa.entries())
          .filter(([, t]) => t === tipo)
          .map(([empresaId]) => empresaId)
      );
      const dso = conAplic
        .filter((r) => r.fecha_documento)
        .map((r) => diffDias(ultimaAplic.get(r.id)!, r.fecha_documento));
      const avg = (arr: number[]) => (arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0);
      const totalFacturas = g.length;
      const totalImporte = g.reduce((s, r) => s + Number(r.total ?? 0), 0);
      const bucketAcc: Record<string, { cuenta: number; importe: number }> = {};
      BUCKET_LABELS.forEach((b) => { bucketAcc[b] = { cuenta: 0, importe: 0 }; });
      conAplic.forEach((r) => {
        if (!r.fecha_vencimiento) return;
        const retraso = diffDias(ultimaAplic.get(r.id)!, r.fecha_vencimiento);
        const lbl = retrasoBucket(retraso);
        bucketAcc[lbl].cuenta += 1;
        bucketAcc[lbl].importe += Number(r.total ?? 0);
      });
      sinCobrar.forEach((r) => {
        bucketAcc["Sin cobrar"].cuenta += 1;
        bucketAcc["Sin cobrar"].importe += Number(r.total ?? 0);
      });
      const baseTotal = totalFacturas;
      const buckets = BUCKET_LABELS.map((label) => ({
        label,
        cuenta: bucketAcc[label].cuenta,
        importe: bucketAcc[label].importe,
        pct: baseTotal > 0 ? (bucketAcc[label].cuenta / baseTotal) * 100 : 0,
      }));
      const vencidasPagadas = BUCKET_LABELS.filter((b) => b !== "En tiempo" && b !== "Sin cobrar")
        .reduce((s, b) => s + bucketAcc[b].cuenta, 0);
      return {
        totalFacturas,
        facturasPagadasConAplicacion: conAplic.length,
        pctPagadasATiempo: pagadas.length ? (aTiempo.length / pagadas.length) * 100 : 0,
        pctClientes: clientesTotales.size ? (clientes.size / clientesTotales.size) * 100 : 0,
        pctCarteraVencida: pagadas.length > 0 ? (vencidasPagadas / pagadas.length) * 100 : 0,
        diasPromedioPago: avg(dso),
        buckets,
        total: { cuenta: totalFacturas, importe: totalImporte },
      };
    };

      return { desde, cescemex: calc("credito_cescemex"), directo: calc("credito_directo") };
    },
  });

  const descargarPdf = async () => {
    const plazasLabel = todas
      ? "Todas las plazas"
      : plazas.filter((p) => plazasSel.includes(p.id)).map((p) => p.nombre).join(", ") || "Ninguna";
    const toastId = toast.loading("Generando PDF...");
    try {
      if (!cobranzaKpis) throw new Error("Los indicadores de cobranza aún se están cargando");
      generateCreditoCescemexPdf({
      fecha: new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" }),
      plazasLabel,
      categorias: CATS.filter((c) => catsSel.includes(c.key)).map((c) => ({
        label: c.label,
        monto: totales[c.key].monto,
        ue: totales[c.key].ue,
        utilidad: totales[c.key].utilidad,
        pct: totalGeneral > 0 ? (totales[c.key].monto / totalGeneral) * 100 : 0,
      })),
      utilidadTotal,
      margenUtilidadPct: Number(margenUtilidadPct),
      porMes: porMes.map((m) => ({
        label: m.label,
        cescemexMonto: m.cescemex.monto,
        cescemexUe: m.cescemex.ue,
        directoMonto: m.directo.monto,
        directoUe: m.directo.ue,
        sinClasificarMonto: m.sin_clasificar.monto,
        sinClasificarUe: m.sin_clasificar.ue,
      })),
      porCliente: porCliente.map((c) => ({
        cliente: c.cliente,
        tipo: CATS.find((x) => x.key === c.cat)?.label ?? c.cat,
        ue: c.ue,
        monto: c.monto,
        utilidad: c.utilidad,
      })),
        cobranzaKpis,
      });
      toast.dismiss(toastId);
      toast.success("PDF generado");
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error("No se pudo generar el PDF: " + (e?.message ?? "error desconocido"));
    }
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-50" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 ml-1 inline" />
      : <ChevronDown className="h-3 w-3 ml-1 inline" />;
  };

  const money = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
  const fmt = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 2 });

  const togglePlaza = (id: string) =>
    setPlazasSel((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const toggleCat = (c: Cat) =>
    setCatsSel((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <>
      <div className="container mx-auto px-4 pt-4">
        <BackButton fallback="/reports" label="Volver a Reportes" />
      </div>
      <PageBanner
        title="Crédito Cescemex vs Directo"
        description={`Facturación a crédito ${ANIO}: participación por tipo de crédito, evolución mensual y detalle por cliente.`}
      />
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardContent className="pt-6 flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">Plazas</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="min-w-[220px] justify-between font-light">
                    {todas ? "Todas las plazas" : `${plazasSel.length} plazas seleccionadas`}
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="flex justify-between pb-2 mb-2 border-b">
                    <Button variant="ghost" size="sm" onClick={() => setPlazasSel(plazas.map((p) => p.id))}>
                      Todas
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPlazasSel([])}>
                      Ninguna
                    </Button>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {plazas.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={plazasSel.includes(p.id)} onCheckedChange={() => togglePlaza(p.id)} />
                        {p.nombre}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">Categorías</Label>
              <div className="flex flex-wrap items-center gap-4 h-10">
                {CATS.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={catsSel.includes(c.key)} onCheckedChange={() => toggleCat(c.key)} />
                    <span className={cn("font-light", c.text)}>{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide">Exportar</Label>
              <div className="h-10 flex items-center">
                <Button variant="outline" onClick={descargarPdf}>
                  <Download className="h-4 w-4 mr-2" /> Descargar PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
              Indicadores de cobranza — Cescemex vs Directo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Pagadas a tiempo", key: "pctPagadasATiempo", fmt: (v: number) => `${v.toFixed(1)}%`, hint: "Pagadas a tiempo / Facturas pagadas" },
                { label: "Clientes por tipo de crédito", key: "pctClientes", fmt: (v: number) => `${v.toFixed(1)}%`, hint: "Clientes del tipo / Clientes totales" },
                { label: "Pagadas vencidas", key: "pctCarteraVencida", fmt: (v: number) => `${v.toFixed(1)}%`, hint: "Pagadas con retraso / Facturas pagadas" },
                { label: "Días promedio para pagar (DSO)", key: "diasPromedioPago", fmt: (v: number) => `${v.toFixed(1)} días`, hint: "Promedio de días de emisión a pago" },
              ].map((kpi) => (
                <div key={kpi.key} className="rounded-lg border p-4 space-y-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-light">{kpi.label}</div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-center flex-1">
                      <div className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Cescemex</div>
                      <div className="text-xl font-semibold text-emerald-600">
                        {cobranzaKpis ? kpi.fmt(cobranzaKpis.cescemex[kpi.key as keyof typeof cobranzaKpis.cescemex] as number) : "—"}
                      </div>
                    </div>
                    <div className="w-px h-8 bg-border" />
                    <div className="text-center flex-1">
                      <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">Directo</div>
                      <div className="text-xl font-semibold text-blue-600">
                        {cobranzaKpis ? kpi.fmt(cobranzaKpis.directo[kpi.key as keyof typeof cobranzaKpis.directo] as number) : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-light leading-tight">{kpi.hint}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>


        <div className="grid gap-4 md:grid-cols-3">
          {CATS.map((c) => {
            const Icon = CAT_ICON[c.key];
            const t = totales[c.key];
            const pct = totalGeneral > 0 ? (t.monto / totalGeneral) * 100 : 0;
            return (
              <Card key={c.key} className={cn("border-l-4", c.border)}>
                <CardHeader className="pb-2 flex flex-row items-center gap-2 space-y-0">
                  <Icon className={cn("h-4 w-4", c.text)} />
                  <CardTitle className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
                    {c.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className={cn("text-2xl font-semibold", c.text)}>{money(t.monto)}</div>
                  <div className="text-xs text-muted-foreground font-light">{fmt(t.ue)} UE</div>
                  <div className="text-xs font-light">{pct.toFixed(1)}% del crédito {ANIO}</div>
                  <div className={cn("text-xs font-light", c.text)}>Utilidad estimada: {money(t.utilidad)}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-l-4 border-l-emerald-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
              Utilidad Total Generada {ANIO}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-semibold text-emerald-600">{money(utilidadTotal)}</div>
            <p className="text-xs text-muted-foreground font-light">
              Estimado con margen de utilidad de {margenUtilidadPct}% sobre precio de venta (categorías seleccionadas).
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {CATS.map((c) => (
            <Card key={`ut-${c.key}`} className={cn("border-l-4", c.border)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
                  Utilidad {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-semibold", c.text)}>{money(totales[c.key].utilidad)}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
              Evolución mensual (subtotal facturado)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porMes.map((m) => ({
                  label: m.label,
                  Cescemex: m.cescemex.monto,
                  Directo: m.directo.monto,
                  "Sin clasificar": m.sin_clasificar.monto,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <Tooltip formatter={(v: number | string) => money(Number(v))} />
                  <Legend />
                  <Bar dataKey="Cescemex" stackId="a" fill="#059669" />
                  <Bar dataKey="Directo" stackId="a" fill="#2563eb" />
                  <Bar dataKey="Sin clasificar" stackId="a" fill="#94a3b8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Cescemex $</TableHead>
                  <TableHead className="text-right">Cescemex UE</TableHead>
                  <TableHead className="text-right">Directo $</TableHead>
                  <TableHead className="text-right">Directo UE</TableHead>
                  <TableHead className="text-right">Sin clasificar $</TableHead>
                  <TableHead className="text-right">Sin clasificar UE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : (
                  porMes.map((m) => (
                    <TableRow key={m.key}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell className="text-right">{money(m.cescemex.monto)}</TableCell>
                      <TableCell className="text-right">{fmt(m.cescemex.ue)}</TableCell>
                      <TableCell className="text-right">{money(m.directo.monto)}</TableCell>
                      <TableCell className="text-right">{fmt(m.directo.ue)}</TableCell>
                      <TableCell className="text-right">{money(m.sin_clasificar.monto)}</TableCell>
                      <TableCell className="text-right">{fmt(m.sin_clasificar.ue)}</TableCell>
                    </TableRow>
                  ))
                )}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Acumulado {ANIO}</TableCell>
                  <TableCell className="text-right">{money(totales.cescemex.monto)}</TableCell>
                  <TableCell className="text-right">{fmt(totales.cescemex.ue)}</TableCell>
                  <TableCell className="text-right">{money(totales.directo.monto)}</TableCell>
                  <TableCell className="text-right">{fmt(totales.directo.ue)}</TableCell>
                  <TableCell className="text-right">{money(totales.sin_clasificar.monto)}</TableCell>
                  <TableCell className="text-right">{fmt(totales.sin_clasificar.ue)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
              Clientes por tipo de crédito
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>
                    <button type="button" onClick={() => toggleSort("cliente")} className="inline-flex items-center hover:text-foreground">Cliente<SortIcon field="cliente" /></button>
                  </TableHead>
                  <TableHead>
                    <button type="button" onClick={() => toggleSort("cat")} className="inline-flex items-center hover:text-foreground">Tipo<SortIcon field="cat" /></button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button type="button" onClick={() => toggleSort("ue")} className="inline-flex items-center hover:text-foreground">UE {ANIO}<SortIcon field="ue" /></button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button type="button" onClick={() => toggleSort("monto")} className="inline-flex items-center hover:text-foreground">Subtotal {ANIO}<SortIcon field="monto" /></button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button type="button" onClick={() => toggleSort("utilidad")} className="inline-flex items-center hover:text-foreground">Utilidad<SortIcon field="utilidad" /></button>
                  </TableHead>
                  <TableHead className="w-12 text-right">Abrir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porCliente.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {isLoading ? "Cargando…" : "Sin registros"}
                    </TableCell>
                  </TableRow>
                ) : (
                  porCliente.map((c) => {
                    const cat = CATS.find((x) => x.key === c.cat)!;
                    const open = abierta === c.key;
                    return (
                      <Collapsible key={c.key} asChild open={open} onOpenChange={(o) => setAbierta(o ? c.key : null)}>
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow className="cursor-pointer">
                              <TableCell>
                                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </TableCell>
                              <TableCell className="font-medium">{c.cliente}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn(cat.text)}>
                                  {cat.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">{fmt(c.ue)}</TableCell>
                              <TableCell className="text-right">{money(c.monto)}</TableCell>
                              <TableCell className="text-right">{money(c.utilidad)}</TableCell>
                              <TableCell className="text-right">
                                {c.cat === "sin_clasificar" && c.empresaId && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="outline" size="sm" className="mr-2" onClick={(e) => e.stopPropagation()}>
                                        Reclasificar
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); reclasificar(c.empresaId, c.cliente, "credito_cescemex"); }}>
                                        Marcar todas como Cescemex
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); reclasificar(c.empresaId, c.cliente, "credito_directo"); }}>
                                        Marcar todas como Directo
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                                {c.empresaId && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(
                                        `/directory?tab=companies&select=${c.empresaId}&subtab=facturacion&back=${encodeURIComponent("/reports/credito-cescemex")}`
                                      );
                                    }}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={7} className="bg-muted/20 p-0">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Mes</TableHead>
                                      <TableHead className="text-right">UE</TableHead>
                                      <TableHead className="text-right">Subtotal</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {meses.map((m) => {
                                      const v = c.meses.get(m) ?? { monto: 0, ue: 0 };
                                      return (
                                        <TableRow key={m}>
                                          <TableCell>{MESES_ABBR[Number(m.slice(5)) - 1]}</TableCell>
                                          <TableCell className="text-right">{fmt(v.ue)}</TableCell>
                                          <TableCell className="text-right">{money(v.monto)}</TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
              Comportamiento de pago por tipo de crédito
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            {([
              { key: "directo" as const, label: "Directo", text: "text-blue-600" },
              { key: "cescemex" as const, label: "Cescemex", text: "text-emerald-600" },
            ]).map((t) => {
              const k = cobranzaKpis?.[t.key];
              return (
                <div key={t.key} className="space-y-2">
                  <div className={cn("text-sm font-semibold uppercase tracking-wide", t.text)}>{t.label}</div>
                  <div className="text-xs font-light">
                    <span className="font-semibold">{(k?.pctCarteraVencida ?? 0).toFixed(1)}%</span> de las facturas pagadas se pagan vencidas
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-[10px] font-light">Pagadas a tiempo: {(k?.pctPagadasATiempo ?? 0).toFixed(1)}%</Badge>
                    <Badge variant="secondary" className="text-[10px] font-light">Clientes: {(k?.pctClientes ?? 0).toFixed(1)}%</Badge>
                    <Badge variant="secondary" className="text-[10px] font-light">DSO: {(k?.diasPromedioPago ?? 0).toFixed(1)} días</Badge>
                  </div>
                  <div className="text-[10px] font-light text-muted-foreground">
                    % = facturas del rango / total de facturas del tipo ({k?.total?.cuenta ?? 0}). Suma 100%.
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rango</TableHead>
                        <TableHead className="text-right">Cuenta</TableHead>
                        <TableHead className="text-right">Importe</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {BUCKET_LABELS.map((label) => {
                        const b = k?.buckets.find((x) => x.label === label);
                        return (
                          <TableRow key={label} className={BUCKET_ROW_CLASS[label]}>
                            <TableCell className="font-medium">{label}</TableCell>
                            <TableCell className="text-right">{b?.cuenta ?? 0}</TableCell>
                            <TableCell className="text-right">{money(b?.importe ?? 0)}</TableCell>
                            <TableCell className="text-right">{(b?.pct ?? 0).toFixed(1)}%</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="font-semibold bg-muted/50">
                        <TableCell className="font-medium">Total</TableCell>
                        <TableCell className="text-right">{k?.total?.cuenta ?? 0}</TableCell>
                        <TableCell className="text-right">{money(k?.total?.importe ?? 0)}</TableCell>
                        <TableCell className="text-right">100.0%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
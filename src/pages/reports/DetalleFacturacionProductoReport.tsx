import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBanner } from "@/components/PageBanner";
import { BackButton } from "@/components/BackButton";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import {
  startOfYesterday,
  endOfYesterday,
  startOfToday,
  endOfToday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";

type Periodo = "ayer" | "hoy" | "semana" | "mes" | "custom";
type Empresa = "lumaggs_chevron" | "galsa_phillips66";

const PILL: Record<Empresa, { active: string; idle: string }> = {
  lumaggs_chevron: {
    active: "bg-blue-600 text-white",
    idle: "bg-transparent text-blue-700 hover:bg-blue-50",
  },
  galsa_phillips66: {
    active: "bg-orange-500 text-white",
    idle: "bg-transparent text-orange-600 hover:bg-orange-50",
  },
};

const ESTATUS_LABEL: Record<string, string> = {
  vigente: "Vigente",
  pendiente: "Pendiente",
  pagada: "Pagada",
  parcial: "Parcial",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

const ESTATUS_KEYS = ["vigente", "pendiente", "pagada", "parcial", "vencida", "cancelada"];

type SortKey =
  | "fecha"
  | "numeroFactura"
  | "producto"
  | "presentacion"
  | "cantidad"
  | "unidadesEquivalentes"
  | "precioUnitario"
  | "importe"
  | "estatus";

interface Linea {
  key: string;
  numeroFactura: string;
  fecha: string | null;
  producto: string;
  presentacion: string;
  cantidad: number;
  unidadesEquivalentes: number;
  precioUnitario: number;
  importe: number;
  estatus: string;
  cancelada: boolean;
  companyId: string | null;
}

export default function DetalleFacturacionProductoReport() {
  const [empresaSel, setEmpresaSel] = useState<Empresa>("lumaggs_chevron");
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [customStart, setCustomStart] = useState<Date | undefined>(startOfMonth(new Date()));
  const [customEnd, setCustomEnd] = useState<Date | undefined>(endOfToday());
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [estatusSel, setEstatusSel] = useState<string[]>(["vigente", "pendiente", "pagada", "parcial", "vencida"]);
  const [plazaSel, setPlazaSel] = useState<string[]>([]);
  const incluirCanceladas = estatusSel.includes("cancelada");

  const { periodoStart, periodoEnd } = useMemo(() => {
    switch (periodo) {
      case "ayer":
        return { periodoStart: startOfYesterday(), periodoEnd: endOfYesterday() };
      case "semana":
        return {
          periodoStart: startOfWeek(new Date(), { weekStartsOn: 1 }),
          periodoEnd: endOfWeek(new Date(), { weekStartsOn: 1 }),
        };
      case "mes":
        return { periodoStart: startOfMonth(new Date()), periodoEnd: endOfMonth(new Date()) };
      case "custom":
        return { periodoStart: customStart ?? startOfToday(), periodoEnd: customEnd ?? endOfToday() };
      default:
        return { periodoStart: startOfToday(), periodoEnd: endOfToday() };
    }
  }, [periodo, customStart, customEnd]);

  const desde = format(periodoStart, "yyyy-MM-dd");
  const hasta = format(periodoEnd, "yyyy-MM-dd");

  const pill = PILL[empresaSel];

  const { data: lineas = [], isLoading } = useQuery({
    queryKey: ["reporte_detalle_facturacion_producto", empresaSel, desde, hasta],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documento_productos")
        .select(
          "id, cantidad, precio_unitario, subtotal, documentos!inner(id, numero_factura, fecha_documento, estatus_factura, tipo_documento, is_active, empresa_vendedora, empresa_id), productos!inner(nombre_producto, presentaciones(nombre, unidades_equivalentes))"
        )
        .eq("documentos.tipo_documento", "factura")
        .eq("documentos.is_active", true)
        .eq("documentos.empresa_vendedora", empresaSel)
        .gte("documentos.fecha_documento", desde)
        .lte("documentos.fecha_documento", hasta);
      if (error) throw error;
      const rows: Linea[] = ((data || []) as any[]).map((r) => {
        const doc = r.documentos;
        const pres = r.productos?.presentaciones;
        const ue = Number(pres?.unidades_equivalentes ?? 1) || 1;
        const cantidad = Number(r.cantidad || 0);
        const estatus = doc?.estatus_factura ?? "";
        return {
          key: r.id,
          numeroFactura: doc?.numero_factura || "—",
          fecha: doc?.fecha_documento ?? null,
          producto: r.productos?.nombre_producto || "—",
          presentacion: pres?.nombre || "—",
          cantidad,
          unidadesEquivalentes: cantidad * ue,
          precioUnitario: Number(r.precio_unitario || 0),
          importe: Number(r.subtotal || 0),
          estatus,
          cancelada: estatus === "cancelada",
          companyId: doc?.empresa_id ?? null,
        };
      });
      rows.sort((a, b) => {
        const f = (b.fecha || "").localeCompare(a.fecha || "");
        if (f !== 0) return f;
        return a.numeroFactura.localeCompare(b.numeroFactura, "es-MX", { numeric: true });
      });
      return rows;
    },
  });

  const { data: companyPlazasRows = [] } = useQuery({
    queryKey: ["reporte_detalle_fp_company_plazas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_plazas").select("company_id, plaza_id");
      if (error) throw error;
      return (data || []) as { company_id: string; plaza_id: string }[];
    },
  });

  const { data: plazasRows = [] } = useQuery({
    queryKey: ["reporte_detalle_fp_plazas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre");
      if (error) throw error;
      return (data || []) as { id: string; nombre: string }[];
    },
  });

  const companyPlazaMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const cp of companyPlazasRows) {
      const arr = m.get(cp.company_id) ?? [];
      if (!arr.includes(cp.plaza_id)) arr.push(cp.plaza_id);
      m.set(cp.company_id, arr);
    }
    return m;
  }, [companyPlazasRows]);

  const plazaNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of plazasRows) m.set(p.id, p.nombre);
    return m;
  }, [plazasRows]);

  const plazaOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const l of lineas) {
      if (!l.companyId) continue;
      for (const pid of companyPlazaMap.get(l.companyId) ?? []) ids.add(pid);
    }
    return Array.from(ids)
      .map((pid) => ({ id: pid, nombre: plazaNameMap.get(pid) ?? pid }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [lineas, companyPlazaMap, plazaNameMap]);

  const lineasFiltradas = useMemo(
    () =>
      lineas.filter((l) => {
        if (ESTATUS_KEYS.includes(l.estatus) && !estatusSel.includes(l.estatus)) return false;
        if (plazaSel.length > 0) {
          const plazas = l.companyId ? companyPlazaMap.get(l.companyId) ?? [] : [];
          if (!plazas.some((pid) => plazaSel.includes(pid))) return false;
        }
        return true;
      }),
    [lineas, estatusSel, plazaSel, companyPlazaMap]
  );

  const lineasOrdenadas = useMemo(() => {
    if (!sortKey) return lineasFiltradas;
    const mult = sortDir === "asc" ? 1 : -1;
    const sorted = [...lineasFiltradas];
    sorted.sort((a, b) => {
      if (sortKey === "numeroFactura") {
        return mult * a.numeroFactura.localeCompare(b.numeroFactura, "es-MX", { numeric: true });
      }
      if (sortKey === "estatus") {
        const ea = ESTATUS_LABEL[a.estatus] ?? a.estatus ?? "";
        const eb = ESTATUS_LABEL[b.estatus] ?? b.estatus ?? "";
        return mult * ea.localeCompare(eb, "es");
      }
      const va = a[sortKey] as string | number;
      const vb = b[sortKey] as string | number;
      if (typeof va === "number" && typeof vb === "number") return mult * (va - vb);
      return mult * String(va).localeCompare(String(vb), "es");
    });
    return sorted;
  }, [lineasFiltradas, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const totales = useMemo(() => {
    const t = { cantidad: 0, unidades: 0, importe: 0, cCantidad: 0, cUnidades: 0, cImporte: 0, cLineas: 0 };
    for (const l of lineasFiltradas) {
      t.cantidad += l.cantidad;
      t.unidades += l.unidadesEquivalentes;
      t.importe += l.importe;
      if (l.cancelada) {
        t.cCantidad += l.cantidad;
        t.cUnidades += l.unidadesEquivalentes;
        t.cImporte += l.importe;
        t.cLineas += 1;
      }
    }
    return t;
  }, [lineasFiltradas]);

  const fmt = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 2 });

  const SortHead = ({ label, k, right }: { label: string; k: SortKey; right?: boolean }) => (
    <TableHead className={right ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 uppercase tracking-wide font-medium hover:text-foreground"
      >
        {label}
        {sortKey === k &&
          (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </TableHead>
  );

  return (
    <>
      <div className="container mx-auto px-4 pt-4">
        <BackButton fallback="/reports" label="Volver a Reportes" />
      </div>
      <PageBanner
        title="Detalle de Facturación por Producto"
        description="Una fila por línea de producto facturada, con unidades equivalentes calculadas por presentación."
      />
      <div className="container mx-auto p-4 space-y-4">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border overflow-hidden">
            <button
              type="button"
              onClick={() => setEmpresaSel("lumaggs_chevron")}
              className={`px-4 py-1.5 text-xs font-semibold transition-all ${
                empresaSel === "lumaggs_chevron" ? PILL.lumaggs_chevron.active : PILL.lumaggs_chevron.idle
              }`}
            >
              Chevron
            </button>
            <button
              type="button"
              onClick={() => setEmpresaSel("galsa_phillips66")}
              className={`px-4 py-1.5 text-xs font-semibold transition-all ${
                empresaSel === "galsa_phillips66" ? PILL.galsa_phillips66.active : PILL.galsa_phillips66.idle
              }`}
            >
              Phillips 66
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {([
            { id: "ayer", label: "Ayer" },
            { id: "hoy", label: "Hoy" },
            { id: "semana", label: "Esta Semana" },
            { id: "mes", label: "Este Mes" },
            { id: "custom", label: "Especificar periodo" },
          ] as const).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodo(p.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all",
                periodo === p.id ? pill.active : pill.idle
              )}
              aria-pressed={periodo === p.id}
            >
              {p.label}
            </button>
          ))}
          {periodo === "custom" && (
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs font-normal">
                    <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                    {customStart ? format(customStart, "d MMM yyyy", { locale: esLocale }) : "Inicio"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customStart} onSelect={setCustomStart} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs font-normal">
                    <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                    {customEnd ? format(customEnd, "d MMM yyyy", { locale: esLocale }) : "Fin"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground font-light">
          Periodo: {format(periodoStart, "d MMM yyyy", { locale: esLocale })} — {format(periodoEnd, "d MMM yyyy", { locale: esLocale })}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Estatus de factura:</span>
          {ESTATUS_KEYS.map((k) => {
            const active = estatusSel.includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() =>
                  setEstatusSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))
                }
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all",
                  active ? pill.active : pill.idle
                )}
                aria-pressed={active}
              >
                {ESTATUS_LABEL[k]}
              </button>
            );
          })}
        </div>

        {plazaOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Plaza:</span>
            {plazaSel.length === 0 && (
              <span className="text-[11px] font-light text-muted-foreground">(todas)</span>
            )}
            {plazaOptions.map((p) => {
              const active = plazaSel.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setPlazaSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all",
                    active ? pill.active : pill.idle
                  )}
                  aria-pressed={active}
                >
                  {p.nombre}
                </button>
              );
            })}
          </div>
        )}
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Cargando...</div>
            ) : lineas.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Sin facturación en este periodo.</div>
            ) : lineasFiltradas.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Sin líneas con los estatus seleccionados.</div>
            ) : (
              <>
                <div className="max-h-[calc(100vh-22rem)] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-20 [&_th]:bg-background">
                      <TableRow>
                        <SortHead label="Fecha de Factura" k="fecha" />
                        <SortHead label="Número de Factura" k="numeroFactura" />
                        <SortHead label="Producto" k="producto" />
                        <SortHead label="Presentación" k="presentacion" />
                        <SortHead label="Cantidad Facturada" k="cantidad" right />
                        <SortHead label="Unidades Equivalentes" k="unidadesEquivalentes" right />
                        <SortHead label="Precio Unitario" k="precioUnitario" right />
                        <SortHead label="Importe" k="importe" right />
                        <SortHead label="Estatus de Factura" k="estatus" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineasOrdenadas.map((l) => (
                        <TableRow key={l.key} className={cn(l.cancelada && "bg-destructive/5 text-muted-foreground line-through decoration-destructive/40")}>
                          <TableCell className="text-sm whitespace-nowrap">{l.fecha ? format(new Date(`${l.fecha}T12:00:00`), "d MMM yyyy", { locale: esLocale }) : "—"}</TableCell>
                          <TableCell className="font-medium whitespace-nowrap">{l.numeroFactura}</TableCell>
                          <TableCell className="text-sm">{l.producto}</TableCell>
                          <TableCell className="text-sm">{l.presentacion}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(l.cantidad)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(l.unidadesEquivalentes)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(l.precioUnitario)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(l.importe)}</TableCell>
                          <TableCell className="text-sm no-underline">
                            <span className={cn(l.cancelada && "text-destructive font-medium")}>
                              {ESTATUS_LABEL[l.estatus] ?? l.estatus ?? "—"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/60 font-semibold sticky bottom-0">
                        <TableCell colSpan={4} className="text-xs uppercase tracking-wide">
                          Totales ({lineasFiltradas.length} líneas)
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(totales.cantidad)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(totales.unidades)}</TableCell>
                        <TableCell />
                        <TableCell className="text-right tabular-nums">{formatCurrency(totales.importe)}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                {incluirCanceladas && (
                  <div className="border-t p-3 text-xs font-light space-y-1">
                    {totales.cLineas > 0 ? (
                      <>
                        <p className="text-destructive">
                          Incluye {totales.cLineas} línea{totales.cLineas === 1 ? "" : "s"} de facturas canceladas:{" "}
                          {fmt(totales.cCantidad)} de cantidad, {fmt(totales.cUnidades)} unidades equivalentes y{" "}
                          {formatCurrency(totales.cImporte)} de importe.
                        </p>
                        <p className="text-muted-foreground">
                          Total sin canceladas: {fmt(totales.cantidad - totales.cCantidad)} de cantidad,{" "}
                          {fmt(totales.unidades - totales.cUnidades)} unidades equivalentes y{" "}
                          {formatCurrency(totales.importe - totales.cImporte)} de importe.
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">No hay líneas de facturas canceladas en este periodo.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

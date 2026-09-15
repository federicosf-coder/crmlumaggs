import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, FileSpreadsheet, FileText, Users, UserPlus, ClipboardList } from "lucide-react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageBanner } from "@/components/PageBanner";
import { BackButton } from "@/components/BackButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type EmpresaKey = "lumaggs_chevron" | "galsa_phillips66";

const EMPRESA_LABELS: Record<string, string> = {
  lumaggs_chevron: "Lumaggs (Chevron)",
  galsa_phillips66: "Galsa (Phillips 66)",
};

interface EjecutivoOption {
  user_id: string;
  full_name: string | null;
}

interface EmpresaAgg {
  empresa: string;
  unidades: number;
  importe: number;
}

interface ActividadRow {
  cliente: string;
  descripcion: string;
  fecha: string;
}

interface ReporteEjecutivo {
  userId: string;
  nombre: string;
  ventas: EmpresaAgg[];
  cobranza: EmpresaAgg[];
  prospectos: number;
  clientesAtendidos: number;
  cotizaciones: number;
  pedidos: number;
  facturas: number;
  actividades: ActividadRow[];
}

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 2 });

export default function ReporteDiario() {
  const { user, hasAnyRole } = useAuth();
  const esGerencia = hasAnyRole(["admin", "manager"]);

  const [fecha, setFecha] = useState<Date>(new Date());
  const [seleccion, setSeleccion] = useState<string[] | null>(null);
  const [params, setParams] = useState<{ fecha: string; ids: string[] } | null>(null);

  const { data: ejecutivos = [] } = useQuery({
    queryKey: ["reporte-diario-ejecutivos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return (data || []) as EjecutivoOption[];
    },
  });

  const selectedIds = useMemo(() => {
    if (seleccion) return seleccion;
    if (esGerencia) return ejecutivos.map((e) => e.user_id);
    return user?.id ? [user.id] : [];
  }, [seleccion, esGerencia, ejecutivos, user?.id]);

  const toggle = (id: string) => {
    if (!esGerencia && id !== user?.id) return;
    setSeleccion((prev) => {
      const base = prev ?? selectedIds;
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });
  };

  const nombreDe = (id: string) =>
    ejecutivos.find((e) => e.user_id === id)?.full_name || "Sin nombre";

  const { data: reportes = [], isFetching } = useQuery({
    queryKey: ["reporte-diario", params?.fecha, params?.ids],
    enabled: !!params && (params?.ids.length || 0) > 0,
    queryFn: async () => {
      const day = params!.fecha;
      const ids = params!.ids;
      const startIso = new Date(`${day}T00:00:00`).toISOString();
      const endIso = new Date(`${day}T23:59:59.999`).toISOString();

      const [docsRes, pagosRes, compsRes, actsRes] = await Promise.all([
        supabase
          .from("documentos")
          .select("tipo_documento, empresa_vendedora, total, unidades_equivalentes_total, ejecutivo_venta_id")
          .eq("is_active", true)
          .eq("fecha_documento", day)
          .in("ejecutivo_venta_id", ids),
        supabase
          .from("cobranza_pagos")
          .select("empresa_vendedora, monto_total, creado_por")
          .eq("fecha_pago", day)
          .in("creado_por", ids),
        supabase
          .from("companies")
          .select("id, created_by")
          .gte("created_at", startIso)
          .lte("created_at", endIso)
          .in("created_by", ids),
        supabase
          .from("crm_activities")
          .select("user_id, company_id, title, description, activity_date, companies:company_id(name)")
          .gte("activity_date", startIso)
          .lte("activity_date", endIso)
          .in("user_id", ids)
          .order("activity_date"),
      ]);

      for (const r of [docsRes, pagosRes, compsRes, actsRes]) {
        if (r.error) throw r.error;
      }

      const docs = (docsRes.data || []) as any[];
      const pagos = (pagosRes.data || []) as any[];
      const comps = (compsRes.data || []) as any[];
      const acts = (actsRes.data || []) as any[];

      return ids.map<ReporteEjecutivo>((id) => {
        const misDocs = docs.filter((d) => d.ejecutivo_venta_id === id);
        const misFacturas = misDocs.filter((d) => d.tipo_documento === "factura");

        const ventasMap = new Map<string, EmpresaAgg>();
        for (const f of misFacturas) {
          const key = f.empresa_vendedora || "sin_empresa";
          const cur = ventasMap.get(key) || { empresa: key, unidades: 0, importe: 0 };
          cur.unidades += Number(f.unidades_equivalentes_total) || 0;
          cur.importe += Number(f.total) || 0;
          ventasMap.set(key, cur);
        }

        const cobranzaMap = new Map<string, EmpresaAgg>();
        for (const p of pagos.filter((x) => x.creado_por === id)) {
          const key = p.empresa_vendedora || "sin_empresa";
          const cur = cobranzaMap.get(key) || { empresa: key, unidades: 0, importe: 0 };
          cur.importe += Number(p.monto_total) || 0;
          cobranzaMap.set(key, cur);
        }

        const nuevasEmpresas = new Set(comps.filter((c) => c.created_by === id).map((c) => c.id));
        const misActs = acts.filter((a) => a.user_id === id);
        const atendidas = new Set(
          misActs.map((a) => a.company_id).filter((cid) => cid && !nuevasEmpresas.has(cid))
        );

        return {
          userId: id,
          nombre: nombreDe(id),
          ventas: Array.from(ventasMap.values()),
          cobranza: Array.from(cobranzaMap.values()),
          prospectos: nuevasEmpresas.size,
          clientesAtendidos: atendidas.size,
          cotizaciones: misDocs.filter((d) => d.tipo_documento === "cotizacion").length,
          pedidos: misDocs.filter((d) => d.tipo_documento === "pedido").length,
          facturas: misFacturas.length,
          actividades: misActs.map((a) => ({
            cliente: a.companies?.name || "Sin empresa",
            descripcion: (a.description || "").trim() || a.title || "",
            fecha: a.activity_date,
          })),
        };
      });
    },
  });

  const generar = () => {
    if (selectedIds.length === 0) {
      toast.error("Selecciona al menos un ejecutivo");
      return;
    }
    setParams({ fecha: format(fecha, "yyyy-MM-dd"), ids: selectedIds });
  };

  const descargarExcel = () => {
    if (reportes.length === 0) {
      toast.error("Primero genera el reporte");
      return;
    }
    const day = params!.fecha;
    const wb = XLSX.utils.book_new();
    const usados = new Set<string>();

    for (const r of reportes) {
      const aoa: (string | number)[][] = [];
      aoa.push([`Reporte diario — ${r.nombre}`]);
      aoa.push([`Fecha: ${day}`]);
      aoa.push([]);
      aoa.push(["Ventas del día"]);
      aoa.push(["Empresa", "Unidades", "Importe"]);
      if (r.ventas.length === 0) aoa.push(["Sin ventas", 0, 0]);
      r.ventas.forEach((v) => aoa.push([EMPRESA_LABELS[v.empresa] || v.empresa, v.unidades, v.importe]));
      aoa.push([]);
      aoa.push(["Cobranza del día"]);
      aoa.push(["Empresa", "Importe"]);
      if (r.cobranza.length === 0) aoa.push(["Sin cobranza", 0]);
      r.cobranza.forEach((c) => aoa.push([EMPRESA_LABELS[c.empresa] || c.empresa, c.importe]));
      aoa.push([]);
      aoa.push(["Indicadores"]);
      aoa.push(["Prospectos generados", r.prospectos]);
      aoa.push(["Clientes atendidos", r.clientesAtendidos]);
      aoa.push(["Cotizaciones enviadas", r.cotizaciones]);
      aoa.push(["Pedidos confirmados", r.pedidos]);
      aoa.push(["Facturas realizadas", r.facturas]);
      aoa.push([]);
      aoa.push(["Actividades"]);
      aoa.push(["Cliente", "Descripción"]);
      if (r.actividades.length === 0) aoa.push(["Sin actividades", ""]);
      r.actividades.forEach((a) => aoa.push([a.cliente, a.descripcion]));

      let sheetName = (r.nombre || "Ejecutivo").replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
      let i = 2;
      while (usados.has(sheetName)) {
        sheetName = `${sheetName.slice(0, 28)} ${i++}`;
      }
      usados.add(sheetName);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheetName);
    }

    XLSX.writeFile(wb, `reporte_diario_${day}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <BackButton />
      <PageBanner
        title="Reporte Diario"
        description="Resumen de ventas, cobranza y actividades por ejecutivo"
        avatar={
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <FileText className="h-5 w-5" />
          </div>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wide">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(fecha, "PPP", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fecha}
                  onSelect={(d) => d && setFecha(d)}
                  initialFocus
                  locale={es}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Button onClick={generar} disabled={isFetching}>
              {isFetching ? "Generando…" : "Generar reporte"}
            </Button>
            <Button variant="outline" onClick={descargarExcel} disabled={reportes.length === 0}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Descargar Excel
            </Button>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Ejecutivos
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {ejecutivos.map((e) => {
                const disabled = !esGerencia && e.user_id !== user?.id;
                return (
                  <label
                    key={e.user_id}
                    className={cn(
                      "flex items-center gap-2 text-sm rounded-md border px-2 py-1.5",
                      disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Checkbox
                      checked={selectedIds.includes(e.user_id)}
                      disabled={disabled}
                      onCheckedChange={() => toggle(e.user_id)}
                    />
                    <span className="truncate">{e.full_name || "Sin nombre"}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {reportes.length > 0 && (
        <Tabs defaultValue={reportes[0].userId} className="w-full">
          <TabsList className="flex-wrap h-auto">
            {reportes.map((r) => (
              <TabsTrigger key={r.userId} value={r.userId} className="text-xs">
                {r.nombre}
              </TabsTrigger>
            ))}
          </TabsList>

          {reportes.map((r) => (
            <TabsContent key={r.userId} value={r.userId} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard icon={<UserPlus className="h-4 w-4" />} label="Prospectos generados" value={r.prospectos} />
                <KpiCard icon={<Users className="h-4 w-4" />} label="Clientes atendidos" value={r.clientesAtendidos} />
                <KpiCard icon={<ClipboardList className="h-4 w-4" />} label="Cotizaciones" value={r.cotizaciones} />
                <KpiCard icon={<ClipboardList className="h-4 w-4" />} label="Pedidos" value={r.pedidos} />
                <KpiCard icon={<FileText className="h-4 w-4" />} label="Facturas" value={r.facturas} />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm uppercase tracking-wide">Ventas del día</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead className="text-right">Unidades</TableHead>
                          <TableHead className="text-right">Importe</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {r.ventas.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground text-sm">
                              Sin ventas
                            </TableCell>
                          </TableRow>
                        ) : (
                          r.ventas.map((v) => (
                            <TableRow key={v.empresa}>
                              <TableCell>{EMPRESA_LABELS[v.empresa] || v.empresa}</TableCell>
                              <TableCell className="text-right">{num(v.unidades)}</TableCell>
                              <TableCell className="text-right">{money(v.importe)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm uppercase tracking-wide">Cobranza del día</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead className="text-right">Importe</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {r.cobranza.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground text-sm">
                              Sin cobranza
                            </TableCell>
                          </TableRow>
                        ) : (
                          r.cobranza.map((c) => (
                            <TableRow key={c.empresa}>
                              <TableCell>{EMPRESA_LABELS[c.empresa] || c.empresa}</TableCell>
                              <TableCell className="text-right">{money(c.importe)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm uppercase tracking-wide">Actividades</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30%]">Cliente</TableHead>
                        <TableHead>Descripción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.actividades.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-muted-foreground text-sm">
                            Sin actividades registradas
                          </TableCell>
                        </TableRow>
                      ) : (
                        r.actividades.map((a, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{a.cliente}</TableCell>
                            <TableCell className="whitespace-pre-wrap">{a.descripcion}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        <p className="text-2xl font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

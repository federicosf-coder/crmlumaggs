import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageBanner } from "@/components/PageBanner";
import { BackButton } from "@/components/BackButton";
import { cn } from "@/lib/utils";
import { calcularGuia, rangosCorte, type FacturaGuia } from "@/lib/guiaBatalla";
import { AlertTriangle } from "lucide-react";

const MARCAS = [
  { v: "lumaggs_chevron", l: "Lumaggs · Chevron" },
  { v: "galsa_phillips66", l: "Galsa · Phillips 66" },
];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 1 });
const fecha = (v: string) => (v ? v.split("-").reverse().join("/") : "—");

export default function GuiaBatallaReport() {
  const { user, hasAnyRole } = useAuth();
  const now = new Date();
  const [marca, setMarca] = useState("lumaggs_chevron");
  const [corte, setCorte] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`);
  const [persona, setPersona] = useState<string>("");
  const verTodos = hasAnyRole(["admin", "master"]);

  const cortes = useMemo(() => {
    const out: { v: string; l: string }[] = [];
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ v: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, l: `${MESES[d.getMonth()]} ${d.getFullYear()}` });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Personas visibles: admin/master → todos; jefe de equipo → sus integrantes; ejecutivo → él mismo.
  const { data: personas = [] } = useQuery({
    queryKey: ["guia-batalla-personas", user?.id, verTodos],
    enabled: !!user,
    queryFn: async () => {
      let ids: string[] | null = null;
      if (!verTodos) {
        const { data: tm } = await supabase.from("team_managers").select("team_id").eq("user_id", user!.id);
        const teamIds = (tm ?? []).map((t) => t.team_id);
        const set = new Set<string>([user!.id]);
        if (teamIds.length) {
          const { data: mem } = await supabase.from("team_members").select("user_id").in("team_id", teamIds);
          (mem ?? []).forEach((m) => m.user_id && set.add(m.user_id));
        }
        ids = Array.from(set);
      }
      let q = supabase.from("profiles").select("user_id, full_name, email");
      if (ids) q = q.in("user_id", ids);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? [])
        .map((p) => ({ id: p.user_id as string, nombre: (p.full_name || p.email || "Sin nombre").trim() }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    },
  });

  useEffect(() => {
    if (!persona && user && personas.length) {
      setPersona(personas.some((p) => p.id === user.id) ? user.id : personas[0].id);
    }
  }, [personas, persona, user]);

  const r = rangosCorte(corte);
  const { data: facturas = [], isLoading } = useQuery({
    queryKey: ["guia-batalla", marca, corte, persona],
    enabled: !!persona,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("empresa_id, fecha_documento, unidades_equivalentes_total, companies(name, razon_social)")
        .eq("empresa_vendedora", marca as never)
        .eq("tipo_documento", "factura")
        .eq("ejecutivo_venta_id", persona)
        .neq("estatus_factura", "cancelada")
        .or("numero_factura.is.null,numero_factura.not.ilike.RFC*")
        .gte("fecha_documento", r.inicioHistorico)
        .lt("fecha_documento", r.finCorte)
        .limit(10000);
      if (error) throw error;
      return (data ?? []).map((d: any): FacturaGuia => ({
        empresa_id: d.empresa_id,
        cliente: d.companies?.name || d.companies?.razon_social || "Sin nombre",
        fecha: d.fecha_documento ?? "",
        unidades: Number(d.unidades_equivalentes_total ?? 0),
      }));
    },
  });

  const { activos, perdidos, kpis } = useMemo(() => calcularGuia(facturas, corte), [facturas, corte]);
  const [cy, cm] = corte.split("-").map(Number);
  const mesLbl = (d: number) => MESES[(cm - 1 + d + 12) % 12];
  const nombrePersona = personas.find((p) => p.id === persona)?.nombre ?? "";

  const KPIS = [
    { l: `Unidades 90 días`, s: `${mesLbl(-3)}–${mesLbl(-1)}`, v: kpis.u90 },
    { l: "Promedio mensual", s: "90 días ÷ 3", v: kpis.promedio },
    { l: "Mes anterior", s: mesLbl(-1), v: kpis.mesAnterior },
    { l: "Lleva este mes", s: `${MESES[cm - 1]} ${cy}`, v: kpis.esteMes, avance: kpis.promedio ? kpis.esteMes / kpis.promedio : 0 },
    { l: "Esperado este mes", s: "según frecuencia de compra", v: kpis.esperadoMes },
  ];

  const th = "text-[10px] uppercase tracking-wide font-semibold text-foreground/80 border-r last:border-r-0";

  return (
    <>
      <div className="container mx-auto px-4 pt-4">
        <BackButton fallback="/reports" label="Volver a Reportes" />
      </div>
      <PageBanner title="Guía de Batalla por Ejecutivo" description="Clientes a cuidar este mes: ningún cliente sin venta." />
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border overflow-hidden">
            {MARCAS.map((m) => (
              <button key={m.v} type="button" onClick={() => setMarca(m.v)} aria-pressed={marca === m.v}
                className={cn("px-4 py-1.5 text-xs font-semibold transition-all", marca === m.v ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {m.l}
              </button>
            ))}
          </div>
          <Select value={persona} onValueChange={setPersona} disabled={personas.length <= 1}>
            <SelectTrigger className="h-8 w-64 rounded-full text-xs"><SelectValue placeholder="Ejecutivo" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {personas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={corte} onValueChange={setCorte}>
            <SelectTrigger className="h-8 w-44 rounded-full text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {cortes.map((c) => <SelectItem key={c.v} value={c.v}>Corte {c.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {KPIS.map((k) => (
            <Card key={k.l}><CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{k.l}</p>
              <p className="text-2xl font-semibold mt-1">{fmt(k.v)}</p>
              <p className="text-xs text-muted-foreground font-light">{k.s}{k.avance !== undefined && kpis.promedio > 0 ? ` · ${Math.round(k.avance * 100)}% del promedio` : ""}</p>
            </CardContent></Card>
          ))}
        </div>

        <Card><CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30">
            <p className="text-xs uppercase tracking-wide font-semibold">{nombrePersona} · Clientes activos ({kpis.clientes})</p>
            {kpis.sinCompraMes > 0 && <Badge variant="destructive" className="text-[10px]">{kpis.sinCompraMes} sin compra en {MESES[cm - 1]}</Badge>}
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow>
                  <TableHead className={th}>Cliente</TableHead>
                  <TableHead className={cn(th, "text-right")}>Unidades 90 días</TableHead>
                  <TableHead className={cn(th, "text-right")}>Promedio mensual</TableHead>
                  <TableHead className={cn(th, "text-right")}>{mesLbl(-1)}</TableHead>
                  <TableHead className={cn(th, "text-right")}>Lleva {MESES[cm - 1]}</TableHead>
                  <TableHead className={cn(th, "text-right")}>Frecuencia</TableHead>
                  <TableHead className={th}>Próxima compra est.</TableHead>
                  <TableHead className={cn(th, "text-right")}>Esperado {MESES[cm - 1]}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Cargando…</TableCell></TableRow>}
                {!isLoading && activos.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sin clientes activos en este corte.</TableCell></TableRow>}
                {activos.map((a, i) => (
                  <TableRow key={a.empresa_id} className={cn(i % 2 && "bg-muted/30", a.esteMes <= 0 && "bg-destructive/5")}>
                    <TableCell className="border-r font-medium">
                      {a.cliente}
                      {a.esteMes <= 0 && <AlertTriangle className="inline h-3.5 w-3.5 ml-1.5 text-destructive" />}
                    </TableCell>
                    <TableCell className="border-r text-right tabular-nums">{fmt(a.u90)}</TableCell>
                    <TableCell className="border-r text-right tabular-nums">{fmt(a.promedio)}</TableCell>
                    <TableCell className="border-r text-right tabular-nums">{fmt(a.mesAnterior)}</TableCell>
                    <TableCell className={cn("border-r text-right tabular-nums font-semibold", a.esteMes <= 0 ? "text-destructive" : a.esteMes >= a.promedio ? "text-primary" : "")}>{fmt(a.esteMes)}</TableCell>
                    <TableCell className="border-r text-right tabular-nums text-muted-foreground">{a.frecuenciaDias ? `c/${a.frecuenciaDias} días` : "—"}</TableCell>
                    <TableCell className="border-r">
                      {a.proximaCompra ? fecha(a.proximaCompra) : "—"}
                      {a.atrasado && <Badge variant="destructive" className="ml-1.5 text-[9px]">Atrasado</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmt(a.esperadoMes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-0">
          <div className="px-4 py-3 border-b bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30">
            <p className="text-xs uppercase tracking-wide font-semibold">Clientes sin compra en más de 91 días ({perdidos.length})</p>
            <p className="text-xs text-muted-foreground font-light">Total y promedio mensual de los 12 meses previos al corte.</p>
          </div>
          <div className="max-h-[50vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                <TableRow>
                  <TableHead className={th}>Cliente</TableHead>
                  <TableHead className={th}>Última compra</TableHead>
                  <TableHead className={cn(th, "text-right")}>Total comprado</TableHead>
                  <TableHead className={cn(th, "text-right")}>Promedio mensual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!isLoading && perdidos.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sin clientes inactivos.</TableCell></TableRow>}
                {perdidos.map((p, i) => (
                  <TableRow key={p.empresa_id} className={cn(i % 2 && "bg-muted/30")}>
                    <TableCell className="border-r font-medium">{p.cliente}</TableCell>
                    <TableCell className="border-r">{fecha(p.ultimaCompra)}</TableCell>
                    <TableCell className="border-r text-right tabular-nums">{fmt(p.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(p.promedio)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent></Card>
      </div>
    </>
  );
}

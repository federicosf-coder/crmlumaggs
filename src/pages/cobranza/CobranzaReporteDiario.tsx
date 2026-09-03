import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageBanner } from "@/components/PageBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { FileBarChart, Info } from "lucide-react";

type PeriodoKey = "hoy" | "ayer" | "semana" | "mes" | "periodo";

const PERIODOS: { key: PeriodoKey; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
  { key: "periodo", label: "Periodo" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const TIPO_PAGO_LABEL: Record<string, string> = {
  contado: "Contado",
  credito: "Crédito Directo",
  credito_directo: "Crédito Directo",
  credito_cescemex: "Cescemex",
  sin_tipo: "Sin tipo",
};

function KpiCard({
  label,
  value,
  destacada,
}: {
  label: string;
  value: number;
  destacada?: boolean;
}) {
  return (
    <Card className={destacada ? "border-primary/40 bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30" : ""}>
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        <p className={`mt-1 font-semibold tabular-nums ${destacada ? "text-2xl md:text-3xl" : "text-lg md:text-xl"}`}>
          {formatCurrency(value)}
        </p>
      </CardContent>
    </Card>
  );
}

export default function CobranzaReporteDiario() {
  const [periodo, setPeriodo] = useState<PeriodoKey>("hoy");
  const hoyStr = ymd(new Date());
  const [customDesde, setCustomDesde] = useState(hoyStr);
  const [customHasta, setCustomHasta] = useState(hoyStr);
  const [plazasSel, setPlazasSel] = useState<string[]>([]);

  const { desde, hasta } = useMemo(() => {
    const hoy = new Date();
    if (periodo === "hoy") return { desde: ymd(hoy), hasta: ymd(hoy) };
    if (periodo === "ayer") {
      const a = new Date(hoy);
      a.setDate(a.getDate() - 1);
      return { desde: ymd(a), hasta: ymd(a) };
    }
    if (periodo === "semana") {
      const d = new Date(hoy);
      const dow = (d.getDay() + 6) % 7; // lunes = 0
      d.setDate(d.getDate() - dow);
      return { desde: ymd(d), hasta: ymd(hoy) };
    }
    if (periodo === "mes") {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return { desde: ymd(d), hasta: ymd(hoy) };
    }
    return { desde: customDesde, hasta: customHasta };
  }, [periodo, customDesde, customHasta]);

  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas-active"],
    queryFn: async () => {
      const { data } = await supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre");
      return data ?? [];
    },
  });

  const togglePlaza = (id: string) =>
    setPlazasSel((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const { data: pagos = [], isLoading: loadingPagos } = useQuery({
    queryKey: ["cobranza-reporte-pagos", desde, hasta, plazasSel],
    queryFn: async () => {
      let q = supabase
        .from("cobranza_pagos")
        .select("id, fecha_pago, monto_total, tipo_pago, empresa_id, companies:empresa_id(name)")
        .gte("fecha_pago", desde)
        .lte("fecha_pago", hasta)
        .order("fecha_pago", { ascending: false });
      if (plazasSel.length) q = q.in("plaza_id", plazasSel);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: facturas = [] } = useQuery({
    queryKey: ["cobranza-reporte-facturas", desde, hasta, plazasSel],
    queryFn: async () => {
      let q = supabase
        .from("documentos")
        .select("id, total, tipo_pago")
        .eq("tipo_documento", "factura")
        .eq("is_active", true)
        .gte("fecha_documento", desde)
        .lte("fecha_documento", hasta);
      if (plazasSel.length) q = q.in("plaza_id", plazasSel);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: cartera = [] } = useQuery({
    queryKey: ["cobranza-reporte-cartera", hasta, plazasSel],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("calcular_cartera_al_dia", {
        p_fecha_corte: hasta,
        p_plaza_ids: plazasSel.length ? plazasSel : null,
      } as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const sumPagos = (tipo?: string) =>
    pagos
      .filter((p) => (tipo ? p.tipo_pago === tipo : true))
      .reduce((a, p) => a + Number(p.monto_total || 0), 0);

  const sumFacturas = (tipo: string) =>
    facturas.filter((f) => f.tipo_pago === tipo).reduce((a, f) => a + Number(f.total || 0), 0);

  const carteraBy = (tipo: string, campo: "saldo_total" | "saldo_vencido") =>
    cartera.filter((c) => c.tipo_pago === tipo).reduce((a, c) => a + Number(c[campo] || 0), 0);
  const carteraTotal = (campo: "saldo_total" | "saldo_vencido") =>
    cartera.reduce((a, c) => a + Number(c[campo] || 0), 0);

  const filas = pagos.slice(0, 200);

  return (
    <div className="space-y-6">
      <PageBanner
        title="Reporte de Cobranza"
        description="Cobrado, facturado y cartera por periodo y plaza"
        avatar={
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <FileBarChart className="h-5 w-5" />
          </div>
        }
      />

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Periodo</Label>
            <div className="flex flex-wrap gap-2">
              {PERIODOS.map((p) => (
                <Button
                  key={p.key}
                  size="sm"
                  variant={periodo === p.key ? "default" : "outline"}
                  onClick={() => setPeriodo(p.key)}
                  className="rounded-full"
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {periodo === "periodo" && (
              <div className="flex flex-wrap gap-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Desde</Label>
                  <Input type="date" value={customDesde} onChange={(e) => setCustomDesde(e.target.value)} className="w-[170px]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hasta</Label>
                  <Input type="date" value={customHasta} onChange={(e) => setCustomHasta(e.target.value)} className="w-[170px]" />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Plaza</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={plazasSel.length === 0 ? "default" : "outline"}
                onClick={() => setPlazasSel([])}
                className="rounded-full"
              >
                Todas
              </Button>
              {plazas.map((p: any) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant={plazasSel.includes(p.id) ? "default" : "outline"}
                  onClick={() => togglePlaza(p.id)}
                  className="rounded-full"
                >
                  {p.nombre}
                </Button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground font-light">
            Del {formatDate(desde)} al {formatDate(hasta)}
          </p>
        </CardContent>
      </Card>

      {/* Cobrado */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cobrado en el periodo</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <KpiCard label="Total Cobrado" value={sumPagos()} destacada />
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard label="Contado" value={sumPagos("contado")} />
            <KpiCard label="Crédito Directo" value={sumPagos("credito")} />
            <KpiCard label="Cescemex" value={sumPagos("credito_cescemex")} />
          </div>
        </div>
      </section>

      {/* Facturado */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Facturado en el periodo</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard label="Facturado Contado" value={sumFacturas("contado")} />
          <KpiCard label="Facturado Crédito Directo" value={sumFacturas("credito_directo")} />
          <KpiCard label="Facturado Cescemex" value={sumFacturas("credito_cescemex")} />
        </div>
      </section>

      {/* Cartera */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Cartera al cierre del periodo
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard label="Total Cartera" value={carteraTotal("saldo_total")} />
          <KpiCard label="Crédito Directo" value={carteraBy("credito_directo", "saldo_total")} />
          <KpiCard label="Cescemex" value={carteraBy("credito_cescemex", "saldo_total")} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard label="Total Vencido" value={carteraTotal("saldo_vencido")} />
          <KpiCard label="Vencido Directo" value={carteraBy("credito_directo", "saldo_vencido")} />
          <KpiCard label="Vencido Cescemex" value={carteraBy("credito_cescemex", "saldo_vencido")} />
        </div>
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground font-light">
          <Info className="h-3.5 w-3.5 mt-[1px] shrink-0" />
          Cartera calculada al cierre de {formatDate(hasta)}. Los montos de fechas pasadas pueden estar ligeramente
          sobrestimados por un hueco de datos ya identificado en pagos aplicados históricos.
        </p>
      </section>

      {/* Desglose */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm uppercase tracking-wide">Desglose</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30">
                  <TableHead className="text-[11px] uppercase tracking-wide">Cliente</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Fecha de pago</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Tipo</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPagos ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Cargando…</TableCell>
                  </TableRow>
                ) : filas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Sin pagos en el periodo seleccionado
                    </TableCell>
                  </TableRow>
                ) : (
                  filas.map((p) => (
                    <TableRow key={p.id} className="odd:bg-muted/30 hover:bg-blue-50/40">
                      <TableCell className="font-light">{p.companies?.name ?? "—"}</TableCell>
                      <TableCell className="font-light">{formatDate(p.fecha_pago)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {TIPO_PAGO_LABEL[p.tipo_pago ?? "sin_tipo"] ?? p.tipo_pago}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(Number(p.monto_total || 0))}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {pagos.length > filas.length && (
            <p className="px-4 py-2 text-xs text-muted-foreground font-light">
              Mostrando los primeros {filas.length} de {pagos.length} pagos.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

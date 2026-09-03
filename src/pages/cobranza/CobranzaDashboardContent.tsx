import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";

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

type EmpresaKey = "lumaggs_chevron" | "galsa_phillips66" | "combinado";

const EMPRESAS: { key: EmpresaKey; label: string; sub: string; accent: string; badge: string; head: string }[] = [
  {
    key: "lumaggs_chevron",
    label: "Lumaggs",
    sub: "Chevron",
    accent: "border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50/70 to-transparent dark:from-blue-950/20",
    badge: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
    head: "text-blue-700 dark:text-blue-300",
  },
  {
    key: "galsa_phillips66",
    label: "Galsa",
    sub: "Phillips 66",
    accent: "border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50/70 to-transparent dark:from-orange-950/20",
    badge: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300",
    head: "text-orange-700 dark:text-orange-300",
  },
  {
    key: "combinado",
    label: "Combinado",
    sub: "Ambas empresas",
    accent: "border-l-4 border-l-slate-400 bg-gradient-to-br from-slate-50/70 to-transparent dark:from-slate-900/30",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    head: "text-slate-700 dark:text-slate-300",
  },
];

const EMPRESA_LABEL: Record<string, string> = {
  lumaggs_chevron: "Lumaggs · Chevron",
  galsa_phillips66: "Galsa · Phillips 66",
};

const SECCION_STYLES = {
  cobrado: { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  facturado: { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  cartera: { bar: "bg-violet-500", text: "text-violet-700 dark:text-violet-400" },
  vencido: { bar: "bg-red-500", text: "text-red-700 dark:text-red-400" },
};

function SectionHeader({
  titulo,
  variante,
  nota,
}: {
  titulo: string;
  variante: keyof typeof SECCION_STYLES;
  nota?: string;
}) {
  const s = SECCION_STYLES[variante];
  return (
    <div className="flex items-center gap-3">
      <span className={`h-5 w-1.5 rounded-full ${s.bar}`} />
      <h2 className={`text-sm font-semibold uppercase tracking-wide ${s.text}`}>{titulo}</h2>
      {nota && <span className="text-[11px] text-muted-foreground font-light">{nota}</span>}
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
  destacada,
}: {
  label: string;
  value: number;
  accent: string;
  destacada?: boolean;
}) {
  return (
    <Card className={accent}>
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        <p className={`mt-1 font-semibold tabular-nums ${destacada ? "text-xl md:text-2xl" : "text-base"}`}>
          {formatCurrency(value)}
        </p>
      </CardContent>
    </Card>
  );
}

function EmpresaBloque({
  empresaKey,
  titulos,
  valores,
}: {
  empresaKey: EmpresaKey;
  titulos: string[];
  valores: number[];
}) {
  const emp = EMPRESAS.find((e) => e.key === empresaKey)!;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className={`text-xs font-semibold uppercase tracking-wide ${emp.head}`}>{emp.label}</span>
        <span className="text-[11px] text-muted-foreground font-light">{emp.sub}</span>
      </div>
      <KpiCard label={titulos[0]} value={valores[0]} accent={emp.accent} destacada />
      <div className="grid gap-2 grid-cols-3">
        {titulos.slice(1).map((t, i) => (
          <KpiCard key={t} label={t} value={valores[i + 1]} accent={emp.accent} />
        ))}
      </div>
    </div>
  );
}

export default function CobranzaDashboardContent() {
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
        .select("id, fecha_pago, monto_total, tipo_pago, empresa_vendedora, empresa_id, companies:empresa_id(name)")
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
        .select("id, total, tipo_pago, empresa_vendedora")
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

  const matchEmpresa = (row: any, emp: EmpresaKey) =>
    emp === "combinado" ? true : row.empresa_vendedora === emp;

  const sumPagos = (emp: EmpresaKey, tipo?: string) =>
    pagos
      .filter((p) => matchEmpresa(p, emp) && (tipo ? p.tipo_pago === tipo : true))
      .reduce((a, p) => a + Number(p.monto_total || 0), 0);

  const sumFacturas = (emp: EmpresaKey, tipo?: string) =>
    facturas
      .filter((f) => matchEmpresa(f, emp) && (tipo ? f.tipo_pago === tipo : true))
      .reduce((a, f) => a + Number(f.total || 0), 0);

  const sumCartera = (emp: EmpresaKey, campo: "saldo_total" | "saldo_vencido", tipo?: string) =>
    cartera
      .filter((c) => matchEmpresa(c, emp) && (tipo ? c.tipo_pago === tipo : true))
      .reduce((a, c) => a + Number(c[campo] || 0), 0);

  const filas = pagos.slice(0, 200);

  const bloques: EmpresaKey[] = ["lumaggs_chevron", "galsa_phillips66", "combinado"];

  return (
    <div className="space-y-6">
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
        <SectionHeader titulo="Cobrado en el periodo" variante="cobrado" />
        <div className="grid gap-4 lg:grid-cols-3">
          {bloques.map((b) => (
            <EmpresaBloque
              key={b}
              empresaKey={b}
              titulos={["Total Cobrado", "Contado", "Crédito Directo", "Cescemex"]}
              valores={[
                sumPagos(b),
                sumPagos(b, "contado"),
                sumPagos(b, "credito"),
                sumPagos(b, "credito_cescemex"),
              ]}
            />
          ))}
        </div>
      </section>

      {/* Facturado */}
      <section className="space-y-3">
        <SectionHeader titulo="Facturado en el periodo" variante="facturado" />
        <div className="grid gap-4 lg:grid-cols-3">
          {bloques.map((b) => (
            <EmpresaBloque
              key={b}
              empresaKey={b}
              titulos={["Total Facturado", "Contado", "Crédito Directo", "Cescemex"]}
              valores={[
                sumFacturas(b),
                sumFacturas(b, "contado"),
                sumFacturas(b, "credito_directo"),
                sumFacturas(b, "credito_cescemex"),
              ]}
            />
          ))}
        </div>
      </section>

      {/* Cartera */}
      <section className="space-y-3">
        <SectionHeader titulo="Cartera al cierre del periodo" variante="cartera" nota={`Al ${formatDate(hasta)}`} />
        <div className="grid gap-4 lg:grid-cols-3">
          {bloques.map((b) => (
            <EmpresaBloque
              key={b}
              empresaKey={b}
              titulos={["Total Cartera", "Contado", "Crédito Directo", "Cescemex"]}
              valores={[
                sumCartera(b, "saldo_total"),
                sumCartera(b, "saldo_total", "contado"),
                sumCartera(b, "saldo_total", "credito_directo"),
                sumCartera(b, "saldo_total", "credito_cescemex"),
              ]}
            />
          ))}
        </div>
      </section>

      {/* Vencido */}
      <section className="space-y-3">
        <SectionHeader titulo="Cartera vencida" variante="vencido" />
        <div className="grid gap-4 lg:grid-cols-3">
          {bloques.map((b) => (
            <EmpresaBloque
              key={b}
              empresaKey={b}
              titulos={["Total Vencido", "Contado", "Crédito Directo", "Cescemex"]}
              valores={[
                sumCartera(b, "saldo_vencido"),
                sumCartera(b, "saldo_vencido", "contado"),
                sumCartera(b, "saldo_vencido", "credito_directo"),
                sumCartera(b, "saldo_vencido", "credito_cescemex"),
              ]}
            />
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground font-light">
          Cartera calculada al cierre de {formatDate(hasta)}, con base en el estatus de cada factura.
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
                  <TableHead className="text-[11px] uppercase tracking-wide">Empresa</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Fecha de pago</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Tipo</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPagos ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Cargando…</TableCell>
                  </TableRow>
                ) : filas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Sin pagos en el periodo seleccionado
                    </TableCell>
                  </TableRow>
                ) : (
                  filas.map((p) => {
                    const emp = EMPRESAS.find((e) => e.key === p.empresa_vendedora);
                    return (
                      <TableRow key={p.id} className="odd:bg-muted/30 hover:bg-blue-50/40">
                        <TableCell className="font-light">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                p.empresa_vendedora === "lumaggs_chevron"
                                  ? "bg-blue-500"
                                  : p.empresa_vendedora === "galsa_phillips66"
                                  ? "bg-orange-500"
                                  : "bg-muted-foreground/40"
                              }`}
                            />
                            {p.companies?.name ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {emp ? (
                            <Badge variant="outline" className={`font-normal ${emp.badge}`}>
                              {EMPRESA_LABEL[p.empresa_vendedora]}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground font-light">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-light">{formatDate(p.fecha_pago)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {TIPO_PAGO_LABEL[p.tipo_pago ?? "sin_tipo"] ?? p.tipo_pago}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(Number(p.monto_total || 0))}</TableCell>
                      </TableRow>
                    );
                  })
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

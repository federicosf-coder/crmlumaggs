import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBanner } from "@/components/PageBanner";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, ShieldCheck, Wallet, HelpCircle } from "lucide-react";
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
  const [plazasSel, setPlazasSel] = useState<string[]>([]);
  const [initPlazas, setInitPlazas] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);

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

  const { data: facturas = [], isLoading } = useQuery({
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

  const totales = useMemo(() => {
    const base: Record<Cat, { monto: number; ue: number }> = {
      cescemex: { monto: 0, ue: 0 },
      directo: { monto: 0, ue: 0 },
      sin_clasificar: { monto: 0, ue: 0 },
    };
    for (const f of facturas) {
      const c = clasificar(f.tipo_pago);
      base[c].monto += Number(f.subtotal ?? 0);
      base[c].ue += Number(f.unidades_equivalentes_total ?? 0);
    }
    return base;
  }, [facturas]);

  const totalGeneral = totales.cescemex.monto + totales.directo.monto + totales.sin_clasificar.monto;

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
      { cliente: string; cat: Cat; monto: number; ue: number; meses: Map<string, { monto: number; ue: number }> }
    >();
    for (const f of facturas) {
      const cat = clasificar(f.tipo_pago);
      const cliente = f.companies?.razon_social || f.companies?.name || "Sin cliente";
      const key = `${f.empresa_id ?? "none"}|${cat}`;
      let e = map.get(key);
      if (!e) {
        e = { cliente, cat, monto: 0, ue: 0, meses: new Map() };
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
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.monto - a.monto);
  }, [facturas]);

  const money = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
  const fmt = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 2 });

  const togglePlaza = (id: string) =>
    setPlazasSel((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  return (
    <>
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
                </CardContent>
              </Card>
            );
          })}
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
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">UE {ANIO}</TableHead>
                  <TableHead className="text-right">Subtotal {ANIO}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porCliente.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={5} className="bg-muted/20 p-0">
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
      </div>
    </>
  );
}
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBanner } from "@/components/PageBanner";
import { BackButton } from "@/components/BackButton";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

const PRODUCTO_IDS = [
  "36a85ea1-dfa5-46bf-9863-8f27cca12ee1",
  "d8356bf0-ed8a-4bff-b787-55d2c61fc04f",
  "65b586dd-be9a-4f6c-a559-0fd6591c0404",
  "e10a5967-3a53-48dc-bc06-a1b360507ea8",
  "50f66dda-575b-4a8b-83c0-865a9d06a988",
];

const MESES_ABBR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function DeloXLEReport() {
  const [plazasSel, setPlazasSel] = useState<string[]>([]);
  const [initPlazas, setInitPlazas] = useState(false);

  const { desde, hasta, meses } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const keys: string[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      keys.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    }
    return {
      desde: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`,
      hasta: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      meses: keys,
    };
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

  const { data: lineas = [], isLoading } = useQuery({
    queryKey: ["delo-xle", desde, hasta, todas ? "all" : plazasSel.join(",")],
    enabled: initPlazas,
    queryFn: async () => {
      let q = supabase
        .from("documento_productos")
        .select("unidades_equivalentes, documentos!inner(fecha_documento, plaza_id)")
        .in("producto_id", PRODUCTO_IDS)
        .eq("documentos.tipo_documento", "factura")
        .neq("documentos.estatus_factura", "cancelada")
        .eq("documentos.is_active", true)
        .gte("documentos.fecha_documento", desde)
        .lte("documentos.fecha_documento", hasta);
      if (!todas && plazasSel.length) q = q.in("documentos.plaza_id", plazasSel);
      const { data, error } = await q.limit(20000);
      if (error) throw error;
      return (data ?? []) as unknown as {
        unidades_equivalentes: number | null;
        documentos: { fecha_documento: string | null; plaza_id: string | null } | null;
      }[];
    },
  });

  const rows = useMemo(() => {
    const map = new Map<string, number>();
    meses.forEach((m) => map.set(m, 0));
    for (const l of lineas) {
      const f = l.documentos?.fecha_documento;
      if (!f) continue;
      const key = f.slice(0, 7);
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + Number(l.unidades_equivalentes ?? 0));
    }
    return meses.map((m, i) => {
      const ue = map.get(m) ?? 0;
      const prev = i > 0 ? map.get(meses[i - 1]) ?? 0 : null;
      const [y, mm] = m.split("-");
      return {
        key: m,
        label: `${MESES_ABBR[Number(mm) - 1]} ${y}`,
        ue,
        delta: prev === null ? null : ue - prev,
        pct: prev === null || prev === 0 ? null : ((ue - prev) / prev) * 100,
      };
    });
  }, [lineas, meses]);

  const total = rows.reduce((a, r) => a + r.ue, 0);
  const fmt = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 2 });

  const togglePlaza = (id: string) =>
    setPlazasSel((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  return (
    <>
      <div className="container mx-auto px-4 pt-4">
        <BackButton fallback="/reports" label="Volver a Reportes" />
      </div>
      <PageBanner
        title="Ventas Delo XLE 15W40 — Comparativo Mensual"
        description="Unidades equivalentes facturadas por mes en los últimos 12 meses (todas las presentaciones)."
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
              Unidades Equivalentes (12 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold">{fmt(total)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Unidades Equivalentes</TableHead>
                  <TableHead className="text-right">Variación (UE)</TableHead>
                  <TableHead className="text-right">Variación (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">{r.label}</TableCell>
                      <TableCell className="text-right">{fmt(r.ue)}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right",
                          r.delta === null ? "" : r.delta >= 0 ? "text-emerald-600" : "text-red-600"
                        )}
                      >
                        {r.delta === null ? "—" : `${r.delta >= 0 ? "+" : ""}${fmt(r.delta)}`}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right",
                          r.pct === null ? "" : r.pct >= 0 ? "text-emerald-600" : "text-red-600"
                        )}
                      >
                        {r.pct === null ? "—" : `${r.pct >= 0 ? "+" : ""}${r.pct.toFixed(1)}%`}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{fmt(total)}</TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

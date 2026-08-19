import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBanner } from "@/components/PageBanner";
import { BackButton } from "@/components/BackButton";
import { cn } from "@/lib/utils";

const MARCAS = [
  { v: "lumaggs_chevron", l: "Chevron" },
  { v: "galsa_phillips66", l: "Phillips 66" },
];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const ESTATUS_LABEL: Record<string, string> = {
  pendiente: "Vigente",
  pagada: "Pagada",
  vencida: "Vencida",
};

interface LineaRow {
  cantidad: number | null;
  unidades_equivalentes: number | null;
  productos: { codigo: string | null; nombre_producto: string | null } | null;
}

interface FacturaRow {
  id: string;
  numero_factura: string | null;
  estatus_factura: string | null;
  unidades_equivalentes_total: number | null;
  companies: { name: string | null } | null;
  documento_productos: LineaRow[] | null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function DesgloseFacturasReport() {
  const now = new Date();
  const [marca, setMarca] = useState("lumaggs_chevron");
  const [mes, setMes] = useState(now.getMonth());
  const [anio, setAnio] = useState(now.getFullYear());

  const desde = `${anio}-${pad(mes + 1)}-01`;
  const hasta = mes === 11 ? `${anio + 1}-01-01` : `${anio}-${pad(mes + 2)}-01`;

  const anios = useMemo(() => {
    const y = now.getFullYear();
    return [y - 3, y - 2, y - 1, y, y + 1];
  }, []);

  const { data: facturas = [], isLoading } = useQuery({
    queryKey: ["desglose-facturas", marca, desde, hasta],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select(
          "id, numero_factura, estatus_factura, unidades_equivalentes_total, companies(name), documento_productos(cantidad, unidades_equivalentes, productos(codigo, nombre_producto))"
        )
        .eq("empresa_vendedora", marca as any)
        .eq("tipo_documento", "factura")
        .neq("estatus_factura", "cancelada")
        .gte("fecha_documento", desde)
        .lt("fecha_documento", hasta)
        .order("numero_factura");
      if (error) throw error;
      return (data ?? []) as unknown as FacturaRow[];
    },
  });

  const totalUnidades = useMemo(
    () => facturas.reduce((acc, f) => acc + Number(f.unidades_equivalentes_total ?? 0), 0),
    [facturas]
  );

  const fmt = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 2 });

  return (
    <>
      <div className="container mx-auto px-4 pt-4">
        <BackButton fallback="/reports" label="Volver a Reportes" />
      </div>
      <PageBanner
        title="Desglose de Facturas con Unidades"
        description="Detalle de facturas del mes por producto para verificar su cuantificación."
      />
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Marca</Label>
              <Select value={marca} onValueChange={setMarca}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MARCAS.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Mes</Label>
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Año</Label>
              <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anios.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Total de unidades equivalentes — {MESES[mes]} {anio}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold tracking-tight">{fmt(totalUnidades)}</div>
            <p className="text-xs text-muted-foreground mt-1 font-light">
              {facturas.length} factura{facturas.length === 1 ? "" : "s"} consideradas (excluye canceladas)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Cargando...</div>
            ) : facturas.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Sin facturas en este periodo</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factura</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estatus</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facturas.map((f) => {
                    const lineas = f.documento_productos ?? [];
                    const suma = lineas.reduce((a, l) => a + Number(l.unidades_equivalentes ?? 0), 0);
                    const total = Number(f.unidades_equivalentes_total ?? 0);
                    const desfase = Math.abs(suma - total) > 0.01;
                    const span = Math.max(lineas.length, 1) + 1;
                    return (
                      <Fragment key={f.id}>
                        {lineas.length === 0 ? (
                          <TableRow key={f.id}>
                            <TableCell rowSpan={span} className="align-top font-medium">{f.numero_factura || "—"}</TableCell>
                            <TableCell rowSpan={span} className="align-top">{f.companies?.name || "—"}</TableCell>
                            <TableCell rowSpan={span} className="align-top">{ESTATUS_LABEL[f.estatus_factura ?? ""] ?? f.estatus_factura ?? "—"}</TableCell>
                            <TableCell colSpan={3} className="text-destructive font-medium">Sin productos capturados</TableCell>
                          </TableRow>
                        ) : (
                          lineas.map((l, i) => (
                            <TableRow key={`${f.id}-${i}`}>
                              {i === 0 && (
                                <>
                                  <TableCell rowSpan={span} className="align-top font-medium">{f.numero_factura || "—"}</TableCell>
                                  <TableCell rowSpan={span} className="align-top">{f.companies?.name || "—"}</TableCell>
                                  <TableCell rowSpan={span} className="align-top">{ESTATUS_LABEL[f.estatus_factura ?? ""] ?? f.estatus_factura ?? "—"}</TableCell>
                                </>
                              )}
                              <TableCell className="font-mono text-xs">{l.productos?.codigo || "—"}</TableCell>
                              <TableCell className="text-sm">{l.productos?.nombre_producto || "—"}</TableCell>
                              <TableCell className="text-right tabular-nums">{fmt(Number(l.unidades_equivalentes ?? 0))}</TableCell>
                            </TableRow>
                          ))
                        )}
                        <TableRow key={`${f.id}-sub`} className="bg-muted/40">
                          <TableCell colSpan={2} className="text-xs uppercase tracking-wide text-muted-foreground">
                            Subtotal factura
                          </TableCell>
                          <TableCell className={cn("text-right font-semibold tabular-nums", desfase && "text-destructive")}>
                            {fmt(suma)}
                            {desfase && <span className="ml-2 text-xs font-normal">(doc: {fmt(total)})</span>}
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

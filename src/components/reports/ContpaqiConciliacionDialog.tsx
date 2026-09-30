import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, FileSpreadsheet, Loader2, Upload, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { parseContpaqi, type ContpaqiFactura } from "@/lib/contpaqiParser";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  marca: string;
  desde: string;
  hasta: string;
  periodoLabel: string;
}

interface PortalLinea {
  cantidad: number | null;
  precio_unitario: number | null;
  subtotal: number | null;
  productos: { codigo: string | null; nombre_producto: string | null } | null;
}
interface PortalFactura {
  id: string;
  numero_factura: string | null;
  estatus_factura: string | null;
  subtotal: number | null;
  iva: number | null;
  total: number | null;
  fecha_documento: string | null;
  companies: { name: string | null; razon_social: string | null } | null;
  documento_productos: PortalLinea[] | null;
}

type TipoVariacion = "importe" | "partida" | "estatus";

interface Variacion {
  numero: string;
  id: string;
  cliente: string;
  tipo: TipoVariacion;
  detalle: string;
  contpaqi: string;
  portal: string;
}

const mxn = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });

const norm = (s: string | null | undefined) => (s ?? "").replace(/[\s-]/g, "").toUpperCase();

export function ContpaqiConciliacionDialog({ open, onOpenChange, marca, desde, hasta, periodoLabel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cargando, setCargando] = useState(false);
  const [archivo, setArchivo] = useState<string | null>(null);
  const [contpaqi, setContpaqi] = useState<ContpaqiFactura[] | null>(null);
  const [portal, setPortal] = useState<PortalFactura[] | null>(null);

  const ejecutar = async (file: File) => {
    setCargando(true);
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseContpaqi(buf);
      if (!parsed.length) {
        toast.error("No se reconocieron facturas en el archivo");
        setCargando(false);
        return;
      }
      const { data, error } = await supabase
        .from("documentos")
        .select(
          "id, numero_factura, estatus_factura, subtotal, iva, total, fecha_documento, companies(name, razon_social), documento_productos(cantidad, precio_unitario, subtotal, productos(codigo, nombre_producto))"
        )
        .eq("empresa_vendedora", marca as never)
        .eq("tipo_documento", "factura")
        .gte("fecha_documento", desde)
        .lt("fecha_documento", hasta)
        .limit(5000);
      if (error) throw error;
      setArchivo(file.name);
      setContpaqi(parsed);
      setPortal((data ?? []) as unknown as PortalFactura[]);
      toast.success(`Revisión lista: ${parsed.length} facturas del archivo comparadas`);
    } catch (e) {
      toast.error("No se pudo leer el archivo", { description: (e as Error).message });
    } finally {
      setCargando(false);
    }
  };

  const resultado = useMemo(() => {
    if (!contpaqi || !portal) return null;
    const mapPortal = new Map<string, PortalFactura>();
    portal.forEach((p) => {
      const k = norm(p.numero_factura);
      if (k) mapPortal.set(k, p);
    });
    const clavesContpaqi = new Set(contpaqi.map((c) => norm(c.numero)));

    const faltantes: ContpaqiFactura[] = [];
    const huerfanas: PortalFactura[] = [];
    const variaciones: Variacion[] = [];
    let cuadradas = 0;

    for (const c of contpaqi) {
      const p = mapPortal.get(norm(c.numero));
      if (!p) {
        faltantes.push(c);
        continue;
      }
      const cliente = p.companies?.name || p.companies?.razon_social || "—";
      const antes = variaciones.length;

      const portalCancelada = (p.estatus_factura ?? "") === "cancelada";
      if (portalCancelada !== c.cancelada) {
        variaciones.push({
          numero: c.numero,
          id: p.id,
          cliente,
          tipo: "estatus",
          detalle: "Estatus distinto",
          contpaqi: c.cancelada ? "Cancelada" : "Vigente",
          portal: portalCancelada ? "Cancelada" : "Vigente",
        });
      }

      const totalPortal = Number(p.total ?? 0);
      if (Math.abs(totalPortal - c.total) > 0.5) {
        variaciones.push({
          numero: c.numero,
          id: p.id,
          cliente,
          tipo: "importe",
          detalle: `Diferencia de ${mxn(Math.abs(totalPortal - c.total))} en el total`,
          contpaqi: mxn(c.total),
          portal: mxn(totalPortal),
        });
      }
      const subPortal = Number(p.subtotal ?? 0);
      if (Math.abs(subPortal - c.neto) > 0.5) {
        variaciones.push({
          numero: c.numero,
          id: p.id,
          cliente,
          tipo: "importe",
          detalle: "Diferencia en el subtotal",
          contpaqi: mxn(c.neto),
          portal: mxn(subPortal),
        });
      }

      // Partidas agrupadas por código
      const agc = new Map<string, { cant: number; neto: number }>();
      c.lineas.forEach((l) => {
        const k = norm(l.codigo);
        const prev = agc.get(k) ?? { cant: 0, neto: 0 };
        agc.set(k, { cant: prev.cant + l.cantidad, neto: prev.neto + l.neto });
      });
      const agp = new Map<string, { cant: number; neto: number }>();
      (p.documento_productos ?? []).forEach((l) => {
        const k = norm(l.productos?.codigo);
        const prev = agp.get(k) ?? { cant: 0, neto: 0 };
        agp.set(k, {
          cant: prev.cant + Number(l.cantidad ?? 0),
          neto: prev.neto + Number(l.subtotal ?? 0),
        });
      });
      for (const [k, v] of agc) {
        const o = agp.get(k);
        if (!o) {
          variaciones.push({
            numero: c.numero, id: p.id, cliente, tipo: "partida",
            detalle: `Producto ${k} no está capturado en el portal`,
            contpaqi: `${v.cant} pzs · ${mxn(v.neto)}`, portal: "No existe",
          });
        } else {
          if (Math.abs(o.cant - v.cant) > 0.001) {
            variaciones.push({
              numero: c.numero, id: p.id, cliente, tipo: "partida",
              detalle: `Cantidad distinta en producto ${k}`,
              contpaqi: String(v.cant), portal: String(o.cant),
            });
          } else if (Math.abs(o.neto - v.neto) > 0.5) {
            variaciones.push({
              numero: c.numero, id: p.id, cliente, tipo: "partida",
              detalle: `Importe distinto en producto ${k}`,
              contpaqi: mxn(v.neto), portal: mxn(o.neto),
            });
          }
        }
      }
      for (const [k, v] of agp) {
        if (!agc.has(k)) {
          variaciones.push({
            numero: c.numero, id: p.id, cliente, tipo: "partida",
            detalle: `Producto ${k || "sin código"} está en el portal pero no en ContPAQi`,
            contpaqi: "No existe", portal: `${v.cant} pzs · ${mxn(v.neto)}`,
          });
        }
      }
      if (variaciones.length === antes) cuadradas++;
    }

    for (const p of portal) {
      const k = norm(p.numero_factura);
      if (k && !clavesContpaqi.has(k)) huerfanas.push(p);
    }

    const totalContpaqi = contpaqi.filter((c) => !c.cancelada).reduce((a, c) => a + c.total, 0);
    const totalPortal = portal
      .filter((p) => (p.estatus_factura ?? "") !== "cancelada")
      .reduce((a, p) => a + Number(p.total ?? 0), 0);

    return {
      faltantes,
      huerfanas,
      variaciones,
      cuadradas,
      totalContpaqi,
      totalPortal,
      pct: contpaqi.length ? Math.round((cuadradas / contpaqi.length) * 1000) / 10 : 0,
    };
  }, [contpaqi, portal]);

  const exportar = () => {
    if (!resultado) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        resultado.faltantes.map((f) => ({
          Factura: f.numero, Fecha: f.fecha, Cliente: f.cliente,
          Estado: f.estado, Total: f.total,
        }))
      ),
      "Faltantes en CRM"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        resultado.variaciones.map((v) => ({
          Factura: v.numero, Cliente: v.cliente, Tipo: v.tipo,
          Detalle: v.detalle, ContPAQi: v.contpaqi, Portal: v.portal,
        }))
      ),
      "Variaciones"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        resultado.huerfanas.map((h) => ({
          Factura: h.numero_factura, Fecha: h.fecha_documento,
          Cliente: h.companies?.name ?? "", Total: h.total,
        }))
      ),
      "Solo en el portal"
    );
    XLSX.writeFile(wb, `Conciliacion_ContPAQi_${periodoLabel.replace(/\s+/g, "_")}.xlsx`);
  };

  const abrir = (id: string) => window.open(`/documents/${id}/edit`, "_blank", "noopener,noreferrer");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 px-6 py-4 border-b">
          <DialogTitle className="text-lg font-light tracking-tight">Auditar con ContPAQi</DialogTitle>
          <DialogDescription className="text-xs font-light">
            Compara las facturas de {periodoLabel} contra tu reporte contable y detecta lo que falta o no cuadra.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept=".xls,.xlsx,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void ejecutar(f);
                e.target.value = "";
              }}
            />
            <Button
              onClick={() => inputRef.current?.click()}
              disabled={cargando}
              className="bg-gradient-to-br from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white shadow-md text-[10px] font-semibold uppercase tracking-widest"
            >
              {cargando ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
              {contpaqi ? "Cargar otro archivo" : "Seleccionar archivo y ejecutar"}
            </Button>
            {archivo && (
              <span className="text-xs font-light text-muted-foreground flex items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" />{archivo}
              </span>
            )}
            {resultado && (
              <Button variant="outline" size="sm" onClick={exportar}
                className="border-violet-200 bg-gradient-to-r from-violet-50 to-blue-50 text-violet-700 text-[10px] font-semibold uppercase tracking-widest">
                <Download className="h-3.5 w-3.5 mr-1.5" />Descargar diferencias
              </Button>
            )}
          </div>

          {!resultado && !cargando && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm font-light text-muted-foreground">
              Sube el archivo “Impresión de Documentos” que genera tu programa contable.
            </div>
          )}

          {resultado && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  { l: "Facturas en ContPAQi", v: String(contpaqi!.length) },
                  { l: "Cuadradas al 100%", v: `${resultado.cuadradas} · ${resultado.pct}%`, ok: true },
                  { l: "Faltan en el portal", v: String(resultado.faltantes.length), bad: resultado.faltantes.length > 0 },
                  { l: "Con variaciones", v: String(resultado.variaciones.length), bad: resultado.variaciones.length > 0 },
                  { l: "Diferencia en dinero", v: mxn(resultado.totalContpaqi - resultado.totalPortal), bad: Math.abs(resultado.totalContpaqi - resultado.totalPortal) > 1 },
                ].map((k) => (
                  <Card key={k.l}>
                    <CardContent className="p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{k.l}</p>
                      <p className={cn("text-lg font-light mt-1 tabular-nums",
                        k.bad && "text-destructive", k.ok && "text-emerald-600")}>{k.v}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Tabs defaultValue="faltantes">
                <TabsList className="grid grid-cols-3 w-full bg-gradient-to-r from-violet-50 via-blue-50 to-emerald-50 p-1 h-auto gap-1 border border-violet-100">
                  <TabsTrigger value="faltantes" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-rose-500 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-md text-rose-700 text-[10px] sm:text-xs px-1 sm:px-2 py-1.5 leading-tight text-center whitespace-normal break-words min-w-0 h-auto">
                    Faltan en el portal ({resultado.faltantes.length})
                  </TabsTrigger>
                  <TabsTrigger value="variaciones" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-md text-amber-700 text-[10px] sm:text-xs px-1 sm:px-2 py-1.5 leading-tight text-center whitespace-normal break-words min-w-0 h-auto">
                    Variaciones ({resultado.variaciones.length})
                  </TabsTrigger>
                  <TabsTrigger value="huerfanas" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md text-blue-700 text-[10px] sm:text-xs px-1 sm:px-2 py-1.5 leading-tight text-center whitespace-normal break-words min-w-0 h-auto">
                    Sólo en el portal ({resultado.huerfanas.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="faltantes" className="mt-3">
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Factura</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Cliente (ContPAQi)</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resultado.faltantes.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            <CheckCircle2 className="h-4 w-4 inline mr-1.5 text-emerald-600" />Todas las facturas están registradas
                          </TableCell></TableRow>
                        ) : resultado.faltantes.map((f) => (
                          <TableRow key={f.numero}>
                            <TableCell className="font-medium">{f.numero}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{f.fecha}</TableCell>
                            <TableCell>{f.cliente}{f.esRefactura && <Badge variant="outline" className="ml-2">Refacturación</Badge>}</TableCell>
                            <TableCell><Badge variant={f.cancelada ? "outline" : "secondary"}>{f.estado}</Badge></TableCell>
                            <TableCell className="text-right tabular-nums">{mxn(f.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </TabsContent>

                <TabsContent value="variaciones" className="mt-3">
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Factura</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Qué no cuadra</TableHead>
                          <TableHead>ContPAQi</TableHead>
                          <TableHead>Portal</TableHead>
                          <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resultado.variaciones.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            <CheckCircle2 className="h-4 w-4 inline mr-1.5 text-emerald-600" />Todo cuadra
                          </TableCell></TableRow>
                        ) : resultado.variaciones.map((v, i) => (
                          <TableRow key={`${v.numero}-${i}`}>
                            <TableCell className="font-medium">{v.numero}</TableCell>
                            <TableCell className="text-sm">{v.cliente}</TableCell>
                            <TableCell className="text-sm">
                              <AlertTriangle className="h-3.5 w-3.5 inline mr-1.5 text-amber-500" />{v.detalle}
                            </TableCell>
                            <TableCell className="text-sm tabular-nums">{v.contpaqi}</TableCell>
                            <TableCell className="text-sm tabular-nums">{v.portal}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => abrir(v.id)} title="Abrir factura">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </TabsContent>

                <TabsContent value="huerfanas" className="mt-3">
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Factura</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resultado.huerfanas.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin facturas sobrantes</TableCell></TableRow>
                        ) : resultado.huerfanas.map((h) => (
                          <TableRow key={h.id}>
                            <TableCell className="font-medium">{h.numero_factura || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{h.fecha_documento ?? "—"}</TableCell>
                            <TableCell className="text-sm">{h.companies?.name || h.companies?.razon_social || "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{mxn(Number(h.total ?? 0))}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => abrir(h.id)} title="Abrir factura">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

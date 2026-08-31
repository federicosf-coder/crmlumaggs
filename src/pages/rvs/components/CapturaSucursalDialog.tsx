import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Save, Sparkles } from "lucide-react";
import { currency, mesLabel } from "../rvsAgregados";
import { parsearReporte, type FilaParseada } from "../CapturaManualTab";

const normalizar = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mes: string;
  marca: "galsa" | "lumaggs";
  onSaved?: () => void;
}

export function CapturaSucursalDialog({ open, onOpenChange, mes, marca, onSaved }: Props) {
  const [texto, setTexto] = useState("");
  const [filas, setFilas] = useState<FilaParseada[] | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { data: plazas = [] } = useQuery({
    queryKey: ["rvs_plazas_captura_sucursal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plazas").select("id, nombre");
      if (error) throw error;
      return data || [];
    },
  });

  const buscarPlaza = (nombre: string) => {
    const s = normalizar(nombre);
    return (
      plazas.find((p: any) => normalizar(p.nombre) === s) ||
      plazas.find((p: any) => s.includes(normalizar(p.nombre))) ||
      plazas.find((p: any) => normalizar(p.nombre).includes(s)) ||
      null
    );
  };

  const analizar = () => {
    const parsed = parsearReporte(texto);
    setFilas(parsed);
    if (parsed.length === 0) toast.error("No se detectaron filas en el texto pegado.");
    else toast.success(`${parsed.length} sucursales detectadas.`);
  };

  const totales = useMemo(() => {
    const f = filas || [];
    return {
      unidades: f.reduce((s, r) => s + r.unidades, 0),
      venta: f.reduce((s, r) => s + r.venta, 0),
      utilidad: f.reduce((s, r) => s + r.utilidad, 0),
    };
  }, [filas]);

  const guardar = async () => {
    if (!filas?.length) return;
    setGuardando(true);
    try {
      const { error: delErr } = await supabase
        .from("rvs_ventas_mes_plaza")
        .delete()
        .eq("anio_mes", mes)
        .eq("marca", marca);
      if (delErr) throw delErr;

      const rows = filas.map((f) => ({
        plaza_id: buscarPlaza(f.nombre)?.id ?? null,
        sucursal_reporte: f.nombre,
        anio_mes: mes,
        marca,
        unidades: f.unidades,
        venta: f.venta,
        costo: f.costo,
        utilidad: f.utilidad,
        margen: f.margen,
      }));
      const { error: insErr } = await supabase.from("rvs_ventas_mes_plaza").insert(rows);
      if (insErr) throw insErr;

      await supabase.from("rvs_reportes_intake").insert({
        marca,
        anio_mes: mes,
        estatus: "procesado",
        asunto_email: `Captura manual (sucursales) · ${mesLabel(mes)}`,
        payload_extraido: { origen: "captura_manual_sucursal", filas } as any,
      });

      toast.success(`${rows.length} sucursales guardadas para ${mesLabel(mes)}`);
      setTexto("");
      setFilas(null);
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 rounded-t-lg px-6 py-4">
          <DialogTitle className="text-base font-light uppercase tracking-wide">
            Capturar ventas por sucursal · {marca === "galsa" ? "Galsa" : "Lumaggs"} ·{" "}
            {mesLabel(mes)}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pega la tabla oficial por sucursal del correo o PDF. Esta captura sustituye el cálculo
            derivado de la plaza del vendedor (evita que la venta se cuente en la plaza equivocada).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Tabla pegada</Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={7}
              placeholder="SucursalUnidadesVentaCostoUtilidadMargenENSENADA ENS900.501,299,335.00..."
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Al guardar se reemplaza por completo el periodo de esta marca (snapshot, no acumula).
            </p>
          </div>

          {filas && filas.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30">
                    <TableHead className="text-[11px] uppercase tracking-wide">Sucursal</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide">Plaza</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide text-right">Unidades</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide text-right">Venta</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide text-right">Costo</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide text-right">Utilidad</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide text-right">Margen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((f, i) => {
                    const match: any = buscarPlaza(f.nombre);
                    return (
                      <TableRow key={`${f.nombre}-${i}`} className={i % 2 ? "bg-muted/30" : ""}>
                        <TableCell className="font-medium">{f.nombre}</TableCell>
                        <TableCell>
                          {match ? (
                            <Badge variant="secondary">{match.nombre}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              Sin plaza
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {f.unidades.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                        </TableCell>
                        <TableCell className="text-right">{currency(f.venta)}</TableCell>
                        <TableCell className="text-right">{currency(f.costo)}</TableCell>
                        <TableCell className="text-right">{currency(f.utilidad)}</TableCell>
                        <TableCell className="text-right">{f.margen?.toFixed(0)}%</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">
                      {totales.unidades.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="text-right">{currency(totales.venta)}</TableCell>
                    <TableCell />
                    <TableCell className="text-right">{currency(totales.utilidad)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="bg-muted/40 px-6 py-3">
          <Button variant="outline" onClick={analizar} disabled={!texto.trim()}>
            <Sparkles className="mr-2 h-4 w-4" /> Analizar
          </Button>
          <Button onClick={guardar} disabled={!filas?.length || guardando}>
            {guardando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar {mesLabel(mes)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardPaste, Loader2, Save, Sparkles } from "lucide-react";
import { currency, mesLabel } from "./rvsAgregados";

const normalizar = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const num = (s: string) => {
  const n = Number(String(s).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function ultimos18(): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export interface FilaParseada {
  nombre: string;
  unidades: number;
  venta: number;
  costo: number;
  utilidad: number;
  margen: number | null;
}

const NUM = "\\d{1,3}(?:,\\d{3})*\\.\\d{2}";

/** Parsea el pegado del reporte (con o sin tabuladores/saltos de línea) */
export function parsearReporte(texto: string): FilaParseada[] {
  const limpio = (texto || "").replace(/\s+/g, " ").replace(/\$/g, "");
  const re = new RegExp(
    `([^0-9]+?)\\s*(${NUM})\\s*(${NUM})\\s*(${NUM})\\s*(-?${NUM})\\s*(-?${NUM})\\s*%`,
    "g",
  );
  const filas: FilaParseada[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(limpio)) !== null) {
    const nombre = m[1]
      .replace(/^[\s\-|.,]+/, "")
      .replace(/(Agente|Sucursal|Unidades|Venta|Costo|Utilidad|Margen)+/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!nombre) continue;
    if (/^(gran\s+)?total/i.test(nombre)) continue;
    filas.push({
      nombre,
      unidades: num(m[2]),
      venta: num(m[3]),
      costo: num(m[4]),
      utilidad: num(m[5]),
      margen: num(m[6]),
    });
  }
  return filas;
}

type Tipo = "agentes" | "sucursales";

export function CapturaManualTab() {
  const qc = useQueryClient();
  const meses = useMemo(ultimos18, []);
  const [mes, setMes] = useState(meses[0]);
  const [marca, setMarca] = useState<"lumaggs" | "galsa">("lumaggs");
  const [tipo, setTipo] = useState<Tipo>("agentes");
  const [texto, setTexto] = useState("");
  const [filas, setFilas] = useState<FilaParseada[] | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { data: personas = [] } = useQuery({
    queryKey: ["rvs_personas_captura"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rvs_personas")
        .select("id, nombre_reporte, nombre_normalizado, nombre_mostrar, aliases, plaza_id");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: plazas = [] } = useQuery({
    queryKey: ["rvs_plazas_captura"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plazas").select("id, nombre");
      if (error) throw error;
      return data || [];
    },
  });

  const buscarPersona = (nombre: string) => {
    const norm = normalizar(nombre);
    return (
      personas.find((p: any) => (p.nombre_reporte || "") === nombre) ||
      personas.find(
        (p: any) =>
          normalizar(p.nombre_normalizado || "") === norm ||
          normalizar(p.nombre_reporte || "") === norm ||
          (Array.isArray(p.aliases) && p.aliases.some((a: string) => normalizar(a) === norm)),
      ) ||
      null
    );
  };

  const buscarPlaza = (nombre: string) => {
    const s = normalizar(nombre);
    return (
      plazas.find((p: any) => normalizar(p.nombre) === s) ||
      plazas.find((p: any) => s.includes(normalizar(p.nombre))) ||
      null
    );
  };

  const analizar = () => {
    const parsed = parsearReporte(texto);
    setFilas(parsed);
    if (parsed.length === 0) toast.error("No se detectaron filas en el texto pegado.");
    else toast.success(`${parsed.length} filas detectadas.`);
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
    if (!filas || filas.length === 0) return;
    setGuardando(true);
    try {
      if (tipo === "agentes") {
        const nuevas: any[] = [];
        const mapa = new Map<string, any>();
        for (const f of filas) {
          let p = buscarPersona(f.nombre);
          if (!p) {
            const norm = normalizar(f.nombre);
            const { data: creada, error } = await supabase
              .from("rvs_personas")
              .insert({
                nombre_reporte: f.nombre,
                nombre_normalizado: norm,
                nombre_mostrar: f.nombre.replace(/\s*-\s*[A-Za-z0-9]{1,6}\s*$/, "").trim() || f.nombre,
                sin_clasificar: true,
              })
              .select("id, nombre_reporte, nombre_normalizado, nombre_mostrar, aliases, plaza_id")
              .single();
            if (error) throw new Error(`No se pudo crear la persona "${f.nombre}": ${error.message}`);
            p = creada;
            nuevas.push(creada);
            personas.push(creada as any);
          }
          mapa.set(f.nombre, p);
        }

        // Snapshot: se reemplaza el mes completo de esta marca
        const { error: delErr } = await supabase
          .from("rvs_ventas_mes")
          .delete()
          .eq("anio_mes", mes)
          .eq("marca", marca);
        if (delErr) throw delErr;

        const rows = filas.map((f) => {
          const p = mapa.get(f.nombre);
          return {
            persona_id: p.id,
            anio_mes: mes,
            marca,
            unidades: f.unidades,
            venta: f.venta,
            costo: f.costo,
            utilidad: f.utilidad,
            margen: f.margen,
            plaza_id: p.plaza_id ?? null,
          };
        });
        const { error: insErr } = await supabase.from("rvs_ventas_mes").insert(rows);
        if (insErr) throw insErr;
        toast.success(
          `${rows.length} agentes guardados${nuevas.length ? ` · ${nuevas.length} personas nuevas sin clasificar` : ""}`,
        );
      } else {
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
        toast.success(`${rows.length} sucursales guardadas`);
      }

      await supabase.from("rvs_reportes_intake").insert({
        marca,
        anio_mes: mes,
        estatus: "procesado",
        asunto_email: `Captura manual (${tipo}) · ${mesLabel(mes)}`,
        payload_extraido: { origen: "captura_manual", tipo, filas } as any,
      });

      qc.invalidateQueries({ queryKey: ["rvs_reportes_mes"] });
      qc.invalidateQueries({ queryKey: ["rvs_personas"] });
      setTexto("");
      setFilas(null);
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="bg-gradient-to-r from-violet-50 to-blue-50 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-base font-light uppercase tracking-wide">
            <ClipboardPaste className="h-4 w-4" /> Captura manual del reporte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide">Marca</Label>
              <Select value={marca} onValueChange={(v) => setMarca(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lumaggs">Lumaggs</SelectItem>
                  <SelectItem value="galsa">Galsa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide">Periodo</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m} value={m}>{mesLabel(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide">Tabla pegada</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agentes">Detalle por Agente</SelectItem>
                  <SelectItem value="sucursales">Resumen por Sucursal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">
              Pega aquí el contenido de la tabla (desde el correo o el PDF)
            </Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={8}
              placeholder="AgenteUnidadesVentaCostoUtilidadMargenAGUILAR MENDOZA GILDARDO FABIAN - PSM21.7537,070.00..."
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Al guardar se reemplaza por completo el periodo de esta marca (snapshot, no acumula).
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={analizar} disabled={!texto.trim()}>
              <Sparkles className="mr-2 h-4 w-4" /> Analizar
            </Button>
            <Button onClick={guardar} disabled={!filas?.length || guardando}>
              {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar {mesLabel(mes)}
            </Button>
          </div>
        </CardContent>
      </Card>

      {filas && filas.length > 0 && (
        <Card>
          <CardHeader className="bg-gradient-to-r from-violet-50 to-blue-50 rounded-t-lg">
            <CardTitle className="text-base font-light uppercase tracking-wide">
              Vista previa · {filas.length} filas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="uppercase text-xs tracking-wide">
                    {tipo === "agentes" ? "Agente" : "Sucursal"}
                  </TableHead>
                  <TableHead className="uppercase text-xs tracking-wide">Coincidencia</TableHead>
                  <TableHead className="text-right uppercase text-xs tracking-wide">Unidades</TableHead>
                  <TableHead className="text-right uppercase text-xs tracking-wide">Venta</TableHead>
                  <TableHead className="text-right uppercase text-xs tracking-wide">Costo</TableHead>
                  <TableHead className="text-right uppercase text-xs tracking-wide">Utilidad</TableHead>
                  <TableHead className="text-right uppercase text-xs tracking-wide">Margen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f, i) => {
                  const match: any = tipo === "agentes" ? buscarPersona(f.nombre) : buscarPlaza(f.nombre);
                  return (
                    <TableRow key={`${f.nombre}-${i}`} className={i % 2 ? "bg-muted/30" : ""}>
                      <TableCell className="font-medium">{f.nombre}</TableCell>
                      <TableCell>
                        {match ? (
                          <Badge variant="secondary">
                            {match.nombre_mostrar || match.nombre_reporte || match.nombre}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            {tipo === "agentes" ? "Se creará sin clasificar" : "Sin plaza"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{f.unidades.toLocaleString("es-MX")}</TableCell>
                      <TableCell className="text-right">{currency(f.venta)}</TableCell>
                      <TableCell className="text-right">{currency(f.costo)}</TableCell>
                      <TableCell className="text-right">{currency(f.utilidad)}</TableCell>
                      <TableCell className="text-right">{f.margen?.toFixed(2)}%</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-semibold bg-muted/50">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right">{totales.unidades.toLocaleString("es-MX")}</TableCell>
                  <TableCell className="text-right">{currency(totales.venta)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right">{currency(totales.utilidad)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

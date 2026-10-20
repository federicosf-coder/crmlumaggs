import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { sugerirEjecutivoPorPlaza } from "@/lib/ejecutivoPorPlaza";

interface Props {
  plazas: { id: string; nombre: string }[];
  ejecutivos: { user_id: string; full_name: string | null; plaza_id: string | null }[];
}

const MARCA: Record<string, string> = { lumaggs_chevron: "Lumaggs", galsa_phillips66: "Galsa" };

export function RevisionPlazaEjecutivo({ plazas, ejecutivos }: Props) {
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [eleccion, setEleccion] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);

  const plazaNombre = (id: string | null) => plazas.find((p) => p.id === id)?.nombre || "—";
  const ejecMap = useMemo(() => new Map(ejecutivos.map((e) => [e.user_id, e])), [ejecutivos]);

  const { data: filas = [], isFetching } = useQuery({
    queryKey: ["revision-plaza-ejecutivo", mes, ejecutivos.length],
    enabled: abierto && ejecutivos.length > 0,
    queryFn: async () => {
      const desde = `${mes}-01`;
      const [y, m] = mes.split("-").map(Number);
      const hasta = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      const { data, error } = await (supabase as any)
        .from("documentos")
        .select("id, numero_factura, fecha_documento, empresa_id, empresa_vendedora, plaza_id, ejecutivo_venta_id, unidades_equivalentes_total, companies:empresa_id(name)")
        .eq("tipo_documento", "factura")
        .eq("is_active", true)
        .neq("estatus_factura", "cancelada")
        .not("plaza_id", "is", null)
        .not("ejecutivo_venta_id", "is", null)
        .gte("fecha_documento", desde)
        .lte("fecha_documento", hasta)
        .order("fecha_documento", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const cruzadas = ((data || []) as any[]).filter((d) => {
        const pe = ejecMap.get(d.ejecutivo_venta_id)?.plaza_id;
        return pe && pe !== d.plaza_id;
      });
      const empresaIds = Array.from(new Set(cruzadas.map((d) => d.empresa_id).filter(Boolean)));
      const fuentes = new Map<string, { asignados: any[]; ultimosDocs: any[] }>();
      for (let i = 0; i < empresaIds.length; i += 100) {
        const ids = empresaIds.slice(i, i + 100);
        const [ce, docs] = await Promise.all([
          (supabase as any).from("company_ejecutivos").select("company_id, user_id, plaza_id").in("company_id", ids),
          (supabase as any)
            .from("documentos")
            .select("empresa_id, ejecutivo_venta_id, plaza_id")
            .in("empresa_id", ids)
            .eq("is_active", true)
            .in("tipo_documento", ["pedido", "cotizacion"])
            .not("ejecutivo_venta_id", "is", null)
            .order("fecha_documento", { ascending: false })
            .limit(1000),
        ]);
        for (const id of ids) fuentes.set(id, { asignados: [], ultimosDocs: [] });
        for (const r of ce.data || []) fuentes.get(r.company_id)?.asignados.push(r);
        for (const r of docs.data || []) fuentes.get(r.empresa_id)?.ultimosDocs.push(r);
      }
      return cruzadas.map((d) => ({
        ...d,
        sugerido: sugerirEjecutivoPorPlaza(fuentes.get(d.empresa_id) || { asignados: [], ultimosDocs: [] }, d.plaza_id),
      }));
    },
  });

  const reasignar = async (f: any) => {
    const nuevo = eleccion[f.id] ?? f.sugerido;
    if (!nuevo) return toast.error("Elige el ejecutivo de esa plaza");
    const de = ejecMap.get(f.ejecutivo_venta_id)?.full_name || "—";
    const a = ejecMap.get(nuevo)?.full_name || "—";
    if (!confirm(`¿Pasar la factura ${f.numero_factura} (${Number(f.unidades_equivalentes_total || 0)} uds) de ${de} a ${a}?`)) return;
    setGuardando(f.id);
    const { error } = await (supabase as any).from("documentos").update({ ejecutivo_venta_id: nuevo }).eq("id", f.id);
    setGuardando(null);
    if (error) return toast.error(error.message);
    toast.success(`Factura ${f.numero_factura} reasignada a ${a}`);
    qc.invalidateQueries({ queryKey: ["revision-plaza-ejecutivo"] });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setAbierto((v) => !v)}>
          {abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium uppercase tracking-wide">Plaza vs ejecutivo</span>
          <span className="text-xs font-light text-muted-foreground">
            Facturas cuyo ejecutivo es de otra plaza (misma razón social atendida en varias plazas)
          </span>
        </button>
        {abierto && (
          <>
            <div className="flex items-center gap-2">
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="h-9 w-44" />
              {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
              <span className="text-xs text-muted-foreground">{filas.length} facturas por revisar</span>
            </div>
            {filas.length > 0 && (
              <div className="max-h-[420px] overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30">
                    <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left">Factura</th>
                      <th className="px-3 py-2 text-left">Cliente</th>
                      <th className="px-3 py-2 text-left">Marca</th>
                      <th className="px-3 py-2 text-right">Uds</th>
                      <th className="px-3 py-2 text-left">Plaza factura</th>
                      <th className="px-3 py-2 text-left">Ejecutivo actual</th>
                      <th className="px-3 py-2 text-left">Pasar a</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f: any, i: number) => {
                      const actual = ejecMap.get(f.ejecutivo_venta_id);
                      const opciones = ejecutivos.filter((e) => e.plaza_id === f.plaza_id);
                      return (
                        <tr key={f.id} className={`border-t ${i % 2 ? "bg-muted/30" : ""}`}>
                          <td className="px-3 py-2 font-medium">{f.numero_factura}<div className="text-[11px] text-muted-foreground">{f.fecha_documento}</div></td>
                          <td className="px-3 py-2">{f.companies?.name || "—"}</td>
                          <td className="px-3 py-2">{MARCA[f.empresa_vendedora] || "—"}</td>
                          <td className="px-3 py-2 text-right">{Number(f.unidades_equivalentes_total || 0).toLocaleString("es-MX")}</td>
                          <td className="px-3 py-2"><Badge variant="secondary">{plazaNombre(f.plaza_id)}</Badge></td>
                          <td className="px-3 py-2">{actual?.full_name || "—"}<div className="text-[11px] text-amber-600">{plazaNombre(actual?.plaza_id ?? null)}</div></td>
                          <td className="px-3 py-2 min-w-[200px]">
                            <Select value={eleccion[f.id] ?? f.sugerido ?? ""} onValueChange={(v) => setEleccion((p) => ({ ...p, [f.id]: v }))}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="Elegir…" /></SelectTrigger>
                              <SelectContent>
                                {opciones.map((e) => (
                                  <SelectItem key={e.user_id} value={e.user_id}>{e.full_name || "—"}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Button size="sm" onClick={() => reasignar(f)} disabled={guardando === f.id}>
                              {guardando === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reasignar"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Link2, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

const money = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n || 0));

const fechaCorta = (s: string | null | undefined) => (s ? String(s).slice(0, 10) : "—");

const DIA = 24 * 60 * 60 * 1000;

interface DocRow {
  id: string;
  tipo_documento: string;
  numero_pedido: string | null;
  numero_factura: string | null;
  numero_cotizacion: string | null;
  fecha_documento: string | null;
  total: number | null;
  empresa_id: string | null;
  empresa_vendedora: string | null;
  estatus_pedido: string | null;
  pedido_relacionado_id: string | null;
  companies?: { name: string | null } | null;
}

interface PendienteRevision {
  pedido: DocRow;
  candidatos: DocRow[];
}

const refPedido = (d: DocRow) =>
  d.numero_pedido || d.numero_factura || d.numero_cotizacion || d.id.slice(0, 8);

const SELECT_COLS =
  "id, tipo_documento, numero_pedido, numero_factura, numero_cotizacion, fecha_documento, total, empresa_id, empresa_vendedora, estatus_pedido, pedido_relacionado_id, companies:empresa_id(name)";

function difDias(a: string | null, b: string | null) {
  if (!a || !b) return Number.MAX_SAFE_INTEGER;
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / DIA;
}

function esCandidata(pedido: DocRow, f: DocRow) {
  if (f.empresa_id !== pedido.empresa_id) return false;
  if (f.empresa_vendedora !== pedido.empresa_vendedora) return false;
  const totalPedido = Number(pedido.total || 0);
  const tolMonto = Math.max(50, totalPedido * 0.02);
  if (Math.abs(Number(f.total || 0) - totalPedido) > tolMonto) return false;
  if (!pedido.fecha_documento || !f.fecha_documento) return false;
  const base = new Date(pedido.fecha_documento).getTime();
  const t = new Date(f.fecha_documento).getTime();
  if (t < base - 3 * DIA) return false;
  if (t > base + 90 * DIA) return false;
  return true;
}

function ordenarCandidatos(pedido: DocRow, lista: DocRow[]) {
  const totalPedido = Number(pedido.total || 0);
  return [...lista].sort((a, b) => {
    const da = Math.abs(Number(a.total || 0) - totalPedido);
    const db = Math.abs(Number(b.total || 0) - totalPedido);
    if (da !== db) return da - db;
    return difDias(pedido.fecha_documento, a.fecha_documento) - difDias(pedido.fecha_documento, b.fecha_documento);
  });
}

export default function VincularPedidosFacturas() {
  const { user } = useAuth();
  const [ejecutando, setEjecutando] = useState(false);
  const [resumen, setResumen] = useState<{ auto: number; manual: number } | null>(null);
  const [pendientesRevision, setPendientesRevision] = useState<PendienteRevision[]>([]);
  const [seleccionManual, setSeleccionManual] = useState<Record<string, string>>({});
  const [vinculandoId, setVinculandoId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["vincular-pedidos-facturas"],
    queryFn: async () => {
      const { data: vinculadas, error: e1 } = await supabase
        .from("documentos")
        .select("pedido_relacionado_id")
        .not("pedido_relacionado_id", "is", null);
      if (e1) throw e1;
      const vinculados = new Set((vinculadas || []).map((r: any) => r.pedido_relacionado_id));

      const { data: pedidos, error: e2 } = await supabase
        .from("documentos")
        .select(SELECT_COLS)
        .eq("tipo_documento", "pedido")
        .eq("is_active", true)
        .neq("estatus_pedido", "cancelado")
        .order("fecha_documento", { ascending: false });
      if (e2) throw e2;

      const { data: facturas, error: e3 } = await supabase
        .from("documentos")
        .select(SELECT_COLS)
        .eq("tipo_documento", "factura")
        .eq("is_active", true)
        .is("pedido_relacionado_id", null)
        .order("fecha_documento", { ascending: false });
      if (e3) throw e3;

      return {
        pendientes: ((pedidos || []) as unknown as DocRow[]).filter((p) => !vinculados.has(p.id)),
        facturasLibres: (facturas || []) as unknown as DocRow[],
      };
    },
  });

  const pendientes = data?.pendientes ?? [];
  const facturasLibres = data?.facturasLibres ?? [];

  const ejecutar = async () => {
    if (!pendientes.length) return;
    setEjecutando(true);
    setResumen(null);
    setPendientesRevision([]);
    let auto = 0;
    const manual: PendienteRevision[] = [];
    const disponibles = [...facturasLibres];

    try {
      for (let i = 0; i < pendientes.length; i += 20) {
        const lote = pendientes.slice(i, i + 20);
        for (const pedido of lote) {
          const candidatos = ordenarCandidatos(
            pedido,
            disponibles.filter((f) => esCandidata(pedido, f)),
          );
          const totalPedido = Number(pedido.total || 0);
          const tolEstrecha = Math.max(10, totalPedido * 0.005);
          if (
            candidatos.length === 1 &&
            Math.abs(Number(candidatos[0].total || 0) - totalPedido) <= tolEstrecha
          ) {
            const factura = candidatos[0];
            const { error } = await supabase
              .from("documentos")
              .update({
                pedido_relacionado_id: pedido.id,
                pedido_vinculado_por: null,
                pedido_vinculado_at: new Date().toISOString(),
                pedido_vinculo_automatico: true,
              })
              .eq("id", factura.id);
            if (error) {
              manual.push({ pedido, candidatos });
            } else {
              auto++;
              const idx = disponibles.findIndex((f) => f.id === factura.id);
              if (idx >= 0) disponibles.splice(idx, 1);
            }
          } else {
            manual.push({ pedido, candidatos });
          }
        }
      }
      setPendientesRevision(manual);
      setResumen({ auto, manual: manual.length });
      toast.success(`${auto} vinculados automáticamente · ${manual.length} pendientes de revisión`);
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Error al ejecutar el emparejamiento");
    } finally {
      setEjecutando(false);
    }
  };

  const vincular = async (pedido: DocRow, facturaId: string) => {
    if (!facturaId) return;
    setVinculandoId(pedido.id);
    const { error } = await supabase
      .from("documentos")
      .update({
        pedido_relacionado_id: pedido.id,
        pedido_vinculado_por: user?.id ?? null,
        pedido_vinculado_at: new Date().toISOString(),
        pedido_vinculo_automatico: false,
      })
      .eq("id", facturaId);
    setVinculandoId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Factura vinculada al pedido");
    setPendientesRevision((prev) => prev.filter((p) => p.pedido.id !== pedido.id));
    refetch();
  };

  const quitarDeVista = (pedidoId: string) => {
    setPendientesRevision((prev) => prev.filter((p) => p.pedido.id !== pedidoId));
  };

  const opcionesPorEmpresa = useMemo(() => {
    const map = new Map<string, { value: string; label: string; searchText: string }[]>();
    for (const f of facturasLibres) {
      const key = f.empresa_id || "";
      const arr = map.get(key) || [];
      const label = `${f.numero_factura || f.id.slice(0, 8)} · ${fechaCorta(f.fecha_documento)} · ${money(f.total)}`;
      arr.push({ value: f.id, label, searchText: label });
      map.set(key, arr);
    }
    return map;
  }, [facturasLibres]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-light tracking-tight">Vincular Pedidos y Facturas</h1>
        <p className="text-sm text-muted-foreground">
          Empareja cada pedido activo con su factura correspondiente.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-col md:flex-row md:items-center gap-4">
          <Button size="lg" onClick={ejecutar} disabled={ejecutando || isLoading || !pendientes.length}>
            {ejecutando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
            Ejecutar emparejamiento automático
          </Button>
          <div className="text-sm text-muted-foreground">
            {isLoading ? (
              "Cargando pedidos…"
            ) : (
              <>
                <span className="font-medium text-foreground">{pendientes.length}</span> pedidos pendientes de vincular
              </>
            )}
          </div>
          {resumen && (
            <div className="md:ml-auto flex items-center gap-2 text-sm">
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> {resumen.auto} vinculados automáticamente
              </Badge>
              <Badge variant="outline" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {resumen.manual} pendientes de revisión manual
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {resumen && pendientesRevision.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Todos los pedidos activos ya están vinculados a su factura 🎉
          </CardContent>
        </Card>
      )}

      {pendientesRevision.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Pendientes de revisión manual
          </h2>
          {pendientesRevision.map(({ pedido, candidatos }) => {
            const opciones = opcionesPorEmpresa.get(pedido.empresa_id || "") || [];
            const sel = seleccionManual[pedido.id] || "";
            return (
              <Card key={pedido.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-normal flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium">{pedido.companies?.name || "Sin cliente"}</span>
                    <span className="text-muted-foreground text-sm">Pedido {refPedido(pedido)}</span>
                    <span className="text-muted-foreground text-sm">{fechaCorta(pedido.fecha_documento)}</span>
                    <span className="text-sm">{money(pedido.total)}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {candidatos.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Candidatos encontrados ({candidatos.length})
                      </p>
                      {candidatos.map((c) => (
                        <div
                          key={c.id}
                          className="flex flex-wrap items-center gap-3 rounded-md border p-2 text-sm"
                        >
                          <span className="font-medium">{c.numero_factura || c.id.slice(0, 8)}</span>
                          <span className="text-muted-foreground">{fechaCorta(c.fecha_documento)}</span>
                          <span>{money(c.total)}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-auto"
                            disabled={vinculandoId === pedido.id}
                            onClick={() => vincular(pedido, c.id)}
                          >
                            Vincular esta
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No se encontraron candidatos automáticos.</p>
                  )}

                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <div className="flex-1">
                      <SearchableSelect
                        value={sel}
                        onValueChange={(v) => setSeleccionManual((p) => ({ ...p, [pedido.id]: v }))}
                        options={opciones}
                        placeholder="Buscar cualquier factura no vinculada del cliente…"
                      />
                    </div>
                    <Button
                      variant="outline"
                      disabled={!sel || vinculandoId === pedido.id}
                      onClick={() => vincular(pedido, sel)}
                    >
                      Vincular
                    </Button>
                  </div>

                  <Button variant="ghost" size="sm" onClick={() => quitarDeVista(pedido.id)}>
                    Este pedido no tiene factura (marcar para seguimiento)
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

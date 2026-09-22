import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, BadgeDollarSign, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/formatters";
import AutorizacionPrecioCard from "@/components/documents/AutorizacionPrecioCard";

type Autorizacion = any;

const ESTATUS_PEDIDO_AVANZADO = ["validado_contabilidad", "programado_entrega", "entregado"];

const ESTATUS_LABEL: Record<string, string> = {
  pendiente_revision: "Pendiente",
  enviado: "Enviado",
  rechazado: "Rechazado",
  indeterminado: "Indeterminado",
};

const money = (v: any) =>
  v === null || v === undefined || v === ""
    ? "—"
    : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(v));

export default function AutorizacionPrecios() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["autorizaciones-precio"],
    queryFn: async () => {
      const { data: rows, error } = await (supabase as any)
        .from("documento_autorizaciones_precio")
        .select(
          "id, documento_id, ronda, estatus, justificacion, costo_margen_snapshot, historico_snapshot, datos_cliente_snapshot, created_at, enviado_at, margen_reportado_texto, margen_respondido_por, margen_respondido_at, autorizado, autorizado_por_texto, motivo, autorizacion_respondido_at, pospuesto, pospuesto_at, documentos(id, numero_pedido, numero_factura, fecha_documento, created_at, total, empresa_id, estatus_pedido, ejecutivo_venta_id, companies(id, name, razon_social, industrias, tipo_destino_lubricante, lista_precios, limite_credito, tipo_pago, forma_pago, metodo_pago, uso_cfdi))"
        )
        .in("estatus", ["pendiente_revision", "enviado", "rechazado", "indeterminado"])
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Excluir autorizaciones cuyo pedido ya avanzó más allá de la etapa de autorización
      const docIds = Array.from(
        new Set((rows || []).map((r: any) => r.documentos?.id).filter(Boolean))
      );
      let pedidosFacturados = new Set<string>();
      if (docIds.length) {
        const { data: facturas } = await (supabase as any)
          .from("documentos")
          .select("pedido_relacionado_id")
          .in("pedido_relacionado_id", docIds);
        pedidosFacturados = new Set(
          (facturas || []).map((f: any) => f.pedido_relacionado_id).filter(Boolean)
        );
      }

      // Detección en vivo de facturas reales (timbradas) que corresponden al pedido
      const empresaIds = Array.from(
        new Set((rows || []).map((r: any) => r.documentos?.empresa_id).filter(Boolean))
      );
      let facturasPorEmpresa: Record<string, any[]> = {};
      if (empresaIds.length) {
        const { data: facts } = await (supabase as any)
          .from("documentos")
          .select("id, empresa_id, total, fecha_documento")
          .eq("tipo_documento", "factura")
          .eq("is_active", true)
          .not("folio_fiscal_uuid", "is", null)
          .in("empresa_id", empresaIds);
        for (const f of facts || []) {
          (facturasPorEmpresa[f.empresa_id] ||= []).push(f);
        }
      }

      const yaFacturado = (doc: any) => {
        if (!doc?.empresa_id) return false;
        const candidatas = facturasPorEmpresa[doc.empresa_id] || [];
        if (!candidatas.length) return false;
        const totalPedido = Number(doc.total || 0);
        if (!totalPedido) return false;
        const tolerancia = Math.max(50, totalPedido * 0.02);
        const desde = doc.created_at ? new Date(doc.created_at) : null;
        return candidatas.some((f: any) => {
          if (Math.abs(Number(f.total || 0) - totalPedido) > tolerancia) return false;
          if (desde && f.fecha_documento) {
            const fFecha = new Date(`${String(f.fecha_documento).slice(0, 10)}T23:59:59`);
            if (fFecha < desde) return false;
          }
          return true;
        });
      };

      const vigentes = (rows || []).filter((r: any) => {
        const doc = r.documentos;
        if (!doc) return true;
        if (pedidosFacturados.has(doc.id)) return false;
        if (ESTATUS_PEDIDO_AVANZADO.includes(doc.estatus_pedido)) return false;
        if (yaFacturado(doc)) return false;
        return true;
      });

      const ids = Array.from(
        new Set(vigentes.map((r: any) => r.documentos?.ejecutivo_venta_id).filter(Boolean))
      );
      let mapa: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await (supabase as any)
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ids);
        mapa = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p.full_name]));
      }
      return { rows: vigentes as Autorizacion[], ejecutivos: mapa };
    },
  });


  const rows = data?.rows || [];
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("id");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [descartando, setDescartando] = useState(false);

  useEffect(() => {
    if (!isLoading && highlightId && rows.some((r: Autorizacion) => r.id === highlightId)) {
      setHighlightedId(highlightId);
      setExpandidos((prev) => new Set(prev).add(highlightId));
      setTimeout(() => {
        document
          .getElementById(`aut-row-${highlightId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }

  }, [isLoading, highlightId, rows]);

  const toggleSeleccion = (id: string, checked: boolean) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSeccion = (idsSeccion: string[], checked: boolean) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      for (const id of idsSeccion) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const descartarSeleccionadas = async () => {
    const ids = Array.from(seleccionados);
    if (ids.length === 0) return;
    if (
      !confirm(
        `¿Descartar ${ids.length} autorización(es)? Los pedidos volverán a Confirmado Cliente.`
      )
    )
      return;

    setDescartando(true);
    try {
      const { data: evidencias } = await (supabase as any)
        .from("documento_autorizacion_evidencias")
        .select("storage_path")
        .in("autorizacion_id", ids);
      const paths = (evidencias || []).map((e: any) => e.storage_path).filter(Boolean);
      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("autorizacion-precios")
          .remove(paths);
        if (storageError) console.warn("No se pudieron eliminar evidencias:", storageError);
      }

      const { error: evErr } = await (supabase as any)
        .from("documento_autorizacion_evidencias")
        .delete()
        .in("autorizacion_id", ids);
      if (evErr) throw evErr;

      const docIds = rows
        .filter((r: Autorizacion) => seleccionados.has(r.id))
        .map((r: Autorizacion) => r.documento_id)
        .filter(Boolean);

      const { error: autErr } = await (supabase as any)
        .from("documento_autorizaciones_precio")
        .delete()
        .in("id", ids);
      if (autErr) throw autErr;

      if (docIds.length > 0) {
        const { error: docErr } = await (supabase as any)
          .from("documentos")
          .update({ estatus_pedido: "confirmado_cliente" })
          .in("id", docIds)
          .eq("tipo_documento", "pedido");
        if (docErr) throw docErr;
      }

      toast.success(`${ids.length} autorización(es) descartada(s)`);
      setSeleccionados(new Set());
      await refetch();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "No se pudieron descartar las autorizaciones");
    } finally {
      setDescartando(false);
    }
  };

  const toggleExpandido = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderTabla = (lista: Autorizacion[]) => (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>N° Pedido/Factura</TableHead>
            <TableHead>Ejecutivo</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estatus</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lista.map((row: Autorizacion) => {
            const doc = row.documentos || {};
            const abierto = expandidos.has(row.id);
            const ejecutivo = doc.ejecutivo_venta_id
              ? data?.ejecutivos?.[doc.ejecutivo_venta_id]
              : null;
            return (
              <>
                <TableRow
                  key={row.id}
                  id={`aut-row-${row.id}`}
                  className={`cursor-pointer ${
                    highlightedId === row.id ? "ring-2 ring-primary/60" : ""
                  }`}
                  onClick={() => toggleExpandido(row.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={seleccionados.has(row.id)}
                      onCheckedChange={(c) => toggleSeleccion(row.id, c === true)}
                      aria-label="Seleccionar autorización"
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {doc.companies?.name || doc.companies?.razon_social || "—"}
                  </TableCell>
                  <TableCell>{doc.numero_pedido || doc.numero_factura || "—"}</TableCell>
                  <TableCell>{ejecutivo || "—"}</TableCell>
                  <TableCell className="text-right">{money(doc.total)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {ESTATUS_LABEL[row.estatus] || row.estatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.created_at ? formatDate(row.created_at) : "—"}
                  </TableCell>
                  <TableCell>
                    {abierto ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                </TableRow>
                {abierto && (
                  <TableRow key={`${row.id}-exp`} className="hover:bg-transparent">
                    <TableCell colSpan={8} className="p-0">
                      <div className="p-3 bg-muted/20">
                        <AutorizacionPrecioCard
                          row={row}
                          ejecutivo={ejecutivo}
                          onRefetch={refetch}
                          isHighlighted={false}
                          defaultOpen
                          embedded
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );


  const pendientes = rows.filter((r: Autorizacion) => r.estatus === "pendiente_revision");
  const enviados = rows.filter((r: Autorizacion) => r.estatus === "enviado");
  const atencion = rows.filter(
    (r: Autorizacion) => r.estatus === "rechazado" || r.estatus === "indeterminado"
  );

  const seccionCheckbox = (lista: Autorizacion[]) => {
    const ids = lista.map((r: Autorizacion) => r.id);
    const todas = ids.length > 0 && ids.every((id) => seleccionados.has(id));
    return (
      <label className="flex items-center gap-2 text-xs font-normal text-muted-foreground cursor-pointer">
        <Checkbox checked={todas} onCheckedChange={(c) => toggleSeccion(ids, c === true)} />
        Seleccionar todas las visibles
      </label>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BadgeDollarSign className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Autorización de Precios</h1>
          <p className="text-sm text-muted-foreground">
            Revisa, documenta y envía las solicitudes de autorización de precio.
          </p>
        </div>
      </div>

      {seleccionados.size > 0 && (
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 rounded-md border bg-muted/60 px-4 py-2 backdrop-blur">
          <span className="text-sm font-medium">{seleccionados.size} seleccionadas</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSeleccionados(new Set())}>
              Limpiar selección
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={descartarSeleccionadas}
              disabled={descartando}
            >
              {descartando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Descartar seleccionadas
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay solicitudes de autorización de precio en seguimiento.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {pendientes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Pendientes de revisar
                </h2>
                {seccionCheckbox(pendientes)}
              </div>
              <div className="space-y-3">{pendientes.map(renderCard)}</div>
            </div>
          )}

          {enviados.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Esperando respuesta
                </h2>
                {seccionCheckbox(enviados)}
              </div>
              <div className="space-y-3">{enviados.map(renderCard)}</div>
            </div>
          )}

          {atencion.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-600">
                  ⚠️ Requieren atención
                </h2>
                {seccionCheckbox(atencion)}
              </div>
              <p className="text-xs text-muted-foreground">
                Estas quedaron en un estado que necesita que alguien las revise o corrija manualmente.
              </p>
              <div className="space-y-3">{atencion.map(renderCard)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

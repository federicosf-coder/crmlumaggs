import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabasePagination";

export type EstatusPago = "recibido" | "enviado_validar" | "validado" | "aplicado";

export interface CobranzaPago {
  id: string;
  empresa_id: string;
  plaza_id: string | null;
  fecha_pago: string;
  monto_total: number;
  monto_aplicado: number;
  monto_disponible: number;
  moneda: string;
  tipo_pago: string | null;
  referencia_pago: string | null;
  banco: string | null;
  observaciones: string | null;
  estado_pago: "registrado" | "no_aplicado" | "aplicado_parcial" | "aplicado_total" | "cancelado";
  estatus_pago: EstatusPago;
  created_at: string;
  empresa?: { id: string; name: string; email?: string | null } | null;
  plaza?: { id: string; nombre: string } | null;
}

export interface CobranzaAplicacion {
  id: string;
  pago_id: string;
  tipo_documento: "factura" | "pedido" | "cotizacion";
  documento_id: string;
  monto_aplicado: number;
  fecha_aplicacion: string;
  observaciones: string | null;
  estatus_aplicacion: "activa" | "cancelada";
  documento?: {
    id: string;
    numero_factura: string | null;
    numero_pedido: string | null;
    numero_cotizacion: string | null;
    tipo_documento: string;
    total: number;
    saldo_pendiente_cobranza: number;
    fecha_vencimiento: string | null;
  } | null;
}

export interface DocumentoCobranza {
  id: string;
  tipo_documento: "cotizacion" | "pedido" | "factura";
  numero_factura: string | null;
  numero_pedido: string | null;
  numero_cotizacion: string | null;
  fecha_documento: string;
  fecha_vencimiento: string | null;
  total: number;
  saldo_pendiente_cobranza: number;
  estado_cobranza: "pendiente" | "parcial" | "pagada" | "vencida" | "cancelada" | null;
  estatus_factura: string | null;
  tipo_pago: "contado" | "credito" | "credito_cescemex" | null;
  empresa_id: string | null;
  plaza_id: string | null;
  ejecutivo_venta_id?: string | null;
  empresa?: { id: string; name: string } | null;
  plaza?: { id: string; nombre: string } | null;
}

export interface PagoBreakdown {
  aplicadoFacturas: number;
  aplicadoOtros: number; // pedidos + cotizaciones
  disponibleFacturas: number; // monto_total - aplicadoFacturas (lo que falta por aplicar a facturas)
}

export interface CobranzaFilters {
  empresaVendedora?: "lumaggs_chevron" | "galsa_phillips66" | null;
  plazaId?: string | null;
  /** Filtro de permisos por módulo (facturacion). Si se provee, restringe documentos a la visibilidad del usuario. */
  accessLevel?: "todos" | "equipo" | "propio" | "ninguno" | null;
  userId?: string | null;
  teamMemberIds?: string[];
  assignedCompanyIds?: string[];
}

export function useCobranzaPagos(filters: CobranzaFilters = {}) {
  const { empresaVendedora = null, plazaId = null } = filters;
  const [pagos, setPagos] = useState<CobranzaPago[]>([]);
  const [breakdowns, setBreakdowns] = useState<Record<string, PagoBreakdown>>({});
  const [loading, setLoading] = useState(true);

  const fetchPagos = useCallback(async () => {
    setLoading(true);
    let q: any = supabase
      .from("cobranza_pagos")
      .select("*, empresa:companies(id,name,razon_social,id_contpaq,email), plaza:plazas(id,nombre)")
      .order("fecha_pago", { ascending: false });
    if (empresaVendedora) q = q.eq("empresa_vendedora" as any, empresaVendedora as any);
    if (plazaId) q = q.eq("plaza_id", plazaId);
    const { data, error } = await q;
    if (!error && data) {
      setPagos(data as any);
      const ids = (data as any[]).map((p) => p.id);
      if (ids.length > 0) {
        const { data: aplics } = await supabase
          .from("cobranza_aplicaciones")
          .select("pago_id,tipo_documento,monto_aplicado,estatus_aplicacion")
          .in("pago_id", ids)
          .eq("estatus_aplicacion", "activa");
        const map: Record<string, PagoBreakdown> = {};
        (data as any[]).forEach((p) => {
          map[p.id] = { aplicadoFacturas: 0, aplicadoOtros: 0, disponibleFacturas: Number(p.monto_total) };
        });
        (aplics || []).forEach((a: any) => {
          const b = map[a.pago_id];
          if (!b) return;
          const monto = Number(a.monto_aplicado) || 0;
          if (a.tipo_documento === "factura") b.aplicadoFacturas += monto;
          else b.aplicadoOtros += monto;
        });
        Object.keys(map).forEach((k) => {
          const total = Number((data as any[]).find((p) => p.id === k)?.monto_total || 0);
          map[k].disponibleFacturas = Math.max(0, total - map[k].aplicadoFacturas);
        });
        setBreakdowns(map);
      } else {
        setBreakdowns({});
      }
    }
    setLoading(false);
  }, [empresaVendedora, plazaId]);

  useEffect(() => { fetchPagos(); }, [fetchPagos]);

  return { pagos, breakdowns, loading, refetch: fetchPagos };
}

export function useCobranzaAplicaciones(pagoId: string | null) {
  const [aplicaciones, setAplicaciones] = useState<CobranzaAplicacion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAplicaciones = useCallback(async () => {
    if (!pagoId) { setAplicaciones([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("cobranza_aplicaciones")
      .select("*")
      .eq("pago_id", pagoId)
      .order("fecha_aplicacion", { ascending: false });
    if (error) { console.error("aplicaciones", error); setAplicaciones([]); setLoading(false); return; }
    const docIds = Array.from(new Set((data || []).map((a: any) => a.documento_id).filter(Boolean)));
    let docsMap: Record<string, any> = {};
    if (docIds.length > 0) {
      const { data: docs } = await supabase
        .from("documentos")
        .select("id,numero_factura,numero_pedido,numero_cotizacion,tipo_documento,total,saldo_pendiente_cobranza,fecha_vencimiento")
        .in("id", docIds);
      (docs || []).forEach((d: any) => { docsMap[d.id] = d; });
    }
    const merged = (data || []).map((a: any) => ({ ...a, documento: docsMap[a.documento_id] || null }));
    setAplicaciones(merged as any);
    setLoading(false);
  }, [pagoId]);

  useEffect(() => { fetchAplicaciones(); }, [fetchAplicaciones]);

  return { aplicaciones, loading, refetch: fetchAplicaciones };
}

export function useDocumentosCobranza(filters: CobranzaFilters = {}) {
  const {
    empresaVendedora = null,
    plazaId = null,
    accessLevel = null,
    userId = null,
    teamMemberIds = [],
    assignedCompanyIds = [],
  } = filters;
  const [documentos, setDocumentos] = useState<DocumentoCobranza[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    if (accessLevel === "ninguno") {
      setDocumentos([]);
      setLoading(false);
      return;
    }
    let q: any = supabase
      .from("documentos")
      .select("id,tipo_documento,numero_factura,numero_pedido,numero_cotizacion,fecha_documento,fecha_vencimiento,total,saldo_pendiente_cobranza,estado_cobranza,estatus_factura,tipo_pago,empresa_id,plaza_id,ejecutivo_venta_id, empresa:companies(id,name), plaza:plazas(id,nombre)")
      .eq("is_active", true)
      .gt("total", 0)
      .order("fecha_documento", { ascending: false });
    if (empresaVendedora) q = q.eq("empresa_vendedora", empresaVendedora as any);
    if (plazaId) q = q.eq("plaza_id", plazaId);
    // Replicar la misma lógica de visibilidad que FacturasListEmbedded
    if (accessLevel === "propio" && userId) {
      const parts = [`created_by.eq.${userId}`, `ejecutivo_venta_id.eq.${userId}`];
      if (assignedCompanyIds.length > 0) parts.push(`empresa_id.in.(${assignedCompanyIds.join(",")})`);
      q = q.or(parts.join(","));
    } else if (accessLevel === "equipo" && teamMemberIds.length > 0) {
      const parts = [
        `created_by.in.(${teamMemberIds.join(",")})`,
        `ejecutivo_venta_id.in.(${teamMemberIds.join(",")})`,
      ];
      if (assignedCompanyIds.length > 0) parts.push(`empresa_id.in.(${assignedCompanyIds.join(",")})`);
      q = q.or(parts.join(","));
    }
    const { data, error } = await q;
    if (!error && data) setDocumentos(data as any);
    setLoading(false);
  }, [empresaVendedora, plazaId, accessLevel, userId, teamMemberIds.join(","), assignedCompanyIds.join(",")]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  return { documentos, loading, refetch: fetchDocs };
}

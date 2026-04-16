import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  created_at: string;
  empresa?: { id: string; name: string } | null;
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
  tipo_pago: "contado" | "credito" | "credito_cescemex" | null;
  empresa_id: string | null;
  plaza_id: string | null;
  empresa?: { id: string; name: string } | null;
  plaza?: { id: string; nombre: string } | null;
}

export function useCobranzaPagos() {
  const [pagos, setPagos] = useState<CobranzaPago[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPagos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cobranza_pagos")
      .select("*, empresa:companies(id,name), plaza:plazas(id,nombre)")
      .order("fecha_pago", { ascending: false });
    if (!error && data) setPagos(data as any);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPagos(); }, [fetchPagos]);

  return { pagos, loading, refetch: fetchPagos };
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

export function useDocumentosCobranza() {
  const [documentos, setDocumentos] = useState<DocumentoCobranza[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("documentos")
      .select("id,tipo_documento,numero_factura,numero_pedido,numero_cotizacion,fecha_documento,fecha_vencimiento,total,saldo_pendiente_cobranza,estado_cobranza,tipo_pago,empresa_id,plaza_id, empresa:companies(id,name), plaza:plazas(id,nombre)")
      .eq("is_active", true)
      .gt("total", 0)
      .order("fecha_documento", { ascending: false });
    if (!error && data) setDocumentos(data as any);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  return { documentos, loading, refetch: fetchDocs };
}

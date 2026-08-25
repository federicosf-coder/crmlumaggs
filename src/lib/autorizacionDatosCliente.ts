import {
  TIPO_DESTINO_OPTIONS,
  LISTA_PRECIOS_OPTIONS,
  TIPO_PAGO_OPTS,
  METODO_PAGO_OPTS,
  FORMA_PAGO_OPTS,
  USO_CFDI_OPTS,
} from "@/components/CompanyFormDialog";

export type DatosClienteAutorizacion = {
  industrias: string[];
  tipo_destino_lubricante: string | null;
  lista_precios: string | null;
  limite_credito: number | null;
  tipo_pago: string | null;
  forma_pago: string | null;
  metodo_pago: string | null;
  uso_cfdi: string | null;
  clabe_bancaria: string | null;
  tarjeta_ultimos4: string | null;
};

export const DATOS_CLIENTE_VACIO: DatosClienteAutorizacion = {
  industrias: [],
  tipo_destino_lubricante: null,
  lista_precios: null,
  limite_credito: null,
  tipo_pago: null,
  forma_pago: null,
  metodo_pago: null,
  uso_cfdi: null,
  clabe_bancaria: null,
  tarjeta_ultimos4: null,
};

export function normalizeDatosCliente(raw: any): DatosClienteAutorizacion {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    industrias: Array.isArray(r.industrias) ? r.industrias : [],
    tipo_destino_lubricante: r.tipo_destino_lubricante || null,
    lista_precios: r.lista_precios || null,
    limite_credito: r.limite_credito != null && r.limite_credito !== "" ? Number(r.limite_credito) : null,
    tipo_pago: r.tipo_pago || null,
    forma_pago: r.forma_pago || null,
    metodo_pago: r.metodo_pago || null,
    uso_cfdi: r.uso_cfdi || null,
    clabe_bancaria: r.clabe_bancaria || null,
    tarjeta_ultimos4: r.tarjeta_ultimos4 || null,
  };
}

const findLabel = (opts: { v: string; l: string }[], v: string | null) =>
  (v ? opts.find((o) => o.v === v)?.l || v : null);

export const TIPO_DESTINO_OPTS = TIPO_DESTINO_OPTIONS.map((v) => ({ v, l: v }));
export { LISTA_PRECIOS_OPTIONS, TIPO_PAGO_OPTS, METODO_PAGO_OPTS, FORMA_PAGO_OPTS, USO_CFDI_OPTS };

export function labelTipoPago(v: string | null) {
  return findLabel(TIPO_PAGO_OPTS, v);
}
export function labelFormaPago(v: string | null) {
  return findLabel(FORMA_PAGO_OPTS, v);
}
export function labelMetodoPago(v: string | null) {
  return findLabel(METODO_PAGO_OPTS, v);
}
export function labelUsoCfdi(v: string | null) {
  return findLabel(USO_CFDI_OPTS, v);
}
export function labelListaPrecios(v: string | null) {
  return findLabel(LISTA_PRECIOS_OPTIONS, v);
}

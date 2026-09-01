import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Input } from "@/components/ui/input";
import { TIPO_PAGO_OPTS } from "@/components/CompanyFormDialog";
import { Loader2, Upload, FileCode2, Trash2, CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";
import { parseCfdiXml, type CfdiParsed } from "@/lib/xmlFacturaParser";
import { mapEmisorAEmpresaVendedora, mapSerieAPlaza, normalizarTexto, palabrasSignificativas, RFC_GENERICOS } from "@/lib/xmlFacturaMatching";
import { fetchAllRows } from "@/lib/supabasePagination";
import { FiltroChipsMulti } from "./rvs/components/FiltroChipsMulti";


const BUCKET = "facturas-xml";

type IntakeRow = any;

interface ProductoLinea {
  codigo: string | null;
  descripcion: string | null;
  cantidad: number;
  valorUnitario: number;
  importe: number;
  producto_id: string | null;
  producto_nombre: string | null;
  matched: boolean;
}

const money = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n || 0));

const fechaCorta = (s: string | null | undefined) => (s ? String(s).slice(0, 10) : "—");

function leerArchivo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("No se pudo leer el archivo"));
    fr.onload = () => resolve(String(fr.result || ""));
    fr.readAsText(file);
  });
}

export default function ImportarFacturasXML() {
  const [dragOver, setDragOver] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [importandoId, setImportandoId] = useState<string | null>(null);
  const [importandoLote, setImportandoLote] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Selecciones manuales por fila (plaza, cliente candidato, productos)
  const [plazaManual, setPlazaManual] = useState<Record<string, string>>({});
  const [clienteManual, setClienteManual] = useState<Record<string, string>>({});
  const [productoManual, setProductoManual] = useState<Record<string, Record<number, string>>>({});
  const [ejecutivoManual, setEjecutivoManual] = useState<Record<string, string>>({});
  const [contactoManual, setContactoManual] = useState<Record<string, string>>({});
  const [tipoPagoManual, setTipoPagoManual] = useState<Record<string, string>>({});
  const [fechaVencManual, setFechaVencManual] = useState<Record<string, string>>({});
  const [estatusManual, setEstatusManual] = useState<Record<string, string>>({});
  const [mostrarBusquedaAmplia, setMostrarBusquedaAmplia] = useState<Record<string, boolean>>({});
  const [plazasFiltroRevision, setPlazasFiltroRevision] = useState<string[]>([]);



  interface PerfilEmpresa {
    ejecutivoDefault: string | null;
    contactoDefault: string | null;
    tipoPagoDefault: string | null;
    contactos: { id: string; label: string }[];
  }
  const [perfilPorEmpresa, setPerfilPorEmpresa] = useState<Record<string, PerfilEmpresa>>({});
  const perfilCargando = useRef<Set<string>>(new Set());

  const cargarPerfilEmpresa = useCallback(
    async (empresaId: string) => {
      if (!empresaId || perfilCargando.current.has(empresaId)) return;
      perfilCargando.current.add(empresaId);
      const [{ data: comp }, { data: ejec }, { data: cts }] = await Promise.all([
        (supabase as any).from("companies").select("primary_contact_id, tipo_pago").eq("id", empresaId).maybeSingle(),
        (supabase as any).from("company_ejecutivos").select("user_id").eq("company_id", empresaId).limit(1),
        (supabase as any)
          .from("contacts")
          .select("id, first_name, last_name, job_title")
          .eq("company_id", empresaId)
          .eq("is_active", true),
      ]);
      const perfil: PerfilEmpresa = {
        ejecutivoDefault: ejec && ejec.length ? ejec[0].user_id : null,
        contactoDefault: comp?.primary_contact_id || null,
        tipoPagoDefault: comp?.tipo_pago || null,
        contactos: (cts || []).map((c: any) => ({
          id: c.id,
          label: `${c.first_name || ""} ${c.last_name || ""}`.trim() + (c.job_title ? ` — ${c.job_title}` : ""),
        })),
      };
      setPerfilPorEmpresa((prev) => ({ ...prev, [empresaId]: perfil }));
    },
    []
  );

  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas-xml-import"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("plazas").select("id, nombre").eq("is_active", true).order("nombre");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: productosCatalogo = [] } = useQuery({
    queryKey: ["productos-xml-import"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("productos")
        .select("id, codigo, descripcion")
        .eq("is_active", true)
        .order("codigo");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: companiesActivas = [] } = useQuery({
    queryKey: ["companies-xml-import"],
    queryFn: async () =>
      await fetchAllRows<any>((from, to) =>
        (supabase as any)
          .from("companies")
          .select("id, name, razon_social")
          .eq("is_active", true)
          .order("name")
          .range(from, to)
      ),
  });


  const { data: profilesActivos = [] } = useQuery({
    queryKey: ["profiles-xml-import"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("user_id, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const profileOptions = useMemo(
    () => (profilesActivos as any[]).map((p) => ({ value: p.user_id, label: p.full_name || "—" })),
    [profilesActivos]
  );



  const companyOptions = useMemo(
    () =>
      (companiesActivas as any[]).map((c) => ({
        value: c.id,
        label: c.razon_social && c.razon_social !== c.name ? `${c.razon_social} (${c.name})` : c.name,
        searchText: `${c.name || ""} ${c.razon_social || ""}`,
      })),
    [companiesActivas]
  );

  const productoOptions = useMemo(
    () =>
      (productosCatalogo as any[]).map((p) => ({
        value: p.id,
        label: `${p.codigo} — ${p.descripcion || ""}`,
        searchText: `${p.codigo} ${p.descripcion || ""}`,
      })),
    [productosCatalogo]
  );

  const { data: filas = [], isLoading, refetch } = useQuery({
    queryKey: ["documentos-xml-intake"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("documentos_xml_intake")
        .select("*")
        .in("estatus", ["pendiente", "ya_existia"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as IntakeRow[];
    },
  });

  /* ---------------- Carga y procesamiento ---------------- */

  const procesarArchivo = useCallback(
    async (file: File, userId: string | null) => {
      const texto = await leerArchivo(file);
      const cfdi: CfdiParsed = parseCfdiXml(texto);

      // 1. Duplicado
      let yaExiste = false;
      if (cfdi.uuidFiscal) {
        const { data: dup } = await (supabase as any)
          .from("documentos")
          .select("id")
          .eq("folio_fiscal_uuid", cfdi.uuidFiscal)
          .limit(1);
        yaExiste = !!(dup && dup.length);
      }

      let clienteEstatus = "pendiente";
      let empresaIdMatched: string | null = null;
      let candidatos: any[] = [];
      let plazaId: string | null = null;
      let empresaVendedora: string | null = null;
      let productos: ProductoLinea[] = [];

      if (!yaExiste) {
        const rfcReceptor = (cfdi.receptorRfc || "").trim().toUpperCase();
        const esGenerico = RFC_GENERICOS.has(rfcReceptor);

        // 0. Alias aprendido por nombre de receptor (prioridad máxima)
        const aliasNorm = normalizarTexto(cfdi.receptorNombre || "");
        let aliasHit: any = null;
        if (aliasNorm) {
          const { data: al } = await (supabase as any)
            .from("factura_cliente_aliases")
            .select("empresa_id")
            .eq("alias_normalizado", aliasNorm)
            .maybeSingle();
          aliasHit = al || null;
        }

        if (aliasHit?.empresa_id) {
          clienteEstatus = "exacto_rfc";
          empresaIdMatched = aliasHit.empresa_id;
          candidatos = [];
        } else if (esGenerico) {
          clienteEstatus = "generico_manual";
          candidatos = [];
        } else {

          // a. Cliente por RFC
          if (cfdi.receptorRfc) {
            const { data: porRfc } = await (supabase as any)
              .from("companies")
              .select("id, name, rfc")
              .ilike("rfc", cfdi.receptorRfc.trim())
              .limit(5);
            if (porRfc && porRfc.length === 1) {
              clienteEstatus = "exacto_rfc";
              empresaIdMatched = porRfc[0].id;
            }
          }
          if (clienteEstatus !== "exacto_rfc") {
            const palabras = palabrasSignificativas(cfdi.receptorNombre || "");
            const encontrados: Record<string, any> = {};
            for (const w of palabras) {
              const { data: cands } = await (supabase as any)
                .from("companies")
                .select("id, name, razon_social")
                .or(`razon_social.ilike.%${w}%,name.ilike.%${w}%`)
                .limit(10);
              for (const c of cands || []) encontrados[c.id] = c;
            }
            const objetivo = normalizarTexto(cfdi.receptorNombre || "");
            candidatos = Object.values(encontrados)
              .map((c: any) => {
                const n = normalizarTexto(c.razon_social || c.name || "");
                const comunes = palabras.filter((w) => n.includes(w)).length;
                return { id: c.id, name: c.name, razon_social: c.razon_social, score: comunes + (n === objetivo ? 10 : 0) };
              })

              .sort((a: any, b: any) => b.score - a.score)
              .slice(0, 5)
              .map((c: any) => ({ id: c.id, name: c.name, razon_social: c.razon_social }));
            clienteEstatus = candidatos.length ? "nombre_similar" : "pendiente";
          }
        }

        // b. Plaza / empresa vendedora
        empresaVendedora = mapEmisorAEmpresaVendedora(cfdi.emisorRfc || "");
        const nombrePlaza = mapSerieAPlaza(cfdi.serie || "");
        if (nombrePlaza) {
          const { data: pl } = await (supabase as any)
            .from("plazas")
            .select("id")
            .eq("nombre", nombrePlaza)
            .limit(1);
          plazaId = pl && pl.length ? pl[0].id : null;
        }

        // c. Productos
        for (const c of cfdi.conceptos) {
          let prod: any = null;
          if (c.codigo) {
            const { data: p } = await (supabase as any)
              .from("productos")
              .select("id, codigo, descripcion")
              .eq("codigo", c.codigo)
              .limit(1);
            prod = p && p.length ? p[0] : null;
          }
          productos.push({
            codigo: c.codigo,
            descripcion: c.descripcion,
            cantidad: c.cantidad,
            valorUnitario: c.valorUnitario,
            importe: c.importe,
            producto_id: prod?.id ?? null,
            producto_nombre: prod ? `${prod.codigo} — ${prod.descripcion || ""}` : null,
            matched: !!prod,
          });
        }
      }

      // 3. Subir XML
      const path = `${cfdi.uuidFiscal || Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, new Blob([texto], { type: "application/xml" }), { upsert: true });
      if (upErr) throw new Error(`No se pudo subir el XML: ${upErr.message}`);

      // 4. Insert intake
      const { error: insErr } = await (supabase as any).from("documentos_xml_intake").insert({
        storage_path: path,
        nombre_archivo: file.name,
        uuid_fiscal: cfdi.uuidFiscal,
        serie: cfdi.serie,
        folio: cfdi.folio,
        plaza_id_detectado: plazaId,
        empresa_vendedora_detectada: empresaVendedora,
        emisor_rfc: cfdi.emisorRfc,
        fecha_factura: cfdi.fecha ? cfdi.fecha.slice(0, 10) : null,
        fecha_vencimiento: null,
        subtotal: cfdi.subtotal,
        total: cfdi.total,
        forma_pago: cfdi.formaPago,
        metodo_pago: cfdi.metodoPago,
        uso_cfdi: cfdi.usoCfdi,
        moneda: cfdi.moneda,
        receptor_nombre: cfdi.receptorNombre,
        receptor_rfc: cfdi.receptorRfc,
        empresa_id_matched: empresaIdMatched,
        cliente_match_estatus: yaExiste ? "pendiente" : clienteEstatus,
        cliente_candidatos: candidatos,
        productos_json: productos,
        estatus: yaExiste ? "ya_existia" : "pendiente",
        subido_por: userId,
      });
      if (insErr) throw new Error(insErr.message);
    },
    []
  );

  const manejarArchivos = useCallback(
    async (files: File[]) => {
      const xmls = files.filter((f) => f.name.toLowerCase().endsWith(".xml"));
      if (!xmls.length) {
        toast.error("Selecciona al menos un archivo .xml");
        return;
      }
      setProcesando(true);
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;
      let ok = 0;
      for (const f of xmls) {
        try {
          await procesarArchivo(f, userId);
          ok++;
        } catch (e: any) {
          toast.error(`${f.name}: ${e?.message || "no se pudo procesar"}`);
        }
      }
      setProcesando(false);
      if (ok) toast.success(`${ok} XML procesado(s)`);
      refetch();
    },
    [procesarArchivo, refetch]
  );

  /* ---------------- Estado derivado por fila ---------------- */

  const lineasDe = (row: IntakeRow): ProductoLinea[] => (Array.isArray(row.productos_json) ? row.productos_json : []);

  const productoResuelto = (row: IntakeRow, idx: number, linea: ProductoLinea) =>
    productoManual[row.id]?.[idx] || linea.producto_id || null;

  const todosProductosOk = (row: IntakeRow) =>
    lineasDe(row).every((l, i) => !!productoResuelto(row, i, l));

  const empresaResuelta = (row: IntakeRow): string | null => {
    if (row.cliente_match_estatus === "exacto_rfc") return row.empresa_id_matched || null;
    const manual = clienteManual[row.id];
    if (manual && manual !== "__nuevo__") return manual;
    if (manual === "__nuevo__") return "__nuevo__";
    if (row.cliente_match_estatus === "pendiente") return "__nuevo__";
    return null;
  };

  const plazaResuelta = (row: IntakeRow): string | null => plazaManual[row.id] || row.plaza_id_detectado || null;

  const calcularFechaVencimiento = (fechaFactura: string | null | undefined, tipoPago: string | null | undefined) => {
    if (!fechaFactura || !tipoPago) return "";
    const base = String(fechaFactura).slice(0, 10);
    if (tipoPago === "contado") return base;
    const [y, m, d] = base.split("-").map(Number);
    if (!y || !m || !d) return "";
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 30);
    return dt.toISOString().slice(0, 10);
  };

  const perfilDe = (row: IntakeRow): PerfilEmpresa | undefined => {
    const id = empresaResuelta(row);
    return id && id !== "__nuevo__" ? perfilPorEmpresa[id] : undefined;
  };

  const ejecutivoResuelto = (row: IntakeRow): string =>
    ejecutivoManual[row.id] ?? perfilDe(row)?.ejecutivoDefault ?? "";
  const contactoResuelto = (row: IntakeRow): string =>
    contactoManual[row.id] ?? perfilDe(row)?.contactoDefault ?? "";
  const tipoPagoResuelto = (row: IntakeRow): string =>
    tipoPagoManual[row.id] ?? perfilDe(row)?.tipoPagoDefault ?? "";
  const fechaVencResuelta = (row: IntakeRow): string =>
    fechaVencManual[row.id] ?? calcularFechaVencimiento(row.fecha_factura, tipoPagoResuelto(row));
  const estatusResuelto = (row: IntakeRow): string => estatusManual[row.id] ?? "vigente";



  const necesitaRevision = (row: IntakeRow) =>
    row.cliente_match_estatus !== "exacto_rfc" ||
    row.cliente_match_estatus === "generico_manual" ||
    !lineasDe(row).every((l) => l.matched) ||
    !row.plaza_id_detectado ||
    !row.empresa_vendedora_detectada;

  const pendientes = (filas as IntakeRow[]).filter((r) => r.estatus === "pendiente");
  const listas = pendientes.filter((r) => !necesitaRevision(r));
  const revision = pendientes.filter((r) => necesitaRevision(r));
  const yaRegistradas = (filas as IntakeRow[]).filter((r) => r.estatus === "ya_existia");

  useEffect(() => {
    for (const row of pendientes) {
      const id = empresaResuelta(row);
      if (id && id !== "__nuevo__" && !perfilPorEmpresa[id]) cargarPerfilEmpresa(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, clienteManual, perfilPorEmpresa, cargarPerfilEmpresa]);



  /* ---------------- Acciones ---------------- */

  const descartar = async (row: IntakeRow) => {
    const { error } = await (supabase as any)
      .from("documentos_xml_intake")
      .update({ estatus: "descartado" })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Descartada de la bandeja");
    refetch();
  };

  const importarFila = async (row: IntakeRow, silencioso = false): Promise<boolean> => {
    const lineas = lineasDe(row);
    if (!todosProductosOk(row)) {
      if (!silencioso) toast.error("Faltan productos por emparejar");
      return false;
    }
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id ?? null;

    let empresaId = empresaResuelta(row);
    if (!empresaId) {
      if (!silencioso) toast.error("Selecciona el cliente");
      return false;
    }

    const ejecutivoSel = ejecutivoResuelto(row);
    const contactoSel = contactoResuelto(row);
    const tipoPagoSel = tipoPagoResuelto(row);
    const fechaVencSel = fechaVencResuelta(row);
    const eraNueva = empresaId === "__nuevo__";

    if (eraNueva) {
      const { data: nueva, error: errNueva } = await (supabase as any)
        .from("companies")
        .insert({
          name: row.receptor_nombre || "SIN NOMBRE",
          razon_social: row.receptor_nombre || null,
          rfc: row.receptor_rfc || null,
          tipo_pago: tipoPagoSel || null,
          is_active: true,
        })
        .select("id")
        .single();
      if (errNueva) {
        if (!silencioso) toast.error(errNueva.message);
        return false;
      }
      empresaId = nueva.id;
    } else if (row.receptor_rfc) {
      const { data: emp } = await (supabase as any).from("companies").select("id, rfc").eq("id", empresaId).single();
      if (emp && !emp.rfc) {
        await (supabase as any).from("companies").update({ rfc: row.receptor_rfc }).eq("id", empresaId);
      }
    }

    const { data: doc, error: errDoc } = await (supabase as any)
      .from("documentos")
      .insert({
        tipo_documento: "factura",
        numero_factura: `${row.serie || ""}${row.folio || ""}`,
        empresa_id: empresaId,
        empresa_vendedora: row.empresa_vendedora_detectada || null,
        plaza_id: plazaResuelta(row),
        fecha_documento: row.fecha_factura,
        fecha_vencimiento: fechaVencSel || null,
        ejecutivo_venta_id: ejecutivoSel || null,
        contacto_id: contactoSel || null,
        tipo_pago: tipoPagoSel || null,
        estatus_factura: estatusResuelto(row),
        subtotal: row.subtotal,
        total: row.total,
        forma_pago: row.forma_pago,
        metodo_pago: row.metodo_pago,
        uso_cfdi: row.uso_cfdi,
        folio_fiscal_uuid: row.uuid_fiscal,
        is_active: true,
        created_by: userId,
      })
      .select("id")
      .single();
    if (errDoc) {
      if (!silencioso) toast.error(errDoc.message);
      return false;
    }

    if (eraNueva) {
      if (contactoSel) {
        await (supabase as any).from("companies").update({ primary_contact_id: contactoSel }).eq("id", empresaId);
      }
      if (ejecutivoSel) {
        await (supabase as any).from("company_ejecutivos").insert({ company_id: empresaId, user_id: ejecutivoSel });
      }
    } else {
      const perfil = perfilPorEmpresa[empresaId as string];
      if (perfil) {
        const etiquetaPago = (v: string) => TIPO_PAGO_OPTS.find((o) => o.v === v)?.l || v || "(vacío)";
        const etiquetaUsuario = (v: string) => profileOptions.find((o) => o.value === v)?.label || v || "(vacío)";
        const etiquetaContacto = (v: string) => perfil.contactos.find((c) => c.id === v)?.label || v || "(vacío)";
        const cambios: string[] = [];
        const cambioPago = tipoPagoSel && tipoPagoSel !== (perfil.tipoPagoDefault || "");
        const cambioContacto = contactoSel && contactoSel !== (perfil.contactoDefault || "");
        const cambioEjecutivo = ejecutivoSel && ejecutivoSel !== (perfil.ejecutivoDefault || "");
        if (cambioPago)
          cambios.push(`Tipo de pago (de ${etiquetaPago(perfil.tipoPagoDefault || "")} a ${etiquetaPago(tipoPagoSel)})`);
        if (cambioContacto)
          cambios.push(`Contacto (de ${etiquetaContacto(perfil.contactoDefault || "")} a ${etiquetaContacto(contactoSel)})`);
        if (cambioEjecutivo)
          cambios.push(
            `Ejecutivo de venta (de ${etiquetaUsuario(perfil.ejecutivoDefault || "")} a ${etiquetaUsuario(ejecutivoSel)})`
          );
        if (cambios.length && confirm(`¿También quieres actualizar en el perfil del cliente: ${cambios.join(", ")}?`)) {
          if (cambioPago) await (supabase as any).from("companies").update({ tipo_pago: tipoPagoSel }).eq("id", empresaId);
          if (cambioContacto)
            await (supabase as any).from("companies").update({ primary_contact_id: contactoSel }).eq("id", empresaId);
          if (cambioEjecutivo) {
            await (supabase as any).from("company_ejecutivos").delete().eq("company_id", empresaId);
            await (supabase as any).from("company_ejecutivos").insert({ company_id: empresaId, user_id: ejecutivoSel });
          }
          setPerfilPorEmpresa((prev) => ({
            ...prev,
            [empresaId as string]: {
              ...perfil,
              tipoPagoDefault: cambioPago ? tipoPagoSel : perfil.tipoPagoDefault,
              contactoDefault: cambioContacto ? contactoSel : perfil.contactoDefault,
              ejecutivoDefault: cambioEjecutivo ? ejecutivoSel : perfil.ejecutivoDefault,
            },
          }));
        }
      }
    }


    const payload = lineas.map((l, i) => ({
      documento_id: doc.id,
      producto_id: productoResuelto(row, i, l),
      cantidad: l.cantidad,
      precio_unitario: l.valorUnitario,
      subtotal: l.importe,
    }));
    if (payload.length) {
      const { error: errProd } = await (supabase as any).from("documento_productos").insert(payload);
      if (errProd) {
        if (!silencioso) toast.error(errProd.message);
        return false;
      }
    }

    const { error: errUpd } = await (supabase as any)
      .from("documentos_xml_intake")
      .update({
        estatus: "importado",
        documento_creado_id: doc.id,
        importado_at: new Date().toISOString(),
        importado_por: userId,
      })
      .eq("id", row.id);
    if (errUpd && !silencioso) toast.error(errUpd.message);

    // Aprendizaje de alias de cliente (cuando hubo intervención manual o cliente nuevo)
    if (row.cliente_match_estatus !== "exacto_rfc" && row.receptor_nombre && empresaId) {
      const aliasNorm = normalizarTexto(row.receptor_nombre);
      if (aliasNorm) {
        const { data: existente } = await (supabase as any)
          .from("factura_cliente_aliases")
          .select("id, veces_usado")
          .eq("alias_normalizado", aliasNorm)
          .maybeSingle();
        if (existente) {
          await (supabase as any)
            .from("factura_cliente_aliases")
            .update({
              empresa_id: empresaId,
              veces_usado: (existente.veces_usado || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existente.id);
        } else {
          await (supabase as any).from("factura_cliente_aliases").insert({
            alias_normalizado: aliasNorm,
            empresa_id: empresaId,
            veces_usado: 1,
            created_by: userId,
          });
        }
      }
    }
    return true;

  };

  const handleImportar = async (row: IntakeRow) => {
    setImportandoId(row.id);
    const ok = await importarFila(row);
    setImportandoId(null);
    if (ok) {
      toast.success(`Factura ${row.serie || ""}${row.folio || ""} importada`);
      refetch();
    }
  };

  const handleImportarTodas = async () => {
    setImportandoLote(true);
    let ok = 0;
    for (const row of listas) {
      const r = await importarFila(row, true);
      if (r) ok++;
    }
    setImportandoLote(false);
    toast.success(`${ok} factura(s) importada(s)`);
    refetch();
  };

  /* ---------------- Render ---------------- */

  const renderTarjeta = (row: IntakeRow, modo: "lista" | "revision" | "existente") => {
    const lineas = lineasDe(row);
    const empresaOk = !!empresaResuelta(row);
    const puedeImportar = todosProductosOk(row) && empresaOk;

    return (
      <Card key={row.id} className="border-border/70">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">
                {row.serie || ""}
                {row.folio || ""} · <span className="text-muted-foreground font-light">{fechaCorta(row.fecha_factura)}</span>
              </div>
              <div className="text-xs font-light text-muted-foreground">
                {row.receptor_nombre || "—"} · {row.receptor_rfc || "sin RFC"}
              </div>
              <div className="text-xs font-light text-muted-foreground">UUID: {row.uuid_fiscal || "—"}</div>
            </div>
            <div className="text-right">
              <div className="text-base font-semibold">{money(row.total)}</div>
              <div className="text-[11px] text-muted-foreground">
                {row.empresa_vendedora_detectada || "empresa vendedora no detectada"}
              </div>
            </div>
          </div>

          {modo !== "existente" && (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                {/* Cliente */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Cliente</Label>
                  {row.cliente_match_estatus === "exacto_rfc" && (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      Cliente emparejado por RFC
                    </Badge>
                  )}
                  {row.cliente_match_estatus === "nombre_similar" && (
                    <div className="space-y-1.5">
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Nombre similar — confirma</Badge>
                      <Select
                        value={clienteManual[row.id] || ""}
                        onValueChange={(v) => setClienteManual((p) => ({ ...p, [row.id]: v }))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Elegir cliente…" />
                        </SelectTrigger>
                        <SelectContent>
                          {(row.cliente_candidatos || []).map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.razon_social || c.name}
                              {c.name && c.razon_social && c.name !== c.razon_social ? " — " + c.name : ""}
                            </SelectItem>
                          ))}
                          <SelectItem value="__nuevo__">＋ Crear cliente nuevo</SelectItem>
                        </SelectContent>
                      </Select>
                      {!mostrarBusquedaAmplia[row.id] ? (
                        <button
                          type="button"
                          className="text-[11px] text-blue-600 hover:underline"
                          onClick={() => setMostrarBusquedaAmplia((p) => ({ ...p, [row.id]: true }))}
                        >
                          ¿No está en la lista? Buscar en todo el directorio
                        </button>
                      ) : (
                        <SearchableSelect
                          value={clienteManual[row.id] || ""}
                          onValueChange={(v) => setClienteManual((p) => ({ ...p, [row.id]: v }))}
                          options={companyOptions}
                          placeholder="Buscar cliente por nombre o razón social…"
                        />
                      )}
                    </div>

                  )}
                  {row.cliente_match_estatus === "generico_manual" && (
                    <div className="space-y-1.5">
                      <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
                        RFC genérico (Público en General) — selecciona el cliente real manualmente
                      </Badge>
                      <SearchableSelect
                        value={clienteManual[row.id] || ""}
                        onValueChange={(v) => setClienteManual((p) => ({ ...p, [row.id]: v }))}
                        options={companyOptions}
                        placeholder="Buscar cliente por nombre o razón social…"
                      />
                    </div>
                  )}
                  {row.cliente_match_estatus === "pendiente" && (
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                      Se creará cliente nuevo: {row.receptor_nombre}
                    </Badge>
                  )}
                </div>

                {/* Plaza */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Plaza</Label>
                  {row.plaza_id_detectado ? (
                    <Badge variant="secondary">
                      {(plazas as any[]).find((p) => p.id === row.plaza_id_detectado)?.nombre || "Detectada"}
                    </Badge>
                  ) : (
                    <Select
                      value={plazaManual[row.id] || ""}
                      onValueChange={(v) => setPlazaManual((p) => ({ ...p, [row.id]: v }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Plaza no detectada — elígela" />
                      </SelectTrigger>
                      <SelectContent>
                        {(plazas as any[]).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {(() => {
                const empId = empresaResuelta(row);
                if (!empId) return null;
                const perfil = empId !== "__nuevo__" ? perfilPorEmpresa[empId] : undefined;
                return (
                  <div className="grid gap-3 md:grid-cols-5">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Ejecutivo de venta</Label>
                      <Select
                        value={ejecutivoResuelto(row)}
                        onValueChange={(v) => setEjecutivoManual((p) => ({ ...p, [row.id]: v }))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Elegir ejecutivo…" />
                        </SelectTrigger>
                        <SelectContent>
                          {profileOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Contacto</Label>
                      <Select
                        value={contactoResuelto(row)}
                        onValueChange={(v) => setContactoManual((p) => ({ ...p, [row.id]: v }))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Elegir contacto…" />
                        </SelectTrigger>
                        <SelectContent>
                          {(perfil?.contactos || []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Tipo de pago</Label>
                      <Select
                        value={tipoPagoResuelto(row)}
                        onValueChange={(v) => {
                          setTipoPagoManual((p) => ({ ...p, [row.id]: v }));
                          if (fechaVencManual[row.id] === undefined) {
                            const nueva = calcularFechaVencimiento(row.fecha_factura, v);
                            if (nueva) setFechaVencManual((p) => ({ ...p, [row.id]: nueva }));
                          }
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Elegir tipo de pago…" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPO_PAGO_OPTS.map((o) => (
                            <SelectItem key={o.v} value={o.v}>
                              {o.l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Fecha de vencimiento</Label>
                      <Input
                        type="date"
                        className="h-9"
                        value={fechaVencResuelta(row)}
                        onChange={(e) => setFechaVencManual((p) => ({ ...p, [row.id]: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Estatus</Label>
                      <Select
                        value={estatusResuelto(row)}
                        onValueChange={(v) => setEstatusManual((p) => ({ ...p, [row.id]: v }))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Estatus…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vigente">Vigente</SelectItem>
                          <SelectItem value="pagada">Pagada</SelectItem>
                          <SelectItem value="cancelada">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                  </div>
                );
              })()}



              {/* Productos */}
              <div className="rounded-md border divide-y">
                {lineas.map((l, i) => {
                  const resuelto = productoResuelto(row, i, l);
                  return (
                    <div key={i} className="p-2 grid gap-2 md:grid-cols-[1fr_auto] items-center">
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">
                          {l.codigo || "sin código"} — {l.descripcion || ""}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {l.cantidad} × {money(l.valorUnitario)} = {money(l.importe)}
                        </div>
                        {!l.matched && (
                          <div className="mt-1">
                            <SearchableSelect
                              value={productoManual[row.id]?.[i] || ""}
                              onValueChange={(v) =>
                                setProductoManual((p) => ({ ...p, [row.id]: { ...(p[row.id] || {}), [i]: v } }))
                              }
                              options={productoOptions}
                              placeholder="Emparejar con producto del catálogo…"
                            />
                          </div>
                        )}
                      </div>
                      <Badge className={resuelto ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-red-100 text-red-800 hover:bg-red-100"}>
                        {resuelto ? "Emparejado" : "Sin emparejar"}
                      </Badge>
                    </div>
                  );
                })}
                {lineas.length === 0 && <div className="p-2 text-xs text-muted-foreground">Sin conceptos</div>}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => descartar(row)}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {modo === "existente" ? "Descartar de la bandeja" : "Descartar"}
            </Button>
            {modo !== "existente" && (
              <Button size="sm" disabled={!puedeImportar || importandoId === row.id} onClick={() => handleImportar(row)}>
                {importandoId === row.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                Importar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileCode2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Importar Facturas XML (CFDI)</h1>
          <p className="text-sm text-muted-foreground font-light">
            Carga los XML timbrados; el sistema empareja cliente, plaza y productos antes de crear las facturas.
          </p>
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          manejarArchivos(Array.from(e.dataTransfer.files || []));
        }}
        className={`rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-light text-muted-foreground">
          Arrastra aquí uno o varios archivos .xml, o
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".xml"
          multiple
          className="hidden"
          onChange={(e) => {
            manejarArchivos(Array.from(e.target.files || []));
            e.target.value = "";
          }}
        />
        <Button className="mt-3" variant="outline" disabled={procesando} onClick={() => fileRef.current?.click()}>
          {procesando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Seleccionar archivos
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando bandeja…
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> Listas para importar ({listas.length})
              </h2>
              {listas.length > 0 && (
                <Button size="sm" disabled={importandoLote} onClick={handleImportarTodas}>
                  {importandoLote ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                  Importar todas las listas
                </Button>
              )}
            </div>
            {listas.length === 0 ? (
              <p className="text-xs text-muted-foreground font-light">Nada listo por ahora.</p>
            ) : (
              listas.map((r) => renderTarjeta(r, "lista"))
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Necesitan revisión ({revision.length})
            </h2>
            {revision.length === 0 ? (
              <p className="text-xs text-muted-foreground font-light">Sin pendientes de revisión.</p>
            ) : (
              revision.map((r) => renderTarjeta(r, "revision"))
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-blue-600" /> Ya registradas ({yaRegistradas.length})
            </h2>
            {yaRegistradas.length === 0 ? (
              <p className="text-xs text-muted-foreground font-light">Ninguna duplicada.</p>
            ) : (
              yaRegistradas.map((r) => renderTarjeta(r, "existente"))
            )}
          </section>
        </div>
      )}
    </div>
  );
}

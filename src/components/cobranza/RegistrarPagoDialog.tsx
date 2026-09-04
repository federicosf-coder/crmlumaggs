import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Paperclip, X, FileText, Image as ImageIcon } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
// Confirmation email flow removed per request.


interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: (pagoId?: string) => void;
  defaultEmpresaId?: string;
  defaultDocumentoId?: string;
  empresaVendedora?: "lumaggs_chevron" | "galsa_phillips66" | null;
}

interface DocOption {
  id: string;
  tipo_documento: "factura" | "pedido" | "cotizacion";
  numero: string;
  fecha_documento: string;
  total: number;
  saldo: number;
}

/** Tolerancia en pesos para diferencias mínimas al aplicar pagos */
const TOLERANCIA = 5;

const TIPO_LABEL: Record<string, string> = {
  factura: "Factura",
  pedido: "Pedido",
  cotizacion: "Cotización",
};

type FormaPago = "contado" | "credito" | "credito_cescemex";

const FORMA_PAGO_OPTIONS: { value: FormaPago; label: string }[] = [
  { value: "contado", label: "Contado" },
  { value: "credito", label: "Crédito Directo" },
  { value: "credito_cescemex", label: "Crédito Cescemex" },
];

const VALID_FORMAS: FormaPago[] = ["contado", "credito", "credito_cescemex"];

export function RegistrarPagoDialog({ open, onOpenChange, onSaved, defaultEmpresaId, defaultDocumentoId, empresaVendedora }: Props) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<{ id: string; name: string; email?: string | null; tipo_pago?: string | null }[]>([]);
  const [plazas, setPlazas] = useState<{ id: string; nombre: string }[]>([]);
  const [docs, setDocs] = useState<DocOption[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [empresaId, setEmpresaId] = useState("");
  const [plazaId, setPlazaId] = useState("");
  const [empVend, setEmpVend] = useState<"lumaggs_chevron" | "galsa_phillips66" | "">(empresaVendedora || "");
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split("T")[0]);
  const [montoTotal, setMontoTotal] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [formaPago, setFormaPago] = useState<FormaPago | "">("");
  const [seleccion, setSeleccion] = useState<Record<string, string>>({}); // doc_id -> monto a aplicar
  const [tipoFiltro, setTipoFiltro] = useState<"factura" | "pedido" | "cotizacion">("factura");


  useEffect(() => {
    if (!open) return;
    (async () => {
      const all: any[] = [];
      const size = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("companies")
          .select("id,name,email,tipo_pago")
          .eq("is_active", true)
          .order("name")
          .range(from, from + size - 1);
        if (error) break;
        const rows = data || [];
        all.push(...rows);
        if (rows.length < size) break;
        from += size;
      }
      setCompanies(all);
    })();
    supabase.from("plazas").select("id,nombre").eq("is_active", true).order("nombre")
      .then(({ data }) => setPlazas(data || []));
  }, [open]);

  // Prefill empresa from default when dialog opens
  useEffect(() => {
    if (open && defaultEmpresaId) setEmpresaId(defaultEmpresaId);
  }, [open, defaultEmpresaId]);

  // Auto-select the default document once docs load
  useEffect(() => {
    if (!open || !defaultDocumentoId || docs.length === 0) return;
    const doc = docs.find((d) => d.id === defaultDocumentoId);
    if (!doc) return;
    setTipoFiltro(doc.tipo_documento);
    setSeleccion((prev) => {
      if (prev[doc.id] !== undefined) return prev;
      const restante = Math.max(0, (Number(montoTotal) || 0));
      const sugerido = restante > 0 ? Math.min(doc.saldo, restante) : doc.saldo;
      return { ...prev, [doc.id]: String(sugerido.toFixed(2)) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDocumentoId, docs]);

  // Cuando cambia la empresa, prellenar Forma de pago desde la empresa si es válida
  useEffect(() => {
    if (!empresaId) { setFormaPago(""); return; }
    const emp = companies.find((c) => c.id === empresaId);
    const t = (emp?.tipo_pago || "").toLowerCase();
    if (VALID_FORMAS.includes(t as FormaPago)) {
      setFormaPago(t as FormaPago);
    } else {
      setFormaPago("");
    }
  }, [empresaId, companies]);

  // Cargar documentos al cambiar empresa
  useEffect(() => {
    if (!empresaId) { setDocs([]); setSeleccion({}); return; }
    setLoadingDocs(true);
    supabase.from("documentos")
      .select("id,tipo_documento,numero_factura,numero_pedido,numero_cotizacion,fecha_documento,total,saldo_pendiente_cobranza,estatus_factura")
      .eq("empresa_id", empresaId)
      .eq("is_active", true)
      .gt("total", 0)
      .in("tipo_documento", ["factura", "pedido", "cotizacion"])
      .order("fecha_documento", { ascending: false })
      .then(({ data }) => {
        const mapped: DocOption[] = (data || [])
          .filter((d: any) => {
            const status = (d.estatus_factura || "").toLowerCase();
            return status !== "pagada" && status !== "cancelada";
          })
          .map((d: any) => ({
            id: d.id,
            tipo_documento: d.tipo_documento,
            numero: d.numero_factura || d.numero_pedido || d.numero_cotizacion || "—",
            fecha_documento: d.fecha_documento,
            total: Number(d.total || 0),
            saldo: Number(d.saldo_pendiente_cobranza ?? d.total ?? 0),
          }));
        setDocs(mapped);
        setSeleccion({});
        setLoadingDocs(false);
      });
  }, [empresaId]);

  const totalAsignado = useMemo(
    () => Object.values(seleccion).reduce((s, v) => s + (Number(v) || 0), 0),
    [seleccion]
  );
  const montoNum = Number(montoTotal) || 0;
  const diferencia = montoNum - totalAsignado;

  const toggleDoc = (doc: DocOption, checked: boolean) => {
    setSeleccion((prev) => {
      const next = { ...prev };
      if (checked) {
        // Auto-llenar con saldo o lo que quede del pago
        const restante = Math.max(0, montoNum - totalAsignado);
        let sugerido = montoNum > 0 ? Math.min(doc.saldo, restante || doc.saldo) : doc.saldo;
        // Tolerancia de $5: si el restante excede el saldo por centavos, aplicar el restante completo
        if (montoNum > 0 && restante > doc.saldo && restante - doc.saldo <= TOLERANCIA) sugerido = restante;
        next[doc.id] = String(sugerido.toFixed(2));
      } else {
        delete next[doc.id];
      }
      return next;
    });
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    const valid = list.filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
    if (valid.length !== list.length) toast.error("Solo se permiten imágenes o PDF");
    setFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const reset = () => {
    setEmpresaId(""); setPlazaId(""); setMontoTotal(""); setObservaciones("");
    setSeleccion({}); setFiles([]); setDocs([]); setFormaPago("");
    setFechaPago(new Date().toISOString().split("T")[0]);
  };

  const handleSave = async () => {
    if (!empresaId) { toast.error("Selecciona la empresa"); return; }
    if (!plazaId) { toast.error("La plaza es requerida"); return; }
    if (!formaPago) { toast.error("Selecciona la forma de pago"); return; }
    if (!montoNum || montoNum <= 0) { toast.error("Monto inválido"); return; }
    const aplicaciones = Object.entries(seleccion)
      .map(([doc_id, monto]) => ({ doc_id, monto: Number(monto) || 0 }))
      .filter((a) => a.monto > 0);
    if (totalAsignado > montoNum + TOLERANCIA) { toast.error("La suma asignada excede el monto del pago"); return; }

    setSaving(true);
    const { data: pago, error } = await supabase.from("cobranza_pagos").insert({
      empresa_id: empresaId,
      plaza_id: plazaId,
      fecha_pago: fechaPago,
      monto_total: montoNum,
      monto_disponible: montoNum,
      moneda: "MXN",
      tipo_pago: formaPago,
      estatus_pago: "recibido",
      observaciones: observaciones || null,
      creado_por: user?.id,
      ...(empresaVendedora ? { empresa_vendedora: empresaVendedora } : {}),
    } as any).select("id").single();

    if (error || !pago) { setSaving(false); toast.error(error?.message || "Error"); return; }

    // Sincronizar Forma de pago en la empresa si es distinta o está vacía
    const emp = companies.find((c) => c.id === empresaId);
    const empForma = (emp?.tipo_pago || "").toLowerCase();
    if (empForma !== formaPago) {
      await supabase.from("companies").update({ tipo_pago: formaPago as any }).eq("id", empresaId);
    }

    // Aplicaciones
    const aplicacionesPayload = aplicaciones.map((a) => {
      const doc = docs.find((d) => d.id === a.doc_id)!;
      return {
        pago_id: pago.id,
        documento_id: a.doc_id,
        tipo_documento: doc.tipo_documento,
        monto_aplicado: a.monto,
        creado_por: user?.id,
      };
    });
    const { error: appErr } = await supabase.from("cobranza_aplicaciones").insert(aplicacionesPayload);
    if (appErr) { setSaving(false); toast.error("Pago guardado, pero falló alguna aplicación: " + appErr.message); return; }

    // Archivos
    if (files.length > 0) {
      const uploads = files.map(async (file) => {
        const ext = file.name.split(".").pop();
        const path = `pagos/${pago.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("document-files").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("document-files").getPublicUrl(path);
        return supabase.from("cobranza_pago_archivos").insert({
          pago_id: pago.id,
          url_archivo: pub.publicUrl,
          nombre_archivo: file.name,
          tipo_archivo: file.type,
          usuario_carga: user?.id,
        });
      });
      try { await Promise.all(uploads); } catch { toast.error("Pago guardado, pero algunos archivos no se subieron"); }
    }

    setSaving(false);
    toast.success("Pago registrado y aplicado");

    onSaved(pago.id);
    onOpenChange(false);
    reset();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Empresa vendedora *</Label>
              <SearchableSelect
                value={empVend}
                onValueChange={(v) => setEmpVend(v as "lumaggs_chevron" | "galsa_phillips66")}
                options={[
                  { value: "lumaggs_chevron", label: "Lumaggs (Chevron)" },
                  { value: "galsa_phillips66", label: "Galsa (Phillips 66)" },
                ]}
                placeholder="Selecciona empresa vendedora..."
              />
            </div>
            <div>
              <Label>Empresa *</Label>
              <SearchableSelect
                value={empresaId}
                onValueChange={setEmpresaId}
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Buscar empresa..."
              />
            </div>
            <div>
              <Label>Plaza *</Label>
              <SearchableSelect
                value={plazaId}
                onValueChange={setPlazaId}
                options={plazas.map((p) => ({ value: p.id, label: p.nombre }))}
                placeholder="Selecciona plaza..."
              />
              {!plazaId && <p className="text-xs text-destructive mt-1">La plaza es requerida</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fecha de pago *</Label>
              <Input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
            </div>
            <div>
              <Label>Monto total del pago *</Label>
              <Input type="number" step="0.01" value={montoTotal} onChange={(e) => setMontoTotal(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Forma de pago *</Label>
            <SearchableSelect
              value={formaPago}
              onValueChange={(v) => setFormaPago(v as FormaPago)}
              options={FORMA_PAGO_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              placeholder="Selecciona forma de pago..."
            />
            {empresaId && (() => {
              const emp = companies.find((c) => c.id === empresaId);
              const empForma = (emp?.tipo_pago || "").toLowerCase();
              if (!empForma) return <p className="text-xs text-muted-foreground mt-1">La empresa no tiene forma de pago registrada. Se actualizará al guardar.</p>;
              if (!VALID_FORMAS.includes(empForma as FormaPago)) return <p className="text-xs text-amber-600 mt-1">La empresa tiene "{empForma}". Al guardar, se actualizará a la forma seleccionada.</p>;
              if (formaPago && formaPago !== empForma) return <p className="text-xs text-amber-600 mt-1">La empresa tiene "{FORMA_PAGO_OPTIONS.find(o => o.value === empForma)?.label}". Al guardar, se actualizará.</p>;
              return null;
            })()}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <Label>Documentos a ligar</Label>
              {montoNum > 0 && (
                <div className="text-xs text-muted-foreground">
                  Asignado: <span className="font-medium text-foreground">{formatCurrency(totalAsignado)}</span> /{" "}
                  {formatCurrency(montoNum)}{" "}
                  {Math.abs(diferencia) > 0.01 && (
                    <span className={diferencia < 0 ? "text-destructive" : "text-amber-600"}>
                      ({diferencia > 0 ? "+" : ""}{formatCurrency(diferencia)})
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-1 mb-2">
              {(["factura", "pedido", "cotizacion"] as const).map((t) => {
                const count = docs.filter((d) => d.tipo_documento === t).length;
                return (
                  <Button
                    key={t}
                    type="button"
                    size="sm"
                    variant={tipoFiltro === t ? "default" : "outline"}
                    onClick={() => setTipoFiltro(t)}
                  >
                    {TIPO_LABEL[t]}s {empresaId && <span className="ml-1 opacity-70">({count})</span>}
                  </Button>
                );
              })}
            </div>
            <div className="border rounded-md">
              {!empresaId && (
                <div className="p-6 text-sm text-center text-muted-foreground">Selecciona una empresa para ver sus documentos</div>
              )}
              {empresaId && loadingDocs && (
                <div className="p-6 text-sm text-center text-muted-foreground">Cargando documentos...</div>
              )}
              {empresaId && !loadingDocs && docs.filter((d) => d.tipo_documento === tipoFiltro).length === 0 && (
                <div className="p-6 text-sm text-center text-muted-foreground">No hay {TIPO_LABEL[tipoFiltro].toLowerCase()}s para esta empresa</div>
              )}
              {empresaId && !loadingDocs && docs.filter((d) => d.tipo_documento === tipoFiltro).length > 0 && (
                <ScrollArea className="h-64">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/50 border-b">
                      <tr className="text-left">
                        <th className="p-2 w-8"></th>
                        <th className="p-2">Folio</th>
                        <th className="p-2">Fecha</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-right">Saldo</th>
                        <th className="p-2 text-right w-32">Aplicar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docs.filter((d) => d.tipo_documento === tipoFiltro).map((d) => {
                        const checked = seleccion[d.id] !== undefined;
                        return (
                          <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="p-2">
                              <Checkbox checked={checked} onCheckedChange={(v) => toggleDoc(d, !!v)} />
                            </td>
                            <td className="p-2 font-mono text-xs">{d.numero}</td>
                            <td className="p-2 text-xs">{formatDate(d.fecha_documento)}</td>
                            <td className="p-2 text-right">{formatCurrency(d.total)}</td>
                            <td className="p-2 text-right font-medium">{formatCurrency(d.saldo)}</td>
                            <td className="p-2 text-right">
                              <Input
                                type="number"
                                step="0.01"
                                disabled={!checked}
                                value={seleccion[d.id] ?? ""}
                                onChange={(e) => setSeleccion((p) => ({ ...p, [d.id]: e.target.value }))}
                                className="h-8 text-right"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </div>
          </div>

          <div>
            <Label>Comprobante (PDF / Imágenes)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-4 w-4 mr-2" /> Adjuntar archivos
              </Button>
            </div>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1">
                    <div className="flex items-center gap-2 truncate">
                      {f.type === "application/pdf" ? <FileText className="h-4 w-4 text-muted-foreground" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
                      <span className="truncate">{f.name}</span>
                    </div>
                    <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFile(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Observaciones</Label>
            <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Registrar pago"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

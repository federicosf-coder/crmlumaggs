import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabasePagination";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2 } from "lucide-react";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import { AutosaveIndicator } from "@/components/AutosaveIndicator";
import { CompanyFormDialog } from "@/components/CompanyFormDialog";
import { useQueryClient } from "@tanstack/react-query";

// Convierte a "Nombre Propio": primera letra de cada palabra en mayúscula, resto en minúsculas.
const toProperCase = (s: string): string => {
  if (!s) return s;
  return s
    .toLowerCase()
    .replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
};

export interface ContactEditData {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  email2?: string | null;
  phone: string | null;
  mobile: string | null;
  whatsapp_phone?: string | null;
  tel_emp?: string | null;
  job_title: string | null;
  department: string | null;
  company_id: string | null;
  notes: string | null;
  comm_email?: boolean | null;
  comm_email2?: boolean | null;
  comm_whatsapp?: boolean | null;
  comm_cel?: boolean | null;
  comm_tel?: boolean | null;
  comm_tel_emp?: boolean | null;
  sede?: "mexicali" | "tijuana" | null;
  plaza_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCompanyId?: string;
  defaultEjecutivoIds?: string[];
  editData?: ContactEditData | null;
  onCreated?: (id: string) => void;
  /** Si se está creando desde una empresa nueva aún no guardada, mostrar su nombre y bloquear el selector. */
  pendingCompanyName?: string;
}

// Field map: form key → { label, valueKey, flagKey }
const COMM_FIELDS = [
  { flag: "comm_whatsapp",value: "whatsapp_phone", label: "Whatsapp", phone: true },
  { flag: "comm_email",   value: "email",          label: "Email Principal" },
  { flag: "comm_email2",  value: "email2",         label: "Email 2" },
  { flag: "comm_cel",     value: "mobile",         label: "Cel", phone: true },
  { flag: "comm_tel",     value: "phone",          label: "Tel", phone: true },
  { flag: "comm_tel_emp", value: "tel_emp",        label: "Tel Emp", phone: true },
] as const;

// LADAs mexicanas de 2 dígitos (CDMX, GDL, MTY) → formato +52 LL DDDD DDDD
const TWO_DIGIT_LADAS = new Set(["33", "55", "56", "81"]);

/**
 * Formatea progresivamente un teléfono.
 * - Si el código de país es +52 (México), aplica formato:
 *     LADA 3 dígitos → +52 LLL DDD DDDD
 *     LADA 2 dígitos (33/55/56/81) → +52 LL DDDD DDDD
 * - Para cualquier otro código de país (+1, +34, etc.), sólo respeta el '+' y agrupa dígitos sin formato MX.
 * - Si no hay '+', devuelve sólo dígitos (permite editar libremente).
 * - Sólo conserva '+' inicial y dígitos.
 */
function formatPhoneProgressive(raw: string): string {
  if (!raw) return "+52";
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  let digits = raw.replace(/\D/g, "");
  // Si el usuario no escribió '+', asumimos México y prefijamos 52
  if (!hasPlus) {
    if (!digits) return "+52";
    if (!digits.startsWith("52")) digits = "52" + digits;
  } else if (!digits) {
    return "+";
  }

  // México: si los primeros 2 dígitos son "52"
  if (digits.startsWith("52")) {
    const local = digits.slice(2, 12); // máximo 10 dígitos locales
    if (local.length === 0) return "+52";
    if (local.length < 2) return `+52 ${local}`;
    const lada2 = local.slice(0, 2);
    if (TWO_DIGIT_LADAS.has(lada2)) {
      const rest = local.slice(2);
      const a = rest.slice(0, 4);
      const b = rest.slice(4, 8);
      return `+52 ${lada2}${a ? " " + a : ""}${b ? " " + b : ""}`;
    }
    if (local.length <= 3) return `+52 ${local}`;
    const lada3 = local.slice(0, 3);
    const a = local.slice(3, 6);
    const b = local.slice(6, 10);
    return `+52 ${lada3}${a ? " " + a : ""}${b ? " " + b : ""}`;
  }

  // Otro país: sólo "+CC resto" sin agrupar agresivamente.
  // Tomamos 1-3 dígitos como código de país y mostramos el resto en bloques de 4.
  const cc = digits.slice(0, Math.min(3, digits.length));
  const rest = digits.slice(cc.length);
  if (!rest) return `+${cc}`;
  const groups = rest.match(/.{1,4}/g) || [];
  return `+${cc} ${groups.join(" ")}`;
}

// Devuelve el número de dígitos (sin contar '+').
function phoneDigitCount(v: string): number {
  return (v || "").replace(/\D/g, "").length;
}

export function ContactFormDialog({ open, onOpenChange, defaultCompanyId, defaultEjecutivoIds, editData, onCreated, pendingCompanyName }: Props) {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!editData?.id) return;
    if (!window.confirm(`¿Eliminar definitivamente el contacto "${editData.first_name} ${editData.last_name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    const { error } = await supabase.from("contacts").delete().eq("id", editData.id);
    setDeleting(false);
    if (error) {
      toast.error("No se pudo eliminar: " + error.message);
      return;
    }
    toast.success("Contacto eliminado");
    await queryClient.invalidateQueries();
    onOpenChange(false);
  };
  const [saving, setSaving] = useState(false);
  const isEdit = !!editData;

  // Returns error message string or null if valid.
  function validateComm(f: any): string | null {
    // Regla principal: debe haber Whatsapp con dígitos válidos O Email Principal con valor.
    const wa = (f.whatsapp_phone ?? "").toString();
    const waOk = phoneDigitCount(wa) >= 8;
    const emailOk = !!(f.email ?? "").toString().trim();
    if (!waOk && !emailOk) {
      return "Es obligatorio capturar Whatsapp o Email Principal.";
    }
    // Validaciones suaves para campos opcionales que el usuario haya capturado parcialmente:
    for (const c of COMM_FIELDS) {
      if ((c as any).phone === true) {
        const v = (f[c.value] ?? "").toString();
        const d = phoneDigitCount(v);
        // Si escribió algo más que el prefijo +52, exigir mínimo 8 dígitos
        if (d > 0 && d < 8 && v.replace(/^\+?52$/, "").trim() !== "") {
          return `${c.label} debe tener al menos 8 dígitos.`;
        }
      }
    }
    return null;
  }

  const autosave = useAutosaveStatus(async (changes) => {
    if (!isEdit || !editData?.id) return;
    const merged = { ...form, ...changes } as any;
    const commValidation = validateComm(merged);
    if (commValidation) throw new Error(commValidation);
    const dbPayload: Record<string, any> = {};
    for (const k of Object.keys(changes)) {
      if (k === "ejecutivo_ids" || k === "interes_ids") continue;
      const v = changes[k];
      if (k === "first_name" || k === "last_name") {
        dbPayload[k] = toProperCase((v ?? "").toString());
      } else if (k.startsWith("comm_")) {
        dbPayload[k] = !!v;
      } else {
        dbPayload[k] = v === "" || v == null ? null : v;
      }
    }
    if (Object.keys(dbPayload).length > 0) {
      const { error } = await supabase.from("contacts").update(dbPayload as any).eq("id", editData!.id);
      if (error) throw error;
    }
    if ("ejecutivo_ids" in changes) {
      await supabase.from("contact_ejecutivos").delete().eq("contact_id", editData!.id);
      if ((changes.ejecutivo_ids || []).length > 0) {
        await supabase.from("contact_ejecutivos").insert(
          (changes.ejecutivo_ids as string[]).map((uid) => ({ contact_id: editData!.id, user_id: uid }))
        );
      }
    }
    if ("interes_ids" in changes) {
      await (supabase as any).from("contacto_intereses").delete().eq("contacto_id", editData!.id);
      const ids = (changes.interes_ids as string[]) || [];
      if (ids.length > 0) {
        await (supabase as any).from("contacto_intereses").insert(
          ids.map((iid) => ({ contacto_id: editData!.id, interes_id: iid }))
        );
      }
    }
  });

  const emptyForm = {
    first_name: "", last_name: "",
    email: "", email2: "",
    whatsapp_phone: "+52", mobile: "+52", phone: "+52", tel_emp: "+52",
    job_title: "", department: "", company_id: defaultCompanyId || "", notes: "",
    ejecutivo_ids: (defaultEjecutivoIds ?? []) as string[],
    comm_email: false, comm_email2: false, comm_whatsapp: false,
    comm_cel: false, comm_tel: false, comm_tel_emp: false,
    sede: "" as "" | "mexicali" | "tijuana",
    plaza_id: "",
    interes_ids: [] as string[],
  };

  const [form, setForm] = useState<any>(emptyForm);
  const set = (k: string, v: any) => setForm((prev: any) => ({ ...prev, [k]: v }));
  const setAndSchedule = (k: string, v: string) => { set(k, v); autosave.scheduleSave(k, v); };
  const setAndSaveNow = (k: string, v: string) => { set(k, v); autosave.saveNow(k, v); };
  const setBoolAndSaveNow = (k: string, v: boolean) => {
    setForm((prev: any) => ({ ...prev, [k]: v }));
    autosave.saveNow(k, v);
  };

  const toggleEjecutivo = (userId: string) => {
    setForm((prev: any) => {
      const next = prev.ejecutivo_ids.includes(userId)
        ? prev.ejecutivo_ids.filter((id: string) => id !== userId)
        : [...prev.ejecutivo_ids, userId];
      autosave.saveNow("ejecutivo_ids", next);
      return { ...prev, ejecutivo_ids: next };
    });
  };

  useEffect(() => {
    if (editData) {
      autosave.setEnabled(false);
      const seeded = {
        first_name: editData.first_name || "",
        last_name: editData.last_name || "",
        email: editData.email || "",
        email2: editData.email2 || "",
        whatsapp_phone: formatPhoneProgressive(editData.whatsapp_phone || ""),
        mobile: formatPhoneProgressive(editData.mobile || ""),
        phone: formatPhoneProgressive(editData.phone || ""),
        tel_emp: formatPhoneProgressive(editData.tel_emp || ""),
        job_title: editData.job_title || "",
        department: editData.department || "",
        company_id: editData.company_id || "",
        notes: editData.notes || "",
        ejecutivo_ids: [] as string[],
        comm_email: !!editData.comm_email,
        comm_email2: !!editData.comm_email2,
        comm_whatsapp: !!editData.comm_whatsapp,
        comm_cel: !!editData.comm_cel,
        comm_tel: !!editData.comm_tel,
        comm_tel_emp: !!editData.comm_tel_emp,
        sede: (editData.sede || "") as "" | "mexicali" | "tijuana",
        plaza_id: editData.plaza_id || "",
        interes_ids: [] as string[],
      };
      setForm(seeded);
      autosave.seed(seeded);
      setTimeout(() => autosave.setEnabled(true), 0);
    } else {
      setForm((prev: any) => ({
        ...prev,
        ...(defaultCompanyId ? { company_id: defaultCompanyId } : {}),
        ...(defaultEjecutivoIds && defaultEjecutivoIds.length > 0 && prev.ejecutivo_ids.length === 0
          ? { ejecutivo_ids: defaultEjecutivoIds }
          : {}),
      }));
    }
  }, [editData, defaultCompanyId, defaultEjecutivoIds]);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies_for_contact"],
    queryFn: async () => {
      const all: { id: string; name: string }[] = [];
      const size = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("companies")
          .select("id, name")
          .eq("is_active", true)
          .order("name")
          .range(from, from + size - 1);
        if (error) break;
        const rows = data || [];
        all.push(...rows);
        if (rows.length < size) break;
        from += size;
      }
      return all;
    },
    enabled: open,
  });
  const queryClient = useQueryClient();
  const [openNewCompany, setOpenNewCompany] = useState(false);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_active"],
    queryFn: async () => {
      const data = await fetchAllRows<any>((from, to) => supabase.from("profiles").select("user_id, full_name, email").eq("is_active", true).order("full_name").range(from, to));
      return data;
    },
  });

  const { data: contactEjecutivos = [] } = useQuery({
    queryKey: ["contact_ejecutivos", editData?.id],
    queryFn: async () => {
      if (!editData?.id) return [];
      const { data } = await supabase.from("contact_ejecutivos").select("user_id").eq("contact_id", editData.id);
      return (data || []).map((ce: any) => ce.user_id);
    },
    enabled: !!editData?.id && open,
  });

  const { data: intereses = [] } = useQuery({
    queryKey: ["intereses_giro"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("intereses_giro")
        .select("id,nombre")
        .eq("is_active", true)
        .order("nombre");
      return (data || []) as { id: string; nombre: string }[];
    },
    enabled: open,
  });

  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas_active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plazas")
        .select("id,nombre")
        .eq("is_active", true)
        .order("nombre");
      return (data || []) as { id: string; nombre: string }[];
    },
    enabled: open,
  });

  const { data: contactIntereses = [] } = useQuery({
    queryKey: ["contacto_intereses", editData?.id],
    queryFn: async () => {
      if (!editData?.id) return [];
      const { data } = await (supabase as any)
        .from("contacto_intereses")
        .select("interes_id")
        .eq("contacto_id", editData.id);
      return (data || []).map((ci: any) => ci.interes_id);
    },
    enabled: !!editData?.id && open,
  });

  useEffect(() => {
    if (contactEjecutivos.length > 0 && open && editData?.id) {
      setForm((prev: any) => ({ ...prev, ejecutivo_ids: contactEjecutivos }));
      autosave.seed({ ejecutivo_ids: contactEjecutivos });
    }
  }, [contactEjecutivos, open, editData?.id]);

  useEffect(() => {
    if (open && editData?.id) {
      setForm((prev: any) => ({ ...prev, interes_ids: contactIntereses }));
      autosave.seed({ interes_ids: contactIntereses });
    }
  }, [contactIntereses, open, editData?.id]);

  const reset = () => setForm(emptyForm);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    const commError = validateComm(form);
    if (commError) { toast.error(commError); return; }
    setSaving(true);

    const payload: any = {
      first_name: toProperCase(form.first_name.trim()),
      last_name: toProperCase(form.last_name.trim()),
      email: form.email || null,
      email2: form.email2 || null,
      whatsapp_phone: form.whatsapp_phone || null,
      mobile: form.mobile || null,
      phone: form.phone || null,
      tel_emp: form.tel_emp || null,
      job_title: form.job_title || null,
      department: form.department || null,
      company_id: form.company_id || null,
      notes: form.notes || null,
      comm_email: form.comm_email,
      comm_email2: form.comm_email2,
      comm_whatsapp: form.comm_whatsapp,
      comm_cel: form.comm_cel,
      comm_tel: form.comm_tel,
      comm_tel_emp: form.comm_tel_emp,
      sede: form.sede || null,
      plaza_id: form.plaza_id || null,
    };

    let contactId: string;

    if (isEdit) {
      const { error } = await supabase.from("contacts").update(payload).eq("id", editData!.id);
      if (error) { setSaving(false); toast.error(error.message); return; }
      contactId = editData!.id;
      toast.success("Contacto actualizado");
    } else {
      const { data, error } = await supabase.from("contacts").insert({
        ...payload, created_by: user?.id,
      }).select("id").single();
      if (error) { setSaving(false); toast.error(error.message); return; }
      contactId = data.id;
      toast.success("Contacto creado");
    }

    await supabase.from("contact_ejecutivos").delete().eq("contact_id", contactId);
    if (form.ejecutivo_ids.length > 0) {
      await supabase.from("contact_ejecutivos").insert(
        form.ejecutivo_ids.map((uid: string) => ({ contact_id: contactId, user_id: uid }))
      );
    }

    await (supabase as any).from("contacto_intereses").delete().eq("contacto_id", contactId);
    if (form.interes_ids.length > 0) {
      await (supabase as any).from("contacto_intereses").insert(
        form.interes_ids.map((iid: string) => ({ contacto_id: contactId, interes_id: iid }))
      );
    }

    setSaving(false);
    reset();
    onOpenChange(false);
    onCreated?.(contactId);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>{isEdit ? "Editar Contacto" : "Nuevo Contacto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {isEdit && (
            <div className="px-6 py-2 bg-background/95 backdrop-blur border-b flex items-center gap-2 shrink-0">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
                Cancelar
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <AutosaveIndicator status={autosave.status} />
                {isAdmin && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    {deleting ? "Eliminando..." : "Eliminar"}
                  </Button>
                )}
              </div>
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-6 py-4 space-y-4">
              {/* Identidad */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Nombre *</Label><Input value={form.first_name} onChange={e => setAndSchedule("first_name", toProperCase(e.target.value))} onBlur={e => autosave.saveNow("first_name", toProperCase(e.target.value))} required /></div>
                <div className="space-y-2"><Label>Apellido *</Label><Input value={form.last_name} onChange={e => setAndSchedule("last_name", toProperCase(e.target.value))} onBlur={e => autosave.saveNow("last_name", toProperCase(e.target.value))} required /></div>
                <div className="space-y-2"><Label>Puesto</Label><Input value={form.job_title} onChange={e => setAndSchedule("job_title", e.target.value)} onBlur={e => autosave.saveNow("job_title", e.target.value)} /></div>
                <div className="space-y-2"><Label>Departamento</Label><Input value={form.department} onChange={e => setAndSchedule("department", e.target.value)} onBlur={e => autosave.saveNow("department", e.target.value)} /></div>
              </div>

              {/* Empresa + Ejecutivo de Venta en la misma fila */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  {pendingCompanyName && !editData ? (
                    <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm">
                      <span className="truncate">{pendingCompanyName}</span>
                      <span className="ml-auto text-xs text-muted-foreground">(se vinculará al guardar)</span>
                    </div>
                  ) : (
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <SearchableSelect
                        value={form.company_id}
                        onValueChange={v => setAndSaveNow("company_id", v)}
                        options={companies.map(c => ({ value: c.id, label: c.name }))}
                        placeholder="Seleccionar empresa"
                      />
                    </div>
                    <Button type="button" variant="outline" size="icon" onClick={() => setOpenNewCompany(true)} title="Nueva empresa">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Ejecutivo(s) de Venta</Label>
                  <div className="flex flex-wrap gap-1.5 mb-1.5 min-h-0">
                    {form.ejecutivo_ids.map((uid: string) => {
                      const p = profiles.find((pr: any) => pr.user_id === uid);
                      return p ? (
                        <Badge key={uid} variant="secondary" className="gap-1">
                          {p.full_name || p.email}
                          <X className="h-3 w-3 cursor-pointer" onClick={() => toggleEjecutivo(uid)} />
                        </Badge>
                      ) : null;
                    })}
                  </div>
                  <SearchableSelect
                    value=""
                    onValueChange={v => { if (v && !form.ejecutivo_ids.includes(v)) toggleEjecutivo(v); }}
                    options={profiles.filter((p: any) => !form.ejecutivo_ids.includes(p.user_id)).map((p: any) => ({ value: p.user_id, label: p.full_name || p.email || "Sin nombre" }))}
                    placeholder="Agregar ejecutivo..."
                  />
                </div>
              </div>

              {/* Communication card */}
              <div className="space-y-3 rounded-md border p-3">
                <div>
                  <h4 className="text-sm font-semibold">Comunicación</h4>
                  <p className="text-xs text-muted-foreground">Selecciona los medios preferidos por el cliente (obligatorio Whatsapp y/o Email Principal)</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {COMM_FIELDS.map(c => {
                    const checked = !!form[c.flag];
                    const value = form[c.value] ?? "";
                    const isPhone = (c as any).phone === true;
                    const isRequired = c.value === "whatsapp_phone" || c.value === "email";
                    return (
                      <div key={c.flag} className="space-y-1">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => setBoolAndSaveNow(c.flag, !!v)}
                          />
                          <span className="font-medium">{c.label}</span>
                          {isRequired && <span className="text-destructive">*</span>}
                        </label>
                        <Input
                          type={c.value.startsWith("email") ? "email" : isPhone ? "tel" : "text"}
                          inputMode={isPhone ? "tel" : undefined}
                          value={value}
                          onChange={e => {
                            const next = isPhone ? formatPhoneProgressive(e.target.value) : e.target.value;
                            setAndSchedule(c.value, next);
                          }}
                          onBlur={e => {
                            const next = isPhone ? formatPhoneProgressive(e.target.value) : e.target.value;
                            autosave.saveNow(c.value, next);
                          }}
                          placeholder={isPhone ? "+52..." : c.label}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notas (al fondo) */}
              {/* Plaza + Giros (intereses) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plaza</Label>
                  <Select
                    value={form.plaza_id || ""}
                    onValueChange={(v) => setAndSaveNow("plaza_id", v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccionar plaza" /></SelectTrigger>
                    <SelectContent>
                      {plazas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Giro / Intereses</Label>
                  <div className="flex flex-wrap gap-3 rounded-md border p-3">
                    {intereses.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Sin giros configurados</span>
                    ) : intereses.map((g) => {
                      const checked = form.interes_ids.includes(g.id);
                      return (
                        <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const next = v
                                ? [...form.interes_ids, g.id]
                                : form.interes_ids.filter((id: string) => id !== g.id);
                              setForm((prev: any) => ({ ...prev, interes_ids: next }));
                              autosave.saveNow("interes_ids", next);
                            }}
                          />
                          {g.nombre}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={form.notes}
                  onChange={e => setAndSchedule("notes", e.target.value)}
                  onBlur={e => autosave.saveNow("notes", e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-3 border-t bg-background shrink-0 flex items-center gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Contacto"}
            </Button>
            <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
      <CompanyFormDialog
        open={openNewCompany}
        onOpenChange={setOpenNewCompany}
        onCreated={async (newId) => {
          await queryClient.invalidateQueries({ queryKey: ["companies_for_contact"] });
          setAndSaveNow("company_id", newId);
        }}
      />
    </Dialog>
  );
}

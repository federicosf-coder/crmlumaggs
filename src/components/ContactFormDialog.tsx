import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { X } from "lucide-react";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import { AutosaveIndicator } from "@/components/AutosaveIndicator";

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
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCompanyId?: string;
  editData?: ContactEditData | null;
  onCreated?: (id: string) => void;
}

// Field map: form key → { label, valueKey, flagKey }
const COMM_FIELDS = [
  { flag: "comm_whatsapp",value: "whatsapp_phone", label: "Whatsapp", phone: true },
  { flag: "comm_email",   value: "email",          label: "Email" },
  { flag: "comm_email2",  value: "email2",         label: "Email 2" },
  { flag: "comm_cel",     value: "mobile",         label: "Cel", phone: true },
  { flag: "comm_tel",     value: "phone",          label: "Tel" },
  { flag: "comm_tel_emp", value: "tel_emp",        label: "Tel Emp" },
] as const;

// Lada de 2 dígitos (CDMX y áreas metropolitanas grandes): formato +52 55 1234 5678
const TWO_DIGIT_LADAS = new Set(["33", "55", "56", "81"]);

/**
 * Formatea un teléfono mexicano a +52 LLL DDD DDDD (lada 3 díg) o +52 LL DDDD DDDD (lada 2 díg).
 * Acepta cualquier entrada; conserva sólo dígitos. Si comienza con 52 lo respeta, si no asume +52.
 */
function formatMxPhone(raw: string): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  // Quita el 52 inicial si ya viene incluido
  if (digits.startsWith("52") && digits.length > 10) digits = digits.slice(2);
  digits = digits.slice(0, 10);
  if (digits.length < 2) return `+52 ${digits}`;
  const lada2 = digits.slice(0, 2);
  if (TWO_DIGIT_LADAS.has(lada2)) {
    const rest = digits.slice(2);
    const a = rest.slice(0, 4);
    const b = rest.slice(4, 8);
    return `+52 ${lada2}${a ? " " + a : ""}${b ? " " + b : ""}`.trimEnd();
  }
  // Lada de 3 dígitos
  const lada3 = digits.slice(0, 3);
  if (digits.length <= 3) return `+52 ${lada3}`;
  const a = digits.slice(3, 6);
  const b = digits.slice(6, 10);
  return `+52 ${lada3}${a ? " " + a : ""}${b ? " " + b : ""}`.trimEnd();
}

export function ContactFormDialog({ open, onOpenChange, defaultCompanyId, editData, onCreated }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const isEdit = !!editData;

  // Returns error message string or null if valid.
  function validateComm(f: any): string | null {
    const anyChecked = COMM_FIELDS.some(c => !!f[c.flag]);
    if (!anyChecked) return "Selecciona al menos un canal de comunicación.";
    for (const c of COMM_FIELDS) {
      if (f[c.flag] && !((f[c.value] ?? "") as string).trim()) {
        return `${c.label} es obligatorio cuando está marcado.`;
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
      if (k === "ejecutivo_ids") continue;
      const v = changes[k];
      if (k === "first_name" || k === "last_name") {
        dbPayload[k] = (v ?? "").toString();
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
  });

  const emptyForm = {
    first_name: "", last_name: "",
    email: "", email2: "", whatsapp_phone: "", mobile: "", phone: "", tel_emp: "",
    job_title: "", department: "", company_id: defaultCompanyId || "", notes: "",
    ejecutivo_ids: [] as string[],
    comm_email: false, comm_email2: false, comm_whatsapp: false,
    comm_cel: false, comm_tel: false, comm_tel_emp: false,
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
        whatsapp_phone: editData.whatsapp_phone || "",
        mobile: editData.mobile || "",
        phone: editData.phone || "",
        tel_emp: editData.tel_emp || "",
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
      };
      setForm(seeded);
      autosave.seed(seeded);
      setTimeout(() => autosave.setEnabled(true), 0);
    } else if (defaultCompanyId) {
      setForm((prev: any) => ({ ...prev, company_id: defaultCompanyId }));
    }
  }, [editData, defaultCompanyId]);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies_for_contact"],
    queryFn: async () => { const { data } = await supabase.from("companies").select("id, name").order("name"); return data || []; },
    enabled: open,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_active"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").eq("is_active", true).order("full_name");
      return data || [];
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

  useEffect(() => {
    if (contactEjecutivos.length > 0 && open && editData?.id) {
      setForm((prev: any) => ({ ...prev, ejecutivo_ids: contactEjecutivos }));
      autosave.seed({ ejecutivo_ids: contactEjecutivos });
    }
  }, [contactEjecutivos, open, editData?.id]);

  const reset = () => setForm(emptyForm);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    const commError = validateComm(form);
    if (commError) { toast.error(commError); return; }
    setSaving(true);

    const payload: any = {
      first_name: form.first_name, last_name: form.last_name,
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
            <div className="px-6 py-2 bg-background/95 backdrop-blur border-b flex items-center justify-between gap-3 shrink-0">
              <AutosaveIndicator status={autosave.status} />
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-6 py-4 space-y-4">
              {/* Identidad */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Nombre *</Label><Input value={form.first_name} onChange={e => setAndSchedule("first_name", e.target.value)} onBlur={e => autosave.saveNow("first_name", e.target.value)} required /></div>
                <div className="space-y-2"><Label>Apellido *</Label><Input value={form.last_name} onChange={e => setAndSchedule("last_name", e.target.value)} onBlur={e => autosave.saveNow("last_name", e.target.value)} required /></div>
                <div className="space-y-2"><Label>Puesto</Label><Input value={form.job_title} onChange={e => setAndSchedule("job_title", e.target.value)} onBlur={e => autosave.saveNow("job_title", e.target.value)} /></div>
                <div className="space-y-2"><Label>Departamento</Label><Input value={form.department} onChange={e => setAndSchedule("department", e.target.value)} onBlur={e => autosave.saveNow("department", e.target.value)} /></div>
              </div>

              {/* Empresa + Ejecutivo de Venta en la misma fila */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <SearchableSelect
                    value={form.company_id}
                    onValueChange={v => setAndSaveNow("company_id", v)}
                    options={companies.map(c => ({ value: c.id, label: c.name }))}
                    placeholder="Seleccionar empresa"
                  />
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
                  <p className="text-xs text-muted-foreground">Selecciona al menos uno. Marcado = obligatorio.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {COMM_FIELDS.map(c => {
                    const checked = !!form[c.flag];
                    const value = form[c.value] ?? "";
                    const invalid = checked && !value.trim();
                    const isPhone = (c as any).phone === true;
                    return (
                      <div key={c.flag} className="space-y-1">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => setBoolAndSaveNow(c.flag, !!v)}
                          />
                          <span className="font-medium">{c.label}</span>
                          {checked && <span className="text-destructive">*</span>}
                        </label>
                        <Input
                          type={c.value.startsWith("email") ? "email" : isPhone ? "tel" : "text"}
                          inputMode={isPhone ? "tel" : undefined}
                          value={isPhone ? formatMxPhone(value) : value}
                          onChange={e => {
                            const next = isPhone ? formatMxPhone(e.target.value) : e.target.value;
                            setAndSchedule(c.value, next);
                          }}
                          onBlur={e => {
                            const next = isPhone ? formatMxPhone(e.target.value) : e.target.value;
                            autosave.saveNow(c.value, next);
                          }}
                          required={checked}
                          aria-invalid={invalid}
                          placeholder={isPhone ? "+52 664 123 4567" : c.label}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notas (al fondo) */}
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

          <div className="px-6 py-3 border-t bg-background shrink-0">
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Contacto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

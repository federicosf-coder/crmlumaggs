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
import { X } from "lucide-react";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import { AutosaveIndicator } from "@/components/AutosaveIndicator";

export interface ContactEditData {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  job_title: string | null;
  department: string | null;
  company_id: string | null;
  notes: string | null;
  comm_email?: boolean | null;
  comm_whatsapp?: boolean | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCompanyId?: string;
  editData?: ContactEditData | null;
  onCreated?: (id: string) => void;
}

export function ContactFormDialog({ open, onOpenChange, defaultCompanyId, editData, onCreated }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const isEdit = !!editData;

  const autosave = useAutosaveStatus(async (changes) => {
    if (!isEdit || !editData?.id) return;
    // Validate communication rules before persisting
    const merged = { ...form, ...changes } as any;
    const commValidation = validateComm(merged);
    if (commValidation) throw new Error(commValidation);
    const dbPayload: Record<string, any> = {};
    for (const k of Object.keys(changes)) {
      if (k === "ejecutivo_ids") continue;
      const v = changes[k];
      if (k === "first_name" || k === "last_name") {
        dbPayload[k] = (v ?? "").toString();
      } else if (k === "comm_email" || k === "comm_whatsapp") {
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
    first_name: "", last_name: "", email: "", phone: "", mobile: "",
    job_title: "", department: "", company_id: defaultCompanyId || "", notes: "",
    ejecutivo_ids: [] as string[],
    comm_email: false, comm_whatsapp: false,
  };

  const [form, setForm] = useState(emptyForm);
  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));
  const setAndSchedule = (k: string, v: string) => { set(k, v); autosave.scheduleSave(k, v); };
  const setAndSaveNow = (k: string, v: string) => { set(k, v); autosave.saveNow(k, v); };
  const setBoolAndSaveNow = (k: "comm_email" | "comm_whatsapp", v: boolean) => {
    setForm(prev => ({ ...prev, [k]: v }));
    autosave.saveNow(k, v);
  };

  const toggleEjecutivo = (userId: string) => {
    setForm(prev => {
      const next = prev.ejecutivo_ids.includes(userId)
        ? prev.ejecutivo_ids.filter(id => id !== userId)
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
        phone: editData.phone || "",
        mobile: editData.mobile || "",
        job_title: editData.job_title || "",
        department: editData.department || "",
        company_id: editData.company_id || "",
        notes: editData.notes || "",
        ejecutivo_ids: [] as string[],
        comm_email: !!editData.comm_email,
        comm_whatsapp: !!editData.comm_whatsapp,
      };
      setForm(seeded);
      autosave.seed(seeded);
      setTimeout(() => autosave.setEnabled(true), 0);
    } else if (defaultCompanyId) {
      setForm(prev => ({ ...prev, company_id: defaultCompanyId }));
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
      setForm(prev => ({ ...prev, ejecutivo_ids: contactEjecutivos }));
      autosave.seed({ ejecutivo_ids: contactEjecutivos });
    }
  }, [contactEjecutivos, open, editData?.id]);

  const reset = () => setForm(emptyForm);

  // Returns error message string or null if valid.
  function validateComm(f: { comm_email: boolean; comm_whatsapp: boolean; email: string; mobile: string }): string | null {
    if (!f.comm_email && !f.comm_whatsapp) return "Selecciona al menos un canal de comunicación (Email o WhatsApp).";
    if (f.comm_email && !f.email.trim()) return "El correo es obligatorio cuando Email está marcado.";
    if (f.comm_whatsapp && !f.mobile.trim()) return "El celular/WhatsApp es obligatorio cuando WhatsApp está marcado.";
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    const commError = validateComm(form);
    if (commError) { toast.error(commError); return; }
    setSaving(true);

    const payload = {
      first_name: form.first_name, last_name: form.last_name, email: form.email || null,
      phone: form.phone || null, mobile: form.mobile || null, job_title: form.job_title || null,
      department: form.department || null, company_id: form.company_id || null,
      notes: form.notes || null,
      comm_email: form.comm_email, comm_whatsapp: form.comm_whatsapp,
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

    // Sync contact_ejecutivos
    await supabase.from("contact_ejecutivos").delete().eq("contact_id", contactId);
    if (form.ejecutivo_ids.length > 0) {
      await supabase.from("contact_ejecutivos").insert(
        form.ejecutivo_ids.map(uid => ({ contact_id: contactId, user_id: uid }))
      );
    }

    setSaving(false);
    reset();
    onOpenChange(false);
    onCreated?.(contactId);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? "Editar Contacto" : "Nuevo Contacto"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isEdit && (
            <div className="sticky top-0 z-10 -mx-6 -mt-2 px-6 py-2 bg-background/95 backdrop-blur border-b flex items-center justify-between gap-3">
              <AutosaveIndicator status={autosave.status} />
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Nombre *</Label><Input value={form.first_name} onChange={e => setAndSchedule("first_name", e.target.value)} onBlur={e => autosave.saveNow("first_name", e.target.value)} required /></div>
            <div className="space-y-2"><Label>Apellido *</Label><Input value={form.last_name} onChange={e => setAndSchedule("last_name", e.target.value)} onBlur={e => autosave.saveNow("last_name", e.target.value)} required /></div>
            <div className="space-y-2"><Label>Puesto</Label><Input value={form.job_title} onChange={e => setAndSchedule("job_title", e.target.value)} onBlur={e => autosave.saveNow("job_title", e.target.value)} /></div>
            <div className="space-y-2"><Label>Departamento</Label><Input value={form.department} onChange={e => setAndSchedule("department", e.target.value)} onBlur={e => autosave.saveNow("department", e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <SearchableSelect
                value={form.company_id}
                onValueChange={v => setAndSaveNow("company_id", v)}
                options={companies.map(c => ({ value: c.id, label: c.name }))}
                placeholder="Seleccionar empresa"
              />
            </div>

            {/* Ejecutivo de Venta (multi-select) */}
            <div className="col-span-2 space-y-2">
              <Label>Ejecutivo(s) de Venta</Label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {form.ejecutivo_ids.map(uid => {
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

            <div className="col-span-2 space-y-2"><Label>Notas</Label><Textarea value={form.notes} onChange={e => setAndSchedule("notes", e.target.value)} onBlur={e => autosave.saveNow("notes", e.target.value)} /></div>
          </div>

          {/* Communication section */}
          <div className="space-y-3 rounded-md border p-3">
            <div>
              <h4 className="text-sm font-semibold">Comunicación</h4>
              <p className="text-xs text-muted-foreground">Selecciona al menos un canal. Marcado = obligatorio.</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.comm_email}
                  onCheckedChange={(v) => setBoolAndSaveNow("comm_email", !!v)}
                />
                Email
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.comm_whatsapp}
                  onCheckedChange={(v) => setBoolAndSaveNow("comm_whatsapp", !!v)}
                />
                WhatsApp
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Correo {form.comm_email && <span className="text-destructive">*</span>}</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setAndSchedule("email", e.target.value)}
                  onBlur={e => autosave.saveNow("email", e.target.value)}
                  required={form.comm_email}
                  aria-invalid={form.comm_email && !form.email.trim()}
                />
              </div>
              <div className="space-y-1">
                <Label>Celular / WhatsApp {form.comm_whatsapp && <span className="text-destructive">*</span>}</Label>
                <Input
                  value={form.mobile}
                  onChange={e => setAndSchedule("mobile", e.target.value)}
                  onBlur={e => autosave.saveNow("mobile", e.target.value)}
                  required={form.comm_whatsapp}
                  aria-invalid={form.comm_whatsapp && !form.mobile.trim()}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Teléfono fijo (opcional)</Label>
                <Input value={form.phone} onChange={e => setAndSchedule("phone", e.target.value)} onBlur={e => autosave.saveNow("phone", e.target.value)} />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Contacto"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
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
import { X } from "lucide-react";

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

  const emptyForm = {
    first_name: "", last_name: "", email: "", phone: "", mobile: "",
    job_title: "", department: "", company_id: defaultCompanyId || "", notes: "",
    ejecutivo_ids: [] as string[],
  };

  const [form, setForm] = useState(emptyForm);
  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const toggleEjecutivo = (userId: string) => {
    setForm(prev => ({
      ...prev,
      ejecutivo_ids: prev.ejecutivo_ids.includes(userId)
        ? prev.ejecutivo_ids.filter(id => id !== userId)
        : [...prev.ejecutivo_ids, userId],
    }));
  };

  useEffect(() => {
    if (editData) {
      setForm({
        first_name: editData.first_name || "",
        last_name: editData.last_name || "",
        email: editData.email || "",
        phone: editData.phone || "",
        mobile: editData.mobile || "",
        job_title: editData.job_title || "",
        department: editData.department || "",
        company_id: editData.company_id || "",
        notes: editData.notes || "",
        ejecutivo_ids: [],
      });
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
    }
  }, [contactEjecutivos, open, editData?.id]);

  const reset = () => setForm(emptyForm);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    setSaving(true);

    const payload = {
      first_name: form.first_name, last_name: form.last_name, email: form.email || null,
      phone: form.phone || null, mobile: form.mobile || null, job_title: form.job_title || null,
      department: form.department || null, company_id: form.company_id || null,
      notes: form.notes || null,
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Nombre *</Label><Input value={form.first_name} onChange={e => set("first_name", e.target.value)} required /></div>
            <div className="space-y-2"><Label>Apellido *</Label><Input value={form.last_name} onChange={e => set("last_name", e.target.value)} required /></div>
            <div className="space-y-2"><Label>Correo</Label><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} /></div>
            <div className="space-y-2"><Label>Teléfono</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
            <div className="space-y-2"><Label>Celular</Label><Input value={form.mobile} onChange={e => set("mobile", e.target.value)} /></div>
            <div className="space-y-2"><Label>Puesto</Label><Input value={form.job_title} onChange={e => set("job_title", e.target.value)} /></div>
            <div className="space-y-2"><Label>Departamento</Label><Input value={form.department} onChange={e => set("department", e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <SearchableSelect
                value={form.company_id}
                onValueChange={v => set("company_id", v)}
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

            <div className="col-span-2 space-y-2"><Label>Notas</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Contacto"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
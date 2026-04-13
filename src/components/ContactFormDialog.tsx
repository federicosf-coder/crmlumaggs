import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select a company (e.g. from DocumentForm) */
  defaultCompanyId?: string;
  onCreated?: (id: string) => void;
}

export function ContactFormDialog({ open, onOpenChange, defaultCompanyId, onCreated }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", mobile: "",
    job_title: "", department: "", company_id: defaultCompanyId || "", notes: "",
  });
  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  // Keep company_id in sync when defaultCompanyId changes
  useEffect(() => {
    if (defaultCompanyId) {
      setForm(prev => ({ ...prev, company_id: defaultCompanyId }));
    }
  }, [defaultCompanyId]);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies_for_contact"],
    queryFn: async () => { const { data } = await supabase.from("companies").select("id, name").order("name"); return data || []; },
    enabled: open,
  });

  const reset = () => setForm({ first_name: "", last_name: "", email: "", phone: "", mobile: "", job_title: "", department: "", company_id: defaultCompanyId || "", notes: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("contacts").insert({
      first_name: form.first_name, last_name: form.last_name, email: form.email || null,
      phone: form.phone || null, mobile: form.mobile || null, job_title: form.job_title || null,
      department: form.department || null, company_id: form.company_id || null,
      notes: form.notes || null, created_by: user?.id,
    }).select("id").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contacto creado");
    reset();
    onOpenChange(false);
    onCreated?.(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nuevo Contacto</DialogTitle></DialogHeader>
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
              <Select value={form.company_id} onValueChange={v => set("company_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empresa" /></SelectTrigger>
                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2"><Label>Notas</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Guardando..." : "Crear Contacto"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

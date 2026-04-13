import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function CompanyFormDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", industry: "", website: "", phone: "", email: "",
    address: "", city: "", state: "", zip_code: "", notes: "",
  });
  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const reset = () => setForm({ name: "", industry: "", website: "", phone: "", email: "", address: "", city: "", state: "", zip_code: "", notes: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("companies").insert({
      name: form.name, industry: form.industry || null, website: form.website || null,
      phone: form.phone || null, email: form.email || null, address: form.address || null,
      city: form.city || null, state: form.state || null, zip_code: form.zip_code || null,
      notes: form.notes || null, created_by: user?.id,
    }).select("id").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Empresa creada");
    reset();
    onOpenChange(false);
    onCreated?.(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nueva Empresa</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2"><Label>Nombre de Empresa *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} required /></div>
            <div className="space-y-2"><Label>Industria</Label><Input value={form.industry} onChange={e => set("industry", e.target.value)} /></div>
            <div className="space-y-2"><Label>Sitio Web</Label><Input value={form.website} onChange={e => set("website", e.target.value)} /></div>
            <div className="space-y-2"><Label>Teléfono</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
            <div className="space-y-2"><Label>Correo</Label><Input value={form.email} onChange={e => set("email", e.target.value)} /></div>
            <div className="col-span-2 space-y-2"><Label>Dirección</Label><Input value={form.address} onChange={e => set("address", e.target.value)} /></div>
            <div className="space-y-2"><Label>Ciudad</Label><Input value={form.city} onChange={e => set("city", e.target.value)} /></div>
            <div className="space-y-2"><Label>Estado</Label><Input value={form.state} onChange={e => set("state", e.target.value)} /></div>
            <div className="space-y-2"><Label>Código Postal</Label><Input value={form.zip_code} onChange={e => set("zip_code", e.target.value)} /></div>
            <div className="col-span-2 space-y-2"><Label>Notas</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Guardando..." : "Crear Empresa"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

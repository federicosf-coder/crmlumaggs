import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}

export function RegistrarPagoDialog({ open, onOpenChange, onSaved }: Props) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [plazas, setPlazas] = useState<{ id: string; nombre: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    empresa_id: "",
    plaza_id: "",
    fecha_pago: new Date().toISOString().split("T")[0],
    monto_total: "",
    moneda: "MXN",
    tipo_pago: "transferencia",
    referencia_pago: "",
    banco: "",
    observaciones: "",
  });

  useEffect(() => {
    if (!open) return;
    supabase.from("companies").select("id,name").eq("is_active", true).order("name").then(({ data }) => setCompanies(data || []));
    supabase.from("plazas").select("id,nombre").eq("is_active", true).order("nombre").then(({ data }) => setPlazas(data || []));
  }, [open]);

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.empresa_id) { toast.error("Selecciona la empresa"); return; }
    const monto = Number(form.monto_total);
    if (!monto || monto <= 0) { toast.error("Monto inválido"); return; }
    setSaving(true);
    const { error } = await supabase.from("cobranza_pagos").insert({
      empresa_id: form.empresa_id,
      plaza_id: form.plaza_id || null,
      fecha_pago: form.fecha_pago,
      monto_total: monto,
      monto_disponible: monto,
      moneda: form.moneda,
      tipo_pago: form.tipo_pago || null,
      referencia_pago: form.referencia_pago || null,
      banco: form.banco || null,
      observaciones: form.observaciones || null,
      creado_por: user?.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pago registrado");
    onSaved();
    onOpenChange(false);
    setForm({ ...form, empresa_id: "", monto_total: "", referencia_pago: "", banco: "", observaciones: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Empresa *</Label>
            <SearchableSelect
              value={form.empresa_id}
              onValueChange={(v) => set("empresa_id", v)}
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Buscar empresa..."
            />
          </div>
          <div>
            <Label>Plaza</Label>
            <Select value={form.plaza_id} onValueChange={(v) => set("plaza_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {plazas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fecha de pago *</Label>
            <Input type="date" value={form.fecha_pago} onChange={(e) => set("fecha_pago", e.target.value)} />
          </div>
          <div>
            <Label>Monto total *</Label>
            <Input type="number" step="0.01" value={form.monto_total} onChange={(e) => set("monto_total", e.target.value)} />
          </div>
          <div>
            <Label>Moneda</Label>
            <Select value={form.moneda} onValueChange={(v) => set("moneda", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MXN">MXN</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de pago</Label>
            <Select value={form.tipo_pago} onValueChange={(v) => set("tipo_pago", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="deposito">Depósito</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Banco</Label>
            <Input value={form.banco} onChange={(e) => set("banco", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Referencia</Label>
            <Input value={form.referencia_pago} onChange={(e) => set("referencia_pago", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Observaciones</Label>
            <Textarea value={form.observaciones} onChange={(e) => set("observaciones", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Registrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { roleLabel } from "@/lib/roles";

export default function Profile() {
  const { profile, roles, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [plazaId, setPlazaId] = useState<string>(profile?.plaza_id || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name || "");
    setPhone(profile?.phone || "");
    setPlazaId(profile?.plaza_id || "");
  }, [profile?.user_id]);

  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas-active"],
    queryFn: async () => {
      const { data } = await supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre");
      return data || [];
    },
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone, plaza_id: plazaId || null })
      .eq("user_id", profile!.user_id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil actualizado" });
      await refreshProfile();
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Mi Perfil</h1>
      <Card>
        <CardHeader><CardTitle>Información Personal</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Correo Electrónico</Label>
              <Input value={profile?.email || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre Completo</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plaza">Plaza por Defecto</Label>
              <Select value={plazaId} onValueChange={setPlazaId}>
                <SelectTrigger id="plaza"><SelectValue placeholder="Seleccionar plaza" /></SelectTrigger>
                <SelectContent>
                  {plazas.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Se usará automáticamente al crear cotizaciones, pedidos y facturas.</p>
            </div>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar Cambios"}</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Roles y Equipos</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <Label className="text-muted-foreground">Roles</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {roles.length > 0 ? roles.map((r) => (
                  <Badge key={r}>{roleLabel(r)}</Badge>
                )) : <span className="text-sm text-muted-foreground">Sin roles asignados</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

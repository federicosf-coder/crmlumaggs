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
import { Copy, RefreshCw } from "lucide-react";

export default function Profile() {
  const { profile, roles, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [plazaId, setPlazaId] = useState<string>(profile?.plaza_id || "");
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [uploadToken, setUploadToken] = useState<string>("");
  const [loadingToken, setLoadingToken] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingToken(true);
      const { data, error } = await supabase.rpc("get_or_create_upload_token", { _regenerate: false });
      setLoadingToken(false);
      if (!error && data) setUploadToken(data as string);
    })();
  }, []);

  const handleCopyToken = async () => {
    if (!uploadToken) return;
    await navigator.clipboard.writeText(uploadToken);
    toast({ title: "Token copiado" });
  };

  const handleRegenerateToken = async () => {
    if (!window.confirm("¿Regenerar tu token? El anterior dejará de funcionar.")) return;
    setLoadingToken(true);
    const { data, error } = await supabase.rpc("get_or_create_upload_token", { _regenerate: true });
    setLoadingToken(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setUploadToken((data as string) || "");
    toast({ title: "Token regenerado" });
  };

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "La contraseña debe tener al menos 6 caracteres", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Las contraseñas no coinciden", variant: "destructive" });
      return;
    }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPwd(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contraseña actualizada", description: "Tu contraseña se cambió correctamente." });
      setNewPassword("");
      setConfirmPassword("");
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
      <Card>
        <CardHeader><CardTitle>Carga de comprobantes desde tu celular</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={uploadToken} readOnly className="font-mono" placeholder={loadingToken ? "Cargando..." : ""} />
            <Button type="button" variant="secondary" onClick={handleCopyToken} disabled={!uploadToken}>
              <Copy className="h-4 w-4 mr-1" /> Copiar
            </Button>
          </div>
          <Button type="button" variant="outline" onClick={handleRegenerateToken} disabled={loadingToken}>
            <RefreshCw className="h-4 w-4 mr-1" /> Regenerar token
          </Button>
          <p className="text-xs text-muted-foreground">
            Este código identifica tus comprobantes cuando los envías desde tu celular. Es personal, no lo compartas. Pronto podrás compartir fotos y PDFs directo a la app usando este código.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Cambiar Contraseña</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nueva contraseña</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                minLength={6}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-sm text-destructive">Las contraseñas no coinciden</p>
              )}
            </div>
            <Button type="submit" disabled={savingPwd || !newPassword || newPassword !== confirmPassword}>
              {savingPwd ? "Actualizando..." : "Cambiar Contraseña"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

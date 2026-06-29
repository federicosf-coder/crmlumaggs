import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Download, Eye, Star, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  archivo: any;
  onChanged: () => void;
}

export function ArchivoVersionesDialog({ open, onOpenChange, archivo, onChanged }: Props) {
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole("admin");
  const isManager = hasRole("manager");
  const canManage = isAdmin || isManager || archivo?.created_by === user?.id;
  const [versiones, setVersiones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("biblioteca_versiones" as any)
      .select("*")
      .eq("archivo_id", archivo.id)
      .order("version", { ascending: false });
    setVersiones((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, archivo?.id]);

  const openInline = async (v: any) => {
    const { data, error } = await supabase.storage
      .from("biblioteca")
      .createSignedUrl(v.storage_path, 300);
    if (error || !data?.signedUrl) {
      toast.error("No se pudo generar el enlace");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const download = async (v: any) => {
    const { data, error } = await supabase.storage
      .from("biblioteca")
      .createSignedUrl(v.storage_path, 300);
    if (error || !data?.signedUrl) {
      toast.error("No se pudo generar el enlace");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = v.nombre_archivo;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const setAsCurrent = async (v: any) => {
    const { error } = await supabase
      .from("biblioteca_archivos" as any)
      .update({ current_version_id: v.id })
      .eq("id", archivo.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Versión ${v.version} marcada como vigente`);
    onChanged();
  };

  const deleteVersion = async (v: any) => {
    if (!confirm(`¿Eliminar versión ${v.version}?`)) return;
    if (archivo.current_version_id === v.id) {
      toast.error("No puedes eliminar la versión vigente. Marca otra como vigente primero.");
      return;
    }
    await supabase.storage.from("biblioteca").remove([v.storage_path]);
    const { error } = await supabase.from("biblioteca_versiones" as any).delete().eq("id", v.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Versión eliminada");
    load();
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 bg-gradient-to-r from-violet-50 to-blue-50 border-b">
          <DialogTitle className="text-xl font-light tracking-tight">Sub-archivos / Versiones</DialogTitle>
          <p className="text-sm text-muted-foreground font-light truncate">{archivo?.nombre}</p>
        </DialogHeader>
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : versiones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Sin versiones aún</div>
          ) : (
            <div className="space-y-2">
              {versiones.map((v) => {
                const isCurrent = archivo.current_version_id === v.id;
                return (
                  <div key={v.id} className={`flex items-center gap-3 p-3 border rounded-lg ${isCurrent ? "bg-primary/5 border-primary/30" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">v{v.version}</span>
                        {isCurrent && <Badge variant="default" className="text-[10px]">Vigente</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{v.nombre_archivo}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(v.created_at).toLocaleString("es-MX")} · {v.size_bytes ? `${(v.size_bytes / 1024).toFixed(1)} KB` : ""}
                      </p>
                      {v.notas_cambio && <p className="text-xs italic text-muted-foreground mt-1">"{v.notas_cambio}"</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openInline(v)} title="Ver en el navegador">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => download(v)} title="Descargar">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {canManage && !isCurrent && (
                        <Button size="sm" variant="ghost" onClick={() => setAsCurrent(v)} title="Marcar como vigente">
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {(isAdmin || isManager) && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteVersion(v)} title="Eliminar versión">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter className="px-6 py-3 bg-muted/30 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
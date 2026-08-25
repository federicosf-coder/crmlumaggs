import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Loader2, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";

export default function InstruccionesEspecialesCard({ documentoId }: { documentoId: string }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const [guardando, setGuardando] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["documento-instrucciones", documentoId],
    enabled: !!documentoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("documentos")
        .select("instrucciones_especiales")
        .eq("id", documentoId)
        .maybeSingle();
      if (error) throw error;
      return (data?.instrucciones_especiales as string | null) ?? "";
    },
  });

  useEffect(() => {
    if (typeof data === "string" && !editando) setValor(data);
  }, [data]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const { error } = await (supabase as any)
        .from("documentos")
        .update({ instrucciones_especiales: valor.trim() || null })
        .eq("id", documentoId);
      if (error) throw error;
      toast.success("Instrucciones guardadas");
      setEditando(false);
      refetch();
    } catch (e: any) {
      toast.error(e.message || "No se pudieron guardar las instrucciones");
    } finally {
      setGuardando(false);
    }
  };

  const texto = (data || "").trim();

  return (
    <Card className="mb-4 border-2 border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Instrucciones del pedido
              </p>
              {editando ? (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    rows={3}
                    autoFocus
                    placeholder="Ej. Dividir en dos facturas · Confirmar previo a salida a ruta · Entregar con remisión"
                    className="bg-background"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={guardar} disabled={guardando}>
                      {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setValor(data || "");
                        setEditando(false);
                      }}
                    >
                      <X className="mr-2 h-4 w-4" /> Cancelar
                    </Button>
                  </div>
                </div>
              ) : texto ? (
                <p className="mt-1 whitespace-pre-wrap text-base font-medium leading-snug text-amber-900 dark:text-amber-100">
                  {texto}
                </p>
              ) : (
                <p className="mt-1 text-sm font-light text-amber-800/70 dark:text-amber-200/70">
                  Sin instrucciones especiales. Agrega indicaciones como dividir en dos facturas, confirmar antes de salir a ruta o entregar con remisión.
                </p>
              )}
            </div>
          </div>
          {!editando && (
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setEditando(true)}>
              <Pencil className="mr-2 h-4 w-4" /> {texto ? "Editar" : "Agregar"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

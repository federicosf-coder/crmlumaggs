import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, DollarSign } from "lucide-react";
import { toast } from "sonner";

export function JustificacionPrecioBlock({
  companyId,
  initialValue,
}: {
  companyId: string;
  initialValue?: string | null;
}) {
  const [value, setValue] = useState(initialValue || "");
  const [saved, setSaved] = useState(initialValue || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(initialValue || "");
    setSaved(initialValue || "");
  }, [companyId, initialValue]);

  const guardar = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("companies")
        .update({ justificacion_precio_default: value.trim() || null })
        .eq("id", companyId);
      if (error) throw error;
      setSaved(value);
      toast.success("Justificación de Precio guardada");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
        <DollarSign className="h-3.5 w-3.5" /> Justificación de Precio
      </div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        className="font-light"
        placeholder="Ej. Cliente con alto potencial, volumen anual comprometido..."
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Se usa por default al solicitar autorización de precio; puede ajustarse en cada documento.
        </p>
        <Button size="sm" variant="outline" onClick={guardar} disabled={saving || value === saved}>
          {saving && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
          Guardar
        </Button>
      </div>
    </div>
  );
}

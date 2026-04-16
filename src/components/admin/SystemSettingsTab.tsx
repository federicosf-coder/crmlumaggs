import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Loader2, Save } from "lucide-react";

const SETTINGS = [
  {
    key: "destinatarios_default_contado",
    label: "Destinatarios — Contado",
    description: "Correos por defecto que se autocargan al enviar la solicitud de validación de pagos de Contado.",
  },
  {
    key: "destinatarios_default_credito_directo",
    label: "Destinatarios — Crédito Directo",
    description: "Correos por defecto para validación de pagos de Crédito Directo.",
  },
  {
    key: "destinatarios_default_credito_cescemex",
    label: "Destinatarios — Crédito Cescemex",
    description: "Correos por defecto para validación de pagos de Crédito Cescemex.",
  },
];

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function EmailListEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = (raw?: string) => {
    const v = (raw ?? input).trim().replace(/,$/, "");
    if (!v) return;
    if (!isValidEmail(v)) {
      toast.error("Correo inválido");
      return;
    }
    if (value.includes(v)) {
      setInput("");
      return;
    }
    onChange([...value, v]);
    setInput("");
  };

  const remove = (e: string) => onChange(value.filter((x) => x !== e));

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2 min-h-[28px]">
        {value.map((e) => (
          <Badge key={e} variant="secondary" className="gap-1">
            {e}
            <button
              type="button"
              onClick={() => remove(e)}
              className="hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {value.length === 0 && (
          <span className="text-xs text-muted-foreground">Sin destinatarios configurados</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="correo@ejemplo.com"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === " ") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !input && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => input.trim() && add()}
        />
        <Button type="button" variant="outline" onClick={() => add()}>
          Agregar
        </Button>
      </div>
    </div>
  );
}

export function SystemSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string[]>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("system_settings")
      .select("key,value")
      .in("key", SETTINGS.map((s) => s.key));
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const next: Record<string, string[]> = {};
    SETTINGS.forEach((s) => {
      const row = (data || []).find((d: any) => d.key === s.key);
      const v = row?.value;
      next[s.key] = Array.isArray(v) ? v.filter((x: any) => typeof x === "string") : [];
    });
    setValues(next);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (key: string) => {
    setSaving(key);
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key, value: values[key] || [] }, { onConflict: "key" });
    setSaving(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Guardado");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parámetros del sistema</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : (
          SETTINGS.map((s) => (
            <div key={s.key} className="space-y-2 border-b pb-4 last:border-b-0 last:pb-0">
              <div>
                <Label className="text-base">{s.label}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
              </div>
              <EmailListEditor
                value={values[s.key] || []}
                onChange={(next) => setValues((p) => ({ ...p, [s.key]: next }))}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => save(s.key)}
                  disabled={saving === s.key}
                >
                  {saving === s.key ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Guardar
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

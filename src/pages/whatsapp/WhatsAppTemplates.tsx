import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { RefreshCw, FileBadge, Plus, Send } from "lucide-react";
import {
  compileTemplateBody,
  buildExampleValues,
  extractNamedPlaceholders,
} from "@/lib/whatsappTemplateVars";

type Template = {
  id: string;
  name: string;
  language: string;
  category: string | null;
  status: string;
  body: string | null;
  source_body: string | null;
  variable_map: string[] | null;
  last_synced_at: string | null;
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "APPROVED") return "default";
  if (s === "PENDING" || s === "IN_APPEAL" || s === "PENDING_DELETION") return "secondary";
  if (s === "REJECTED" || s === "DISABLED") return "destructive";
  return "outline";
};

export default function WhatsAppTemplates() {
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("UTILITY");
  const [language, setLanguage] = useState("es_MX");
  const [bodyText, setBodyText] = useState("");

  const placeholders = useMemo(() => extractNamedPlaceholders(bodyText), [bodyText]);
  const compiled = useMemo(() => compileTemplateBody(bodyText), [bodyText]);
  const examples = useMemo(() => buildExampleValues(placeholders), [placeholders]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_templates")
      .select("id,name,language,category,status,body,source_body,variable_map,last_synced_at")
      .order("name", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((data ?? []) as unknown as Template[]);
  };

  useEffect(() => {
    load();
  }, []);

  const sync = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-sync-templates", { body: {} });
    setSyncing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${data?.upserted ?? 0} plantillas sincronizadas`);
    load();
  };

  const resetForm = () => {
    setName("");
    setCategory("UTILITY");
    setLanguage("es_MX");
    setBodyText("");
  };

  const submit = async () => {
    if (!name.trim() || !bodyText.trim()) {
      toast.error("Completa nombre y cuerpo");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-create-template", {
      body: { name, body: bodyText, category, language },
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if ((data as any)?.error) {
      toast.error((data as any).error);
      return;
    }
    toast.success(`Plantilla enviada a Meta (estatus: ${(data as any)?.status ?? "PENDING"})`);
    setOpen(false);
    resetForm();
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileBadge className="h-6 w-6 text-primary" /> Plantillas WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground">
            Solo plantillas APPROVED pueden enviarse. Usa <code>{"{nombre_cliente}"}</code>,{" "}
            <code>{"{folio_cotizacion}"}</code>, etc. — se convierten a <code>{"{{1}}, {{2}}"}</code> al enviarse a Meta.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={sync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar estatus
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nueva plantilla
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Idioma</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Variables</TableHead>
              <TableHead>Cuerpo</TableHead>
              <TableHead>Sincronizada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Cargando…</TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No hay plantillas. Crea una nueva o pulsa "Sincronizar estatus".
                </TableCell>
              </TableRow>
            ) : (
              items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.language}</TableCell>
                  <TableCell>{t.category || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {Array.isArray(t.variable_map) && t.variable_map.length > 0
                      ? t.variable_map.map((v, i) => (
                          <span key={i} className="inline-block mr-1 mb-1 px-1.5 py-0.5 rounded bg-muted">
                            {`{{${i + 1}}}`}={v}
                          </span>
                        ))
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-md truncate text-sm text-muted-foreground">{t.body || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.last_synced_at ? new Date(t.last_synced_at).toLocaleString() : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva plantilla WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1">
                <Label>Nombre</Label>
                <Input
                  placeholder="seguimiento_cotizacion"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Se normalizará a minúsculas y guiones bajos.</p>
              </div>
              <div className="space-y-1">
                <Label>Idioma</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es_MX">es_MX</SelectItem>
                    <SelectItem value="es">es</SelectItem>
                    <SelectItem value="en_US">en_US</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTILITY">UTILITY</SelectItem>
                  <SelectItem value="MARKETING">MARKETING</SelectItem>
                  <SelectItem value="AUTHENTICATION">AUTHENTICATION</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cuerpo</Label>
              <Textarea
                rows={6}
                placeholder="Hola {nombre_cliente}, te compartimos la cotización {folio_cotizacion} por {total_cotizacion}."
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Usa placeholders nombrados entre llaves. Se convertirán automáticamente al formato Meta.
              </p>
            </div>

            {placeholders.length > 0 && (
              <div className="rounded-md border p-3 bg-muted/30 space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Mapa de variables</div>
                <div className="flex flex-wrap gap-1">
                  {placeholders.map((p, i) => (
                    <Badge key={p} variant="secondary">{`{{${i + 1}}}`} = {p}</Badge>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground pt-1">
                  <div className="font-semibold mb-1">Vista enviada a Meta:</div>
                  <pre className="whitespace-pre-wrap font-mono text-xs">{compiled.body}</pre>
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold">Ejemplos generados:</span> {examples.join(" · ")}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={creating}>Cancelar</Button>
            <Button onClick={submit} disabled={creating || !name.trim() || !bodyText.trim()}>
              <Send className="h-4 w-4 mr-2" />
              {creating ? "Enviando…" : "Crear y enviar a Meta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Eye } from "lucide-react";
import { TEMPLATE_LABELS, TEMPLATE_KEYS, renderTemplate, PRINT_STYLES, buildTokens, TemplateKey } from "@/lib/creditoTemplates";

interface Tpl {
  id: string;
  key: TemplateKey;
  entidad: "lumaggs" | "galsa" | "ambas";
  nombre: string;
  contenido_html: string;
  header_html: string | null;
  footer_html: string | null;
  pagina_tamano: string;
  activo: boolean;
}

const ENTIDADES = [
  { value: "lumaggs", label: "Lumaggs (Chevron)" },
  { value: "galsa", label: "Galsa (Phillips 66)" },
  { value: "ambas", label: "Ambas (Lumaggs y Galsa)" },
];

const TOKENS_DISPONIBLES = [
  "razon_social", "nombre_comercial", "rfc", "telefono", "correo",
  "domicilio_fiscal", "ciudad", "estado", "antiguedad", "domicilio_comercial",
  "giro_comercial", "monto_credito", "dias_credito",
  "banco_nombre", "banco_cuenta", "banco_clabe", "datos_bancarios_html", "referencias_comerciales_html",
  "aval_nombre", "aval_direccion", "aval_ciudad", "aval_relacion", "aval_regimen",
  "tipo_persona_label", "rep_legal_nombre", "rep_legal_curp", "rep_legal_rfc",
  "rep_legal_fecha_nac", "rep_legal_pais_nac", "rep_legal_id_tipo", "rep_legal_id_num",
  "fecha_firma", "ciudad_firma", "fecha_constitucion", "municipio", "nacionalidad",
  "bc_nombre", "bc_porcentaje", "empresa_vendedora_nombre_largo",
  "accionistas_html", "escritura_constitutiva", "datos_registro", "ultima_asamblea", "administrador_presidente",
];

export default function CreditoFormatosEditor() {
  const [items, setItems] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Tpl | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<Tpl | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("credit_doc_templates")
      .select("*")
      .order("key", { ascending: true })
      .order("entidad", { ascending: true });
    if (error) toast.error(error.message);
    setItems((data || []) as Tpl[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("credit_doc_templates")
      .update({
        nombre: editing.nombre,
        contenido_html: editing.contenido_html,
        header_html: editing.header_html || "",
        footer_html: editing.footer_html || "",
        entidad: editing.entidad,
        activo: editing.activo,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Formato actualizado");
    setEditing(null);
    load();
  };

  const insertToken = (token: string) => {
    if (!editing) return;
    const insert = `{{${token}}}`;
    setEditing({ ...editing, contenido_html: (editing.contenido_html || "") + insert });
  };

  const previewHtml = useMemo(() => {
    if (!preview) return "";
    // Render with placeholders that are just the token names for visual reference
    const sample: Record<string, string> = {};
    TOKENS_DISPONIBLES.forEach((t) => (sample[t] = `[${t}]`));
    sample["referencias_comerciales_html"] =
      '<table class="grid"><tr><th>Empresa</th><th>Contacto</th><th>Teléfono</th></tr><tr><td>[empresa]</td><td>[contacto]</td><td>[telefono]</td></tr></table>';
    return (preview.header_html || "") + renderTemplate(preview.contenido_html || "", sample) + (preview.footer_html || "");
  }, [preview]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Formatos imprimibles de crédito</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Estos formatos se utilizan al generar el PDF para imprimir y firmar cada documento del expediente.
            Usa tokens entre llaves dobles, por ejemplo <code>{`{{razon_social}}`}</code>.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead className="text-center">Activo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.nombre}</div>
                      <div className="text-xs text-muted-foreground">{TEMPLATE_LABELS[r.key]}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {ENTIDADES.find((e) => e.value === r.entidad)?.label || r.entidad}
                    </TableCell>
                    <TableCell className="text-center text-sm">{r.activo ? "Sí" : "No"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setPreview(r)}>
                        <Eye className="h-4 w-4 mr-1" /> Vista previa
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(r)}>Editar</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sin formatos</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
          <SheetHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -mx-6 -mt-6 px-6 py-5 mb-4 border-b">
            <SheetTitle className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Editar formato
            </SheetTitle>
          </SheetHeader>
          {editing && (
            <div className="space-y-4 font-light">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-wide">Nombre</Label>
                  <Input value={editing.nombre} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide">Entidad</Label>
                  <Select value={editing.entidad} onValueChange={(v) => setEditing({ ...editing, entidad: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ENTIDADES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide">Tokens disponibles (click para insertar)</Label>
                <div className="flex flex-wrap gap-1 mt-2 border rounded-md p-2 bg-muted/30 max-h-32 overflow-y-auto">
                  {TOKENS_DISPONIBLES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="text-[10px] px-2 py-0.5 rounded bg-white border hover:bg-violet-50 hover:border-violet-300 font-mono"
                      onClick={() => insertToken(t)}
                    >{`{{${t}}}`}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide">Contenido (HTML)</Label>
                <Textarea
                  value={editing.contenido_html}
                  onChange={(e) => setEditing({ ...editing, contenido_html: e.target.value })}
                  rows={22}
                  className="font-mono text-xs"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-wide">Encabezado (opcional)</Label>
                  <Textarea
                    value={editing.header_html || ""}
                    onChange={(e) => setEditing({ ...editing, header_html: e.target.value })}
                    rows={4}
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wide">Pie de página (opcional)</Label>
                  <Textarea
                    value={editing.footer_html || ""}
                    onChange={(e) => setEditing({ ...editing, footer_html: e.target.value })}
                    rows={4}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.activo}
                  onChange={(e) => setEditing({ ...editing, activo: e.target.checked })}
                />
                Formato activo
              </label>
            </div>
          )}
          <SheetFooter className="mt-6 bg-muted/30 -mx-6 -mb-6 px-6 py-4 border-t">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button variant="secondary" onClick={() => editing && setPreview(editing)} disabled={saving}>
              <Eye className="h-4 w-4 mr-1" /> Vista previa
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar formato
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto bg-zinc-100">
          <SheetHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -mx-6 -mt-6 px-6 py-5 mb-4 border-b">
            <SheetTitle className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Vista previa: {preview?.nombre}
            </SheetTitle>
          </SheetHeader>
          <style>{PRINT_STYLES}</style>
          <div
            className="bg-white shadow-sm p-8"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
          <p className="text-xs text-muted-foreground mt-4">
            Los tokens se muestran entre corchetes <code>[token]</code> como referencia. En la generación real se reemplazan con los datos del crédito.
          </p>
        </SheetContent>
      </Sheet>
    </div>
  );
}
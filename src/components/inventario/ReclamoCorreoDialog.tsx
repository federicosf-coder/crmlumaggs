import { useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reclamo: any;
  lineas: any[];
  archivos: any[];
  html: string;
  onSent: () => void | Promise<void>;
}

const BUZON = "reclamos@correo.lumaggs.com.mx";
const MAX_BYTES = 35 * 1024 * 1024;
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const uniqueEmails = (emails: string[]) => Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(validEmail)));
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fileKey = (file: any) => String(file.id || file.url_archivo);

function EmailChips({ label, value, onChange, disabled }: { label: string; value: string[]; onChange: (emails: string[]) => void; disabled: boolean }) {
  const [input, setInput] = useState("");
  const add = () => {
    if (!input.trim()) return;
    const emails = input.split(/[,;\s]+/).filter(Boolean);
    if (emails.some((email) => !validEmail(email))) { toast.error("Introduce un correo válido"); return; }
    onChange(uniqueEmails([...value, ...emails]));
    setInput("");
  };
  return <div className="space-y-2">
    <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
    <div className="flex flex-wrap gap-1">
      {value.map((email) => <Badge key={email} variant="secondary" className="max-w-full gap-1">
        <span className="break-all">{email}</span>
        <Button type="button" variant="ghost" size="icon" className="h-5 w-5 shrink-0" aria-label={`Quitar ${email}`} title={`Quitar ${email}`} disabled={disabled} onClick={() => onChange(value.filter((v) => v !== email))}><X className="h-3 w-3" /></Button>
      </Badge>)}
    </div>
    <Input aria-label={`Agregar a ${label}`} placeholder="correo@ejemplo.com" value={input} disabled={disabled} onChange={(e) => setInput(e.target.value)} onBlur={add} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ";" || e.key === ",") { e.preventDefault(); add(); } }} />
  </div>;
}

export function ReclamoCorreoDialog({ open, onOpenChange, reclamo, archivos, html, onSent }: Props) {
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [editedHtml, setEditedHtml] = useState("");
  const [intro, setIntro] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open || !reclamo?.id) return;
    let active = true;
    setLoading(true); setLoadError(""); setSent(false);
    setTo([]); setCc([]); setReplyTo([]); setSizes({});
    setEditedHtml(html); setIntro("");
    setSelected(archivos.map(fileKey));
    const fecha = reclamo.fecha_reclamo ? new Date(`${String(reclamo.fecha_reclamo).slice(0, 10)}T00:00:00`).toLocaleDateString("es-MX") : "";
    setSubject(`Aviso de Reclamo PROBID · ${reclamo.no_pedido_factura || reclamo.inv_pedidos?.numero_po_interno || reclamo.numero_po_interno || ""} · ${fecha} [${reclamo.token_correo || ""}]`);
    (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user?.email) throw new Error("No se pudo obtener el correo del usuario actual");
        const names = ["Reclamos · Para", "Reclamos · CC", `Reclamos · Almacén ${reclamo.plaza}`];
        const { data: groups, error } = await (supabase as any).from("email_groups").select("id,nombre").in("nombre", names).eq("is_active", true);
        if (error) throw error;
        if (names.some((name) => !(groups || []).some((g: any) => g.nombre === name))) throw new Error("No se encontraron todos los grupos de reclamos de esta plaza");
        const { data: members, error: memberError } = await (supabase as any).from("email_group_members").select("group_id,email").in("group_id", groups.map((g: any) => g.id));
        if (memberError) throw memberError;
        const emailsFor = (name: string): string[] => {
          const group = groups.find((g: any) => g.nombre === name);
          return (members || []).filter((m: any) => m.group_id === group?.id).map((m: any) => m.email || "");
        };
        const measured: Record<string, number> = {};
        await Promise.all(archivos.map(async (file) => {
          const { data: blob, error: downloadError } = await supabase.storage.from("inventario-reclamos").download(file.url_archivo);
          if (downloadError || !blob) throw new Error(`No se pudo comprobar ${file.nombre_archivo}`);
          measured[fileKey(file)] = blob.size;
        }));
        if (!active) return;
        setTo(uniqueEmails(emailsFor(names[0])));
        setCc(uniqueEmails([...emailsFor(names[1]), ...emailsFor(names[2]), auth.user.email]));
        setReplyTo(uniqueEmails([auth.user.email, BUZON]));
        setSizes(measured);
      } catch (e: any) { if (active) setLoadError(e.message || "No se pudo preparar el correo"); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [open, reclamo?.id, reclamo?.plaza, html, archivos]);

  const finalHtml = useMemo(() => {
    if (!intro.trim()) return editedHtml;
    const message = `<div style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;margin-bottom:16px">${escapeHtml(intro)}</div>`;
    return /<body\b[^>]*>/i.test(editedHtml) ? editedHtml.replace(/<body\b[^>]*>/i, (tag) => tag + message) : message + editedHtml;
  }, [editedHtml, intro]);
  const totalBytes = selected.reduce((total, key) => total + (sizes[key] || 0), 0);

  const send = async () => {
    if (sending || sent || loading || loadError) return;
    if (!to.length || [...to, ...cc, ...replyTo].some((email) => !validEmail(email))) { toast.error("Revisa los destinatarios"); return; }
    if (!subject.trim() || !finalHtml.trim()) { toast.error("El asunto y el cuerpo son obligatorios"); return; }
    const token = String(reclamo.token_correo || "").trim();
    if (!/^REC-[A-F0-9]{6}$/i.test(token)) { toast.error("Este reclamo no tiene una referencia de correo válida"); return; }
    if (totalBytes > MAX_BYTES) { toast.error("Los adjuntos superan 35 MB"); return; }
    const finalSubject = subject.toUpperCase().includes(token.toUpperCase()) ? subject.trim() : `${subject.trim()} [${token}]`;
    setSubject(finalSubject); setSending(true);
    let deliveryStarted = false;
    let deliveryId: string | null = null;
    let deliveryError: string | null = null;
    let userId: string | null = null;
    const metadata: any[] = [];
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Inicia sesión para enviar el correo");
      userId = auth.user.id;
      const attachments: { filename: string; content: string }[] = [];
      let actualBytes = 0;
      for (const file of archivos.filter((a) => selected.includes(fileKey(a)))) {
        const { data: blob, error } = await supabase.storage.from("inventario-reclamos").download(file.url_archivo);
        if (error || !blob) throw new Error(`No se pudo descargar ${file.nombre_archivo}`);
        actualBytes += blob.size;
        if (actualBytes > MAX_BYTES) throw new Error("Los adjuntos superan 35 MB");
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error("No se pudo leer el adjunto"));
          reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
          reader.readAsDataURL(blob);
        });
        attachments.push({ filename: file.nombre_archivo, content });
        metadata.push({ nombre: file.nombre_archivo, path: file.url_archivo, tipo: file.tipo_archivo || blob.type, tamano: blob.size });
      }
      deliveryStarted = true;
      const { data: result, error } = await supabase.functions.invoke("send-email", { body: {
        from: `Lumaggs Reclamos <${BUZON}>`, to: uniqueEmails(to), cc: uniqueEmails(cc), reply_to: uniqueEmails(replyTo), subject: finalSubject, html: finalHtml, attachments,
      } });
      if (error) {
        const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
        throw new Error(details);
      }
      if (!result?.success || !result?.id) throw new Error(result?.error || "No se confirmó el envío");
      deliveryId = result.id;
      setSent(true);
    } catch (e: any) { deliveryError = e.message || "Error al enviar"; }

    try {
      if (deliveryStarted) {
        const { error } = await (supabase as any).from("inv_reclamo_seguimiento").insert({
          reclamo_id: reclamo.id, direccion: "saliente", tipo: "envio", from_email: BUZON,
          destinatarios: uniqueEmails(to), cc: uniqueEmails(cc), reply_to: uniqueEmails(replyTo), asunto: finalSubject, cuerpo: finalHtml,
          resend_email_id: deliveryId, estatus_envio: deliveryId ? "enviado" : "error", error_mensaje: deliveryError, creado_por: userId, adjuntos: metadata,
        });
        if (error) throw new Error(deliveryId ? "El correo se envió, pero no se pudo guardar el seguimiento. No lo reenvíes." : error.message);
      }
      if (deliveryId && reclamo.estatus === "borrador") {
        const { error } = await (supabase as any).from("inv_reclamos").update({ estatus: "enviado", fecha_envio: new Date().toISOString() }).eq("id", reclamo.id).eq("estatus", "borrador");
        if (error) throw new Error("El correo se envió, pero no se pudo actualizar el estatus. No lo reenvíes.");
      }
      if (deliveryStarted) await onSent();
      if (deliveryError) toast.error(`No se pudo enviar: ${deliveryError}`);
      else { toast.success("Correo enviado al proveedor"); onOpenChange(false); }
    } catch (e: any) { toast.error(e.message); if (deliveryStarted) await onSent(); }
    finally { setSending(false); }
  };

  return <Dialog open={open} onOpenChange={(value) => { if (!sending) onOpenChange(value); }}>
    <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col overflow-hidden p-0">
      <DialogHeader className="shrink-0 border-b bg-gradient-to-r from-violet-50 to-blue-50 px-5 py-4 dark:from-violet-950/30 dark:to-blue-950/30"><DialogTitle className="text-lg font-semibold">Enviar aviso de reclamo</DialogTitle></DialogHeader>
      <div className="flex-1 overflow-y-auto space-y-5 px-5 py-5 font-light">
        {loading && <p className="text-sm text-muted-foreground">Preparando destinatarios y adjuntos…</p>}
        {loadError && <p role="alert" className="text-sm text-destructive">{loadError}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <EmailChips label="Para" value={to} onChange={setTo} disabled={loading || sending || sent} />
          <EmailChips label="CC" value={cc} onChange={setCc} disabled={loading || sending || sent} />
          <div className="sm:col-span-2"><EmailChips label="Responder a" value={replyTo} onChange={setReplyTo} disabled={loading || sending || sent} /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="reclamo-asunto" className="text-xs uppercase text-muted-foreground">Asunto</Label><Input id="reclamo-asunto" value={subject} disabled={sending || sent} onChange={(e) => setSubject(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="reclamo-intro" className="text-xs uppercase text-muted-foreground">Mensaje introductorio</Label><Textarea id="reclamo-intro" value={intro} disabled={sending || sent} onChange={(e) => setIntro(e.target.value)} rows={3} /></div>
        <Tabs defaultValue="preview">
          <TabsList><TabsTrigger value="preview">Vista previa</TabsTrigger><TabsTrigger value="edit">Editar</TabsTrigger></TabsList>
          <TabsContent value="preview"><iframe title="Vista previa del aviso de reclamo" sandbox="" referrerPolicy="no-referrer" srcDoc={finalHtml} className="w-full h-[380px] rounded border bg-background" /></TabsContent>
          <TabsContent value="edit"><Textarea aria-label="HTML del correo" rows={16} value={editedHtml} disabled={sending || sent} onChange={(e) => setEditedHtml(e.target.value)} className="font-mono text-xs" /></TabsContent>
        </Tabs>
        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">Adjuntos</Label>
          {archivos.map((file) => <label key={fileKey(file)} className="flex items-center gap-2 text-sm">
            <Checkbox disabled={loading || sending || sent} checked={selected.includes(fileKey(file))} onCheckedChange={(checked) => setSelected((prev) => checked === true ? [...prev, fileKey(file)] : prev.filter((key) => key !== fileKey(file)))} />
            <span className="min-w-0 flex-1 break-all">{file.nombre_archivo}</span><span className="shrink-0 text-xs text-muted-foreground">{((sizes[fileKey(file)] || 0) / 1024 / 1024).toFixed(2)} MB</span>
          </label>)}
          {!archivos.length && <p className="text-sm text-muted-foreground">Sin adjuntos</p>}
          <p role={totalBytes > MAX_BYTES ? "alert" : undefined} className={`text-sm ${totalBytes > MAX_BYTES ? "text-destructive" : "text-muted-foreground"}`}>Total: {(totalBytes / 1024 / 1024).toFixed(2)} MB / 35 MB</p>
        </div>
      </div>
      <DialogFooter className="shrink-0 border-t bg-muted/30 px-5 py-3"><Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cerrar</Button><Button onClick={send} disabled={loading || sending || sent || !!loadError || !to.length || totalBytes > MAX_BYTES}><Mail className="h-4 w-4 mr-2" />{sending ? "Enviando…" : sent ? "Enviado" : "Enviar"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
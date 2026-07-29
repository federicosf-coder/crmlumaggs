import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import {
  NivelAcceso,
  PasoInput,
  TIPOS_PENDIENTES,
  useCreateAutomatizacionTarea,
  useProfilesList,
} from "@/hooks/useAutomatizacionTareas";

const TIPOS_BASICOS = [
  { value: "enviar_correo", label: "Enviar correo" },
  { value: "enviar_whatsapp", label: "Enviar WhatsApp" },
  { value: "crear_tarea", label: "Crear tarea" },
];

const TIPOS_AVANZADOS = [
  ...TIPOS_BASICOS,
  { value: "generar_documento", label: "Generar documento" },
  { value: "generar_hoja_calculo", label: "Generar hoja de cálculo" },
  { value: "esperar_respuesta", label: "Esperar respuesta" },
  { value: "condicion", label: "Condición" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nivelAcceso: NivelAcceso;
}

const nuevoPaso = (): PasoInput => ({ tipo_paso: "enviar_correo", config: {} });

export function CrearAutomatizacionDialog({ open, onOpenChange, nivelAcceso }: Props) {
  const avanzada = nivelAcceso === "avanzada";
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [triggerType, setTriggerType] = useState<"manual" | "programado">("manual");
  const [frecuencia, setFrecuencia] = useState("diario");
  const [hora, setHora] = useState("09:00");
  const [requiereAprobacion, setRequiereAprobacion] = useState(true);
  const [usuarios, setUsuarios] = useState<string[]>([]);
  const [pasos, setPasos] = useState<PasoInput[]>([nuevoPaso()]);

  const { data: profiles = [] } = useProfilesList();
  const create = useCreateAutomatizacionTarea();

  const reset = () => {
    setNombre(""); setDescripcion(""); setTriggerType("manual");
    setFrecuencia("diario"); setHora("09:00"); setRequiereAprobacion(true);
    setUsuarios([]); setPasos([nuevoPaso()]);
  };

  const setPaso = (i: number, patch: Partial<PasoInput>) =>
    setPasos((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const setConfig = (i: number, key: string, value: any) =>
    setPasos((prev) => prev.map((p, idx) => (idx === i ? { ...p, config: { ...p.config, [key]: value } } : p)));

  const handleSubmit = async () => {
    if (!nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    try {
      await create.mutateAsync({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        nivel_acceso: nivelAcceso,
        trigger_type: triggerType,
        trigger_config: triggerType === "programado" ? { frecuencia, hora } : {},
        requiere_aprobacion: requiereAprobacion,
        usuarios,
        pasos,
      });
      toast.success("Automatización creada");
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "No se pudo crear la automatización");
    }
  };

  const tipos = avanzada ? TIPOS_AVANZADOS : TIPOS_BASICOS;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b shrink-0 text-left">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            {avanzada ? "Nueva automatización avanzada" : "Nueva automatización"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-light">
            Configura el disparador, los accesos y los pasos a ejecutar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 py-5 overflow-y-auto flex-1">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nombre *</Label>
            <Input className="h-9 font-light" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Recordatorio semanal de cobranza" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Descripción</Label>
            <Textarea className="font-light" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Disparador</Label>
              <Select value={triggerType} onValueChange={(v) => setTriggerType(v as any)}>
                <SelectTrigger className="h-9 font-light"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="programado">Programado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {triggerType === "programado" && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Frecuencia</Label>
                  <Select value={frecuencia} onValueChange={setFrecuencia}>
                    <SelectTrigger className="h-9 font-light"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diario">Diario</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="mensual">Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Hora</Label>
                  <Input type="time" className="h-9 font-light" value={hora} onChange={(e) => setHora(e.target.value)} />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm">Requiere aprobación antes de ejecutar</p>
              <p className="text-xs text-muted-foreground font-light">Cada ejecución quedará pendiente de aprobación.</p>
            </div>
            <Switch checked={requiereAprobacion} onCheckedChange={setRequiereAprobacion} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Usuarios con acceso</Label>
            <ScrollArea className="h-40 rounded-md border p-2">
              <div className="space-y-1">
                {profiles.map((p: any) => (
                  <label key={p.user_id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50 cursor-pointer">
                    <Checkbox
                      checked={usuarios.includes(p.user_id)}
                      onCheckedChange={(c) =>
                        setUsuarios((prev) => (c ? [...prev, p.user_id] : prev.filter((u) => u !== p.user_id)))
                      }
                    />
                    <span className="text-sm font-light">{p.full_name || p.email}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
            <p className="text-xs text-muted-foreground font-light">Tú quedarás registrado automáticamente como dueño.</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Pasos</Label>
              {avanzada && (
                <Button type="button" size="sm" variant="outline" onClick={() => setPasos((p) => [...p, nuevoPaso()])}>
                  <Plus className="h-4 w-4 mr-1" /> Agregar paso
                </Button>
              )}
            </div>

            {pasos.map((paso, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-14">Paso {i + 1}</span>
                  <Select value={paso.tipo_paso} onValueChange={(v) => setPaso(i, { tipo_paso: v, config: {} })}>
                    <SelectTrigger className="h-9 font-light"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tipos.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {avanzada && pasos.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" onClick={() => setPasos((p) => p.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                {paso.tipo_paso === "enviar_correo" && (
                  <div className="space-y-2">
                    <Input className="h-9 font-light" type="email" placeholder="Destinatario" value={paso.config.destinatario || ""} onChange={(e) => setConfig(i, "destinatario", e.target.value)} />
                    <Input className="h-9 font-light" placeholder="Asunto" value={paso.config.asunto || ""} onChange={(e) => setConfig(i, "asunto", e.target.value)} />
                    <Textarea className="font-light" rows={3} placeholder="Cuerpo del correo" value={paso.config.cuerpo || ""} onChange={(e) => setConfig(i, "cuerpo", e.target.value)} />
                  </div>
                )}

                {paso.tipo_paso === "enviar_whatsapp" && (
                  <div className="space-y-2">
                    <Input className="h-9 font-light" placeholder="Teléfono destino" value={paso.config.telefono || ""} onChange={(e) => setConfig(i, "telefono", e.target.value)} />
                    <Textarea className="font-light" rows={3} placeholder="Mensaje" value={paso.config.mensaje || ""} onChange={(e) => setConfig(i, "mensaje", e.target.value)} />
                  </div>
                )}

                {paso.tipo_paso === "crear_tarea" && (
                  <div className="space-y-2">
                    <Input className="h-9 font-light" placeholder="Título" value={paso.config.titulo || ""} onChange={(e) => setConfig(i, "titulo", e.target.value)} />
                    <Textarea className="font-light" rows={2} placeholder="Descripción" value={paso.config.descripcion || ""} onChange={(e) => setConfig(i, "descripcion", e.target.value)} />
                    <Input className="h-9 font-light" type="number" min={0} placeholder="Días para vencimiento" value={paso.config.dias_vencimiento ?? ""} onChange={(e) => setConfig(i, "dias_vencimiento", Number(e.target.value))} />
                  </div>
                )}

                {TIPOS_PENDIENTES.includes(paso.tipo_paso) && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-amber-900 dark:text-amber-200">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    <p className="text-xs font-light">
                      Este tipo de paso se implementará próximamente. Se registrará una solicitud de función al guardar.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t bg-muted/30 px-5 py-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? "Guardando..." : "Guardar automatización"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Play, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CrearAutomatizacionDialog } from "@/components/automatizacion-tareas/CrearAutomatizacionDialog";
import {
  AutomatizacionTarea, NivelAcceso, useAutomatizacionesTareas, useDeleteAutomatizacionTarea,
  useEjecutarAutomatizacionTarea, useIsAutomatizacionConstructor, useToggleAutomatizacionTarea,
} from "@/hooks/useAutomatizacionTareas";

export default function AutomatizacionTareasLanding() {
  const { data: automatizaciones = [], isLoading } = useAutomatizacionesTareas();
  const { isConstructor } = useIsAutomatizacionConstructor();
  const toggle = useToggleAutomatizacionTarea();
  const del = useDeleteAutomatizacionTarea();
  const ejecutar = useEjecutarAutomatizacionTarea();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [nivel, setNivel] = useState<NivelAcceso>("basica");
  const [toDelete, setToDelete] = useState<AutomatizacionTarea | null>(null);

  const abrir = (n: NivelAcceso) => { setNivel(n); setDialogOpen(true); };

  const handleEjecutar = async (a: AutomatizacionTarea) => {
    try {
      await ejecutar.mutateAsync(a);
      toast.success("Ejecución registrada, el motor la procesará próximamente");
    } catch (e: any) {
      toast.error(e.message || "No se pudo registrar la ejecución");
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success("Automatización eliminada");
    } catch (e: any) {
      toast.error(e.message || "No se pudo eliminar");
    } finally {
      setToDelete(null);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <PageBanner
        title="Automatización de Tareas"
        description="Crea flujos que envían correos, WhatsApp y generan tareas de forma manual o programada."
      >
        <div className="flex flex-wrap gap-2">
          {isConstructor && (
            <Button variant="outline" onClick={() => abrir("avanzada")}>
              <Sparkles className="h-4 w-4 mr-1" /> Automatización avanzada
            </Button>
          )}
          <Button onClick={() => abrir("basica")}>
            <Plus className="h-4 w-4 mr-1" /> Nueva automatización
          </Button>
        </div>
      </PageBanner>

      <div className="rounded-xl border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30">
              <TableHead className="text-xs uppercase tracking-wide">Nombre</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Disparador</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Estado</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Nivel</TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-light">Cargando...</TableCell></TableRow>
            )}
            {!isLoading && automatizaciones.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-light">Aún no hay automatizaciones.</TableCell></TableRow>
            )}
            {automatizaciones.map((a) => (
              <TableRow key={a.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20">
                <TableCell>
                  <div className="font-medium">{a.nombre}</div>
                  {a.descripcion && <div className="text-xs text-muted-foreground font-light">{a.descripcion}</div>}
                </TableCell>
                <TableCell>
                  <Badge variant={a.trigger_type === "manual" ? "secondary" : "outline"}>
                    {a.trigger_type === "manual" ? "Manual" : "Programado"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={a.activo}
                    onCheckedChange={(v) => toggle.mutate({ id: a.id, activo: v })}
                  />
                </TableCell>
                <TableCell>
                  <Badge variant={a.nivel_acceso === "avanzada" ? "default" : "outline"}>
                    {a.nivel_acceso === "avanzada" ? "Avanzada" : "Básica"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {a.trigger_type === "manual" && (
                      <Button size="icon" variant="ghost" title="Ejecutar ahora" onClick={() => handleEjecutar(a)}>
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" title="Eliminar" onClick={() => setToDelete(a)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CrearAutomatizacionDialog open={dialogOpen} onOpenChange={setDialogOpen} nivelAcceso={nivel} />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar automatización?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{toDelete?.nombre}" junto con sus pasos y accesos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

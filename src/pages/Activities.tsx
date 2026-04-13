import { useState } from "react";
import { useCrmActivities } from "@/hooks/useCrmActivities";
import { CrmActivityItem } from "@/components/crm/CrmActivityItem";
import { LogCrmActivityDialog } from "@/components/crm/LogCrmActivityDialog";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Activity as ActivityIcon } from "lucide-react";

export default function Activities() {
  const [typeFilter, setTypeFilter] = useState<string>("");
  const { data: activities, isLoading } = useCrmActivities(typeFilter ? { type: typeFilter } : undefined);
  const [logOpen, setLogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageBanner title="Actividades" description="Registra y da seguimiento a llamadas, correos y reuniones.">
        <Button onClick={() => setLogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Registrar Actividad
        </Button>
      </PageBanner>

      <div className="flex gap-3">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Todos los tipos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="call">📞 Llamadas</SelectItem>
            <SelectItem value="email">📧 Emails</SelectItem>
            <SelectItem value="meeting">📅 Reuniones</SelectItem>
            <SelectItem value="note">📝 Notas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : !activities?.length ? (
        <div className="flex flex-col items-center py-16">
          <ActivityIcon className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold text-lg">Sin actividades</h3>
          <p className="text-muted-foreground text-sm mb-4">Comienza registrando llamadas, emails y reuniones.</p>
          <Button variant="secondary" onClick={() => setLogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Registrar actividad
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((a) => (
            <CrmActivityItem key={a.id} activity={a} />
          ))}
        </div>
      )}

      <LogCrmActivityDialog open={logOpen} onOpenChange={setLogOpen} />
    </div>
  );
}

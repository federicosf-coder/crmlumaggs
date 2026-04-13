import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateCrmActivity } from "@/hooks/useCrmActivities";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface LogCrmActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDealId?: string;
  defaultContactId?: string;
}

export function LogCrmActivityDialog({ open, onOpenChange, defaultDealId, defaultContactId }: LogCrmActivityDialogProps) {
  const { session } = useAuth();
  const createActivity = useCreateCrmActivity();
  const { toast } = useToast();

  const [type, setType] = useState<"call" | "email" | "meeting" | "note">("note");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;

    createActivity.mutate(
      {
        user_id: session.user.id,
        type,
        title,
        description: description || null,
        deal_id: defaultDealId || null,
        contact_id: defaultContactId || null,
      },
      {
        onSuccess: () => {
          toast({ title: "Actividad registrada" });
          onOpenChange(false);
          setTitle(""); setDescription(""); setType("note");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Actividad</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="call">📞 Llamada</SelectItem>
                <SelectItem value="email">📧 Email</SelectItem>
                <SelectItem value="meeting">📅 Reunión</SelectItem>
                <SelectItem value="note">📝 Nota</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Llamada de seguimiento" required />
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createActivity.isPending}>
              {createActivity.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

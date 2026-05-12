import { useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircleQuestion, Send, X, Bug, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"bug" | "suggestion">("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user, profile } = useAuth();
  const location = useLocation();

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  const userName = profile?.full_name || user?.email || "Usuario anónimo";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("El título es obligatorio");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("user_feedback").insert({
        user_id: user?.id || null,
        user_name: userName,
        feedback_type: feedbackType,
        title: title.trim(),
        description: description.trim() || null,
        page_url: pageUrl,
      });

      if (error) throw error;

      toast.success("¡Gracias! Tu reporte nos ayuda a mejorar LubriManager");
      setTitle("");
      setDescription("");
      setFeedbackType("bug");
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "No se pudo enviar el reporte");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setTitle("");
      setDescription("");
      setFeedbackType("bug");
    }
  };

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setOpen(true)}
              className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary/80 text-primary-foreground shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-primary hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="Reportar problema o sugerencia"
            >
              <MessageCircleQuestion className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="left"
            sideOffset={8}
            className="bg-popover text-popover-foreground"
          >
            <p className="text-sm font-medium">¿Reportar problema o sugerencia?</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {feedbackType === "bug" ? (
                <Bug className="h-5 w-5 text-destructive" />
              ) : (
                <Lightbulb className="h-5 w-5 text-warning" />
              )}
              {feedbackType === "bug"
                ? "Reportar Problema Técnico"
                : "Sugerir Mejora"}
            </DialogTitle>
            <DialogDescription>
              Ayúdanos a mejorar LubriManager con tu retroalimentación.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feedback-type">Tipo</Label>
              <Select
                value={feedbackType}
                onValueChange={(v) => setFeedbackType(v as "bug" | "suggestion")}
              >
                <SelectTrigger id="feedback-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">
                    <span className="flex items-center gap-2">
                      <Bug className="h-4 w-4 text-destructive" />
                      Problema Técnico (Bug)
                    </span>
                  </SelectItem>
                  <SelectItem value="suggestion">
                    <span className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-warning" />
                      Sugerencia de Mejora
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-title">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id="feedback-title"
                placeholder="Resume brevemente el tema..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-description">Descripción</Label>
              <Textarea
                id="feedback-description"
                placeholder="Describe el detalle del problema o tu idea de mejora..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={2000}
              />
            </div>

            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-1">
              <div>
                <span className="font-medium">Usuario:</span> {userName}
              </div>
              <div className="truncate">
                <span className="font-medium">Página:</span>{" "}
                <span className="font-mono">{pageUrl}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                <X className="mr-1 h-4 w-4" />
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                <Send className="mr-1 h-4 w-4" />
                {submitting ? "Enviando..." : "Enviar reporte"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

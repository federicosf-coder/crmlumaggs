import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, FileText, X, Check } from "lucide-react";
import { toast } from "sonner";
import { TEMPLATE_ATTACHMENTS_BUCKET } from "@/lib/templates";
import {
  TEMPLATE_DOCUMENT_CATALOG_BUCKET,
  downloadCatalogBlob,
  listTemplateDocumentCatalog,
  type TemplateCatalogDocument,
} from "@/lib/templateDocumentCatalog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  templateId: string;
  onAttached: () => void;
}

export function SelectCatalogDocumentDialog({ open, onOpenChange, templateId, onAttached }: Props) {
  const { user } = useAuth();
  const [filter, setFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const { data: items = [], isLoading } = useQuery<TemplateCatalogDocument[]>({
    queryKey: ["template-document-catalog", "active"],
    queryFn: () => listTemplateDocumentCatalog(true),
    enabled: open,
  });

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      it.name.toLowerCase().includes(q) ||
      (it.description || "").toLowerCase().includes(q) ||
      it.file_name.toLowerCase().includes(q)
    );
  }, [items, filter]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleAttach = async () => {
    if (!user) return;
    const chosen = items.filter((it) => selectedIds.has(it.id));
    if (chosen.length === 0) { toast.error("Selecciona al menos un documento"); return; }
    setBusy(true);
    try {
      let ok = 0;
      for (const it of chosen) {
        try {
          const blob = await downloadCatalogBlob(it.file_path);
          const ext = it.file_name.split(".").pop()?.toLowerCase() || "bin";
          const key = `${templateId}/${crypto.randomUUID()}.${ext}`;
          const up = await supabase.storage.from(TEMPLATE_ATTACHMENTS_BUCKET).upload(key, blob, {
            contentType: it.mime_type, upsert: false,
          });
          if (up.error) { toast.error(`Error subiendo ${it.file_name}: ${up.error.message}`); continue; }
          const ins = await (supabase as any).from("template_attachments").insert({
            template_id: templateId,
            file_name: it.file_name,
            file_path: key,
            mime_type: it.mime_type,
            file_size: it.file_size,
            uploaded_by: user.id,
          });
          if (ins.error) {
            toast.error(`Error registrando ${it.file_name}: ${ins.error.message}`);
            await supabase.storage.from(TEMPLATE_ATTACHMENTS_BUCKET).remove([key]);
            continue;
          }
          ok += 1;
        } catch (e: any) {
          toast.error(`Error con ${it.file_name}: ${e?.message || e}`);
        }
      }
      if (ok > 0) {
        toast.success(`${ok} documento(s) adjuntados desde el catálogo`);
        onAttached();
        onOpenChange(false);
        setSelectedIds(new Set());
      }
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-violet-50 to-blue-50 border-b">
          <DialogTitle className="font-light">Seleccionar del Catálogo de Documentos</DialogTitle>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
            Elige uno o varios documentos del catálogo para adjuntarlos a esta plantilla.
          </p>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar documento..." className="pl-8 h-9" />
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded border">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Cargando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Sin documentos. Agrega documentos en Catálogos → Documentos para Plantillas.
              </div>
            ) : (
              <ul className="divide-y">
                {filtered.map((it) => {
                  const sel = selectedIds.has(it.id);
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => toggle(it.id)}
                        className={"w-full flex items-start gap-3 text-left px-3 py-2.5 hover:bg-blue-50/40 " + (sel ? "bg-blue-50" : "")}
                      >
                        <div className={"mt-0.5 h-5 w-5 rounded border flex items-center justify-center " + (sel ? "bg-primary text-primary-foreground border-primary" : "bg-background")}>
                          {sel && <Check className="h-3.5 w-3.5" />}
                        </div>
                        <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{it.name}</div>
                          {it.description && <div className="text-xs text-muted-foreground truncate">{it.description}</div>}
                          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{it.file_name} · {it.mime_type}</div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-muted/40">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button onClick={handleAttach} disabled={busy || selectedIds.size === 0}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
            Adjuntar {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
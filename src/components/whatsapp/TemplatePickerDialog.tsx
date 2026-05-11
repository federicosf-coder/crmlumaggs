import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Search, ArrowUpDown, Check } from "lucide-react";
import { renderTemplate } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export type WaPickerTemplate = {
  id: string;
  name: string;
  language?: string | null;
  category?: string | null;
  status?: string | null;
  body?: string | null;
};

export function TemplatePickerDialog({
  open, onOpenChange, templates, selectedId, onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  templates: WaPickerTemplate[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "status" | "language" | "category">("name");
  const [activeId, setActiveId] = useState<string>(selectedId || "");

  useEffect(() => {
    if (open) setActiveId(selectedId || "");
  }, [open, selectedId]);

  const statuses = Array.from(new Set(templates.map((t) => t.status).filter(Boolean))) as string[];
  const languages = Array.from(new Set(templates.map((t) => t.language).filter(Boolean))) as string[];
  const categories = Array.from(new Set(templates.map((t) => t.category).filter(Boolean))) as string[];

  const filtered = templates
    .filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (langFilter !== "all" && t.language !== langFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${t.name || ""} ${t.body || ""} ${t.category || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const av = ((a as any)[sortBy] || "").toString().toLowerCase();
      const bv = ((b as any)[sortBy] || "").toString().toLowerCase();
      return av.localeCompare(bv);
    });

  const active = templates.find((t) => t.id === activeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Seleccionar plantilla de WhatsApp
          </DialogTitle>
          <DialogDescription>
            Busca, filtra y ordena. Selecciona una plantilla para ver su previsualización.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-0 border-t">
          <div className="flex flex-col border-r min-h-[480px]">
            <div className="p-3 space-y-2 border-b bg-muted/30">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, contenido o categoría..." className="pl-8 h-9" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={langFilter} onValueChange={setLangFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Idioma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los idiomas</SelectItem>
                    {languages.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger className="h-8 text-xs"><ArrowUpDown className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Ordenar: Nombre</SelectItem>
                    <SelectItem value="status">Ordenar: Estado</SelectItem>
                    <SelectItem value="language">Ordenar: Idioma</SelectItem>
                    <SelectItem value="category">Ordenar: Categoría</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground">
                {filtered.length} de {templates.length} plantillas
              </div>
            </div>

            <ScrollArea className="flex-1 max-h-[420px]">
              <ul className="divide-y">
                {filtered.map((t) => {
                  const isActive = t.id === activeId;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(t.id)}
                        onDoubleClick={() => onSelect(t.id)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-start gap-2",
                          isActive && "bg-primary/10 hover:bg-primary/15"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate flex items-center gap-1.5">
                            {isActive && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                            <span className="truncate">{t.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {(t.body || "").slice(0, 80)}{(t.body || "").length > 80 ? "…" : ""}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {t.status && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t.status}</Badge>}
                            {t.language && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{t.language}</Badge>}
                            {t.category && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t.category}</Badge>}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
                {filtered.length === 0 && (
                  <li className="px-3 py-8 text-center text-sm text-muted-foreground">Sin resultados</li>
                )}
              </ul>
            </ScrollArea>
          </div>

          <div className="flex flex-col bg-muted/20 min-h-[480px]">
            <div className="p-3 border-b bg-background">
              <div className="text-xs text-muted-foreground">Previsualización</div>
              <div className="text-sm font-medium truncate">
                {active?.name || "Selecciona una plantilla"}
              </div>
              {active && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {active.status && <Badge variant="outline" className="text-[10px]">{active.status}</Badge>}
                  {active.language && <Badge variant="secondary" className="text-[10px]">{active.language}</Badge>}
                  {active.category && <Badge variant="outline" className="text-[10px]">{active.category}</Badge>}
                </div>
              )}
            </div>
            <ScrollArea className="flex-1 max-h-[420px]">
              <div className="p-4">
                {active ? (
                  <div className="rounded-lg bg-[#dcf8c6] dark:bg-emerald-900/40 text-foreground p-3 text-sm whitespace-pre-wrap shadow-sm max-w-md">
                    {renderTemplate(active.body || "", {
                      contacto_nombre: "[Nombre del contacto]",
                      empresa_nombre: "[Empresa]",
                      empresa_vendedora: "[Empresa vendedora]",
                      folio_cotizacion: "[Folio]",
                      total_cotizacion: "[Total]",
                      fecha_vencimiento: "[Fecha]",
                      ejecutivo_nombre: "[Ejecutivo]",
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-12">
                    Selecciona una plantilla del lado izquierdo para previsualizar.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!activeId} onClick={() => onSelect(activeId)}>
            <Check className="h-4 w-4 mr-1" /> Usar esta plantilla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

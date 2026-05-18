import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Search, Upload, FileText, Folder, DollarSign, FileSignature,
  Megaphone, BookOpen, Download, History, Trash2, Pencil, Plus,
} from "lucide-react";
import { ArchivoFormDialog } from "@/components/biblioteca/ArchivoFormDialog";
import { ArchivoVersionesDialog } from "@/components/biblioteca/ArchivoVersionesDialog";
import { CategoriasManagerDialog } from "@/components/biblioteca/CategoriasManagerDialog";

type Categoria = {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string | null;
  icono: string | null;
  orden: number | null;
  solo_admin: boolean;
};

type Archivo = {
  id: string;
  categoria_id: string | null;
  nombre: string;
  descripcion: string | null;
  marca: string;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  etiquetas: string[] | null;
  estado: string;
  current_version_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const ICONS: Record<string, any> = {
  DollarSign, FileText, FileSignature, Megaphone, BookOpen, Folder,
};

const MARCA_LABEL: Record<string, string> = {
  chevron: "Chevron",
  phillips66: "Phillips 66",
  ambas: "Ambas",
  na: "N/A",
};

const ESTADO_COLOR: Record<string, string> = {
  vigente: "bg-green-100 text-green-700 border-green-200",
  obsoleto: "bg-amber-100 text-amber-700 border-amber-200",
  archivado: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function Biblioteca() {
  const { user, hasRole } = useAuth();
  const access = useModuleAccess("biblioteca");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Archivo | null>(null);
  const [versionesOf, setVersionesOf] = useState<Archivo | null>(null);
  const [catsManagerOpen, setCatsManagerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const isAdmin = hasRole("admin");
  const isManager = hasRole("manager");

  const load = async () => {
    setLoading(true);
    const [{ data: cats }, { data: archs }] = await Promise.all([
      supabase.from("biblioteca_categorias" as any).select("*").order("orden", { ascending: true }),
      supabase.from("biblioteca_archivos" as any).select("*").order("updated_at", { ascending: false }),
    ]);
    setCategorias((cats as any) || []);
    setArchivos((archs as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return archivos.filter((a) => {
      if (selectedCat && a.categoria_id !== selectedCat) return false;
      if (estadoFilter !== "todos" && a.estado !== estadoFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const inName = a.nombre.toLowerCase().includes(s);
        const inDesc = (a.descripcion || "").toLowerCase().includes(s);
        const inTags = (a.etiquetas || []).some((t) => t.toLowerCase().includes(s));
        if (!inName && !inDesc && !inTags) return false;
      }
      return true;
    });
  }, [archivos, selectedCat, estadoFilter, search]);

  const countByCat = useMemo(() => {
    const m = new Map<string, number>();
    archivos.forEach((a) => {
      if (a.categoria_id) m.set(a.categoria_id, (m.get(a.categoria_id) || 0) + 1);
    });
    return m;
  }, [archivos]);

  const handleDownload = async (arch: Archivo) => {
    if (!arch.current_version_id) {
      toast.error("Este archivo aún no tiene versiones");
      return;
    }
    const { data: ver } = await supabase
      .from("biblioteca_versiones" as any)
      .select("storage_path, nombre_archivo")
      .eq("id", arch.current_version_id)
      .maybeSingle();
    if (!ver) {
      toast.error("No se encontró la versión");
      return;
    }
    const { data, error } = await supabase.storage
      .from("biblioteca")
      .createSignedUrl((ver as any).storage_path, 300);
    if (error || !data?.signedUrl) {
      toast.error("No se pudo generar el enlace de descarga");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = (ver as any).nombre_archivo || arch.nombre;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDelete = async (arch: Archivo) => {
    if (!confirm(`¿Eliminar "${arch.nombre}" y todas sus versiones?`)) return;
    // delete storage objects
    const { data: vers } = await supabase
      .from("biblioteca_versiones" as any)
      .select("storage_path")
      .eq("archivo_id", arch.id);
    const paths = ((vers as any) || []).map((v: any) => v.storage_path);
    if (paths.length) {
      await supabase.storage.from("biblioteca").remove(paths);
    }
    const { error } = await supabase.from("biblioteca_archivos" as any).delete().eq("id", arch.id);
    if (error) {
      toast.error("No se pudo eliminar: " + error.message);
      return;
    }
    toast.success("Archivo eliminado");
    load();
  };

  if (!access.canView) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No tienes acceso al módulo Biblioteca.
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-7rem)]">
      {/* Sidebar de categorías */}
      <Card className="w-64 shrink-0 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">Categorías</h3>
            {isAdmin && (
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setCatsManagerOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            <button
              onClick={() => setSelectedCat(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                selectedCat === null ? "bg-accent font-medium" : "hover:bg-accent/50"
              }`}
            >
              <Folder className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left">Todos</span>
              <span className="text-xs text-muted-foreground">{archivos.length}</span>
            </button>
            {categorias.map((c) => {
              const Icon = ICONS[c.icono || "Folder"] || Folder;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCat(c.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedCat === c.id ? "bg-accent font-medium" : "hover:bg-accent/50"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" style={{ color: c.color || undefined }} />
                  <span className="flex-1 text-left truncate">{c.nombre}</span>
                  <span className="text-xs text-muted-foreground">{countByCat.get(c.id) || 0}</span>
                  {c.solo_admin && <Badge variant="outline" className="text-[9px] px-1 py-0">A</Badge>}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </Card>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-light tracking-tight">Biblioteca</h1>
            <p className="text-sm text-muted-foreground font-light">
              Listas de precio, fichas técnicas, contratos y documentos compartidos
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Upload className="h-4 w-4 mr-2" />
            Subir archivo
          </Button>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, descripción o etiqueta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="px-3 py-2 rounded-md border bg-background text-sm"
          >
            <option value="todos">Todos los estados</option>
            <option value="vigente">Vigentes</option>
            <option value="obsoleto">Obsoletos</option>
            <option value="archivado">Archivados</option>
          </select>
        </div>

        <ScrollArea className="flex-1 -mx-2 px-2">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Folder className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No hay archivos {search || selectedCat ? "que coincidan con los filtros" : "todavía"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((arch) => {
                const cat = categorias.find((c) => c.id === arch.categoria_id);
                const Icon = cat ? ICONS[cat.icono || "Folder"] || FileText : FileText;
                const canEdit = isAdmin || isManager || arch.created_by === user?.id;
                return (
                  <Card key={arch.id} className="p-4 hover:shadow-md transition-shadow flex flex-col">
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="h-10 w-10 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: (cat?.color || "#6366f1") + "20" }}
                      >
                        <Icon className="h-5 w-5" style={{ color: cat?.color || "#6366f1" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate" title={arch.nombre}>
                          {arch.nombre}
                        </h4>
                        <p className="text-xs text-muted-foreground truncate">
                          {cat?.nombre || "Sin categoría"}
                        </p>
                      </div>
                    </div>
                    {arch.descripcion && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{arch.descripcion}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mb-3">
                      <Badge variant="outline" className={`text-[10px] ${ESTADO_COLOR[arch.estado] || ""}`}>
                        {arch.estado}
                      </Badge>
                      {arch.marca !== "na" && (
                        <Badge variant="outline" className="text-[10px]">{MARCA_LABEL[arch.marca]}</Badge>
                      )}
                      {(arch.etiquetas || []).slice(0, 3).map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                    <div className="mt-auto flex items-center gap-1 pt-2 border-t">
                      <Button size="sm" variant="ghost" className="h-8 px-2 flex-1" onClick={() => handleDownload(arch)}>
                        <Download className="h-3.5 w-3.5 mr-1" />
                        <span className="text-xs">Descargar</span>
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setVersionesOf(arch)} title="Versiones">
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => {
                              setEditing(arch);
                              setFormOpen(true);
                            }}
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(arch)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {formOpen && (
        <ArchivoFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          categorias={categorias}
          archivo={editing}
          defaultCategoriaId={selectedCat}
          onSaved={() => {
            setFormOpen(false);
            setEditing(null);
            load();
          }}
        />
      )}
      {versionesOf && (
        <ArchivoVersionesDialog
          open={!!versionesOf}
          onOpenChange={(o) => !o && setVersionesOf(null)}
          archivo={versionesOf}
          onChanged={load}
        />
      )}
      {catsManagerOpen && (
        <CategoriasManagerDialog
          open={catsManagerOpen}
          onOpenChange={setCatsManagerOpen}
          categorias={categorias}
          onChanged={load}
        />
      )}
    </div>
  );
}
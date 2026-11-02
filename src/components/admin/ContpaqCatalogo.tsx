import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cargarContpaq, type TipoContpaq } from "@/lib/contpaq";

export function ContpaqCatalogo() {
  const { hasAnyRole } = useAuth();
  const admin = hasAnyRole(["admin", "master"]);
  const qc = useQueryClient();
  const file = useRef<HTMLInputElement>(null);
  const [marca, setMarca] = useState("lumaggs_chevron");
  const [vista, setVista] = useState("agentes");
  const [tipo, setTipo] = useState<TipoContpaq>("ventas");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["contpaq-catalogo", marca], enabled: admin,
    queryFn: async () => {
      const [a, c, p, r, u, productos, cargas] = await Promise.all([
        supabase.from("contpaq_agentes").select("*").eq("marca", marca).order("nombre"),
        supabase.from("contpaq_clientes").select("*").eq("marca", marca).order("nombre").range(0, 4999),
        supabase.from("contpaq_productos").select("*").eq("marca", marca).order("nombre"),
        supabase.from("rvs_personas").select("id,nombre_reporte,nombre_mostrar,user_id,is_active").order("nombre_reporte"),
        supabase.from("profiles").select("user_id,full_name,is_active").order("full_name"),
        supabase.from("productos").select("id,codigo,nombre_producto,presentaciones(unidades_equivalentes)").order("codigo").range(0, 4999),
        supabase.from("contpaq_cargas").select("*").eq("marca", marca).order("created_at", { ascending: false }),
      ]);
      for (const q of [a,c,p,r,u,productos,cargas]) if (q.error) throw q.error;
      return { agentes:a.data ?? [], clientes:c.data ?? [], items:p.data ?? [], personas:r.data ?? [], usuarios:u.data ?? [], productos:productos.data ?? [], cargas:cargas.data ?? [] };
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["contpaq-catalogo"] }); qc.invalidateQueries({ queryKey: ["guia-batalla"] }); };
  const accion = async (f: () => PromiseLike<{ error: any }>) => {
    setBusy(true);
    try { const { error } = await f(); if (error) throw error; refresh(); toast.success("Vínculo guardado"); }
    catch (e) { toast.error(e instanceof Error ? e.message : String((e as any)?.message ?? e)); }
    finally { setBusy(false); }
  };
  if (!admin) return <p className="text-muted-foreground">Solo administradores pueden gestionar los archivos y vínculos.</p>;
  const match = (s: string) => s.toLowerCase().includes(search.toLowerCase());
  return <div className="space-y-4">
    <h2 className="text-lg font-semibold">Ventas y agentes CONTPAQ</h2>
    <div className="flex flex-wrap gap-2">
      <Select value={marca} onValueChange={setMarca}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="lumaggs_chevron">Lumaggs</SelectItem><SelectItem value="galsa_phillips66">Galsa</SelectItem></SelectContent></Select>
      <Select value={tipo} onValueChange={v => setTipo(v as TipoContpaq)}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="clientes">Cargar clientes</SelectItem><SelectItem value="agentes">Cargar agentes</SelectItem><SelectItem value="ventas">Cargar ventas</SelectItem></SelectContent></Select>
      <Button disabled={busy} onClick={() => file.current?.click()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Cargar archivo</Button>
      <input ref={file} type="file" accept=".xls,.xlsx" className="hidden" onChange={async e => {
        const f = e.target.files?.[0]; if (!f) return;
        setBusy(true);
        try { const result = await cargarContpaq(f, marca, tipo); toast.success(result.repetido ? "Este archivo ya estaba cargado" : `${result.filas} registros guardados`); refresh(); }
        catch (e) { toast.error(String((e as any)?.message ?? e)); }
        finally { setBusy(false); e.target.value = ""; }
      }} />
    </div>
    <div className="flex flex-wrap gap-2">{["agentes","clientes","productos","cargas"].map(v => <Button key={v} variant={vista === v ? "default" : "outline"} onClick={() => setVista(v)}>{v[0].toUpperCase()+v.slice(1)}</Button>)}<Input className="w-60" placeholder="Buscar código o nombre" value={search} onChange={e => setSearch(e.target.value)} /></div>
    {error && <p className="text-destructive">{error.message}</p>}
    {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
    <div className="max-h-[65vh] overflow-auto border rounded-md"><Table><TableHeader className="sticky top-0 z-10 bg-background"><TableRow><TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>{vista === "agentes" ? "Persona RVS / Usuario" : vista === "productos" ? "Producto / equivalencia" : vista === "clientes" ? "RFC" : "Registros / fecha"}</TableHead></TableRow></TableHeader><TableBody>
      {vista === "agentes" && data?.agentes.filter(a => match(a.codigo+" "+a.nombre)).map(a => {
        const persona = data.personas.find(p => p.id === a.persona_id);
        const usuario = data.usuarios.find(u => u.user_id === persona?.user_id);
        const noPersona = a.codigo === "253" || a.codigo.startsWith("C") || a.nombre === "NINGUNO";
        return <TableRow key={a.codigo}><TableCell>{a.codigo}</TableCell><TableCell>{a.nombre}{!usuario && !noPersona && <Badge variant="outline" className="ml-2">Pendiente</Badge>}</TableCell><TableCell className="space-y-2 min-w-64">
          <Select disabled={busy || noPersona} value={a.persona_id ?? "none"} onValueChange={v => accion(() => supabase.rpc("contpaq_vincular", { _marca:marca,_codigo:a.codigo,_tipo:"agente",_id:v === "none" ? null as any : v }))}><SelectTrigger><SelectValue placeholder="Persona RVS" /></SelectTrigger><SelectContent><SelectItem value="none">Sin persona RVS</SelectItem>{data.personas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre_mostrar || p.nombre_reporte}{!p.is_active ? " (inactiva)" : ""}</SelectItem>)}</SelectContent></Select>
          <Select disabled={busy || noPersona} value={persona?.user_id ?? "none"} onValueChange={v => accion(() => supabase.rpc("contpaq_asignar_usuario",{_marca:marca,_codigo:a.codigo,_usuario:v === "none" ? null as any : v}))}><SelectTrigger><SelectValue placeholder="Usuario" /></SelectTrigger><SelectContent><SelectItem value="none">Sin usuario</SelectItem>{data.usuarios.filter(u => u.is_active || u.user_id === persona?.user_id).map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}{!u.is_active ? " (inactivo)" : ""}</SelectItem>)}</SelectContent></Select>
        </TableCell></TableRow>;
      })}
      {vista === "clientes" && data?.clientes.filter(c => match(c.codigo+" "+c.nombre)).map(c => <TableRow key={c.codigo}><TableCell>{c.codigo}</TableCell><TableCell>{c.nombre}</TableCell><TableCell>{c.rfc}</TableCell></TableRow>)}
      {vista === "productos" && data?.items.filter(p => match(p.codigo+" "+p.nombre)).map(p => <TableRow key={p.codigo}><TableCell>{p.codigo}</TableCell><TableCell>{p.nombre}{!p.producto_id && <Badge variant="destructive" className="ml-2">Sin equivalencia</Badge>}</TableCell><TableCell><Select disabled={busy} value={p.producto_id ?? "none"} onValueChange={v => accion(() => supabase.rpc("contpaq_vincular",{_marca:marca,_codigo:p.codigo,_tipo:"producto",_id:v === "none" ? null as any : v}))}><SelectTrigger className="max-w-80"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin producto vinculado</SelectItem>{data.productos.map(item => <SelectItem key={item.id} value={item.id}>{item.codigo} · {item.nombre_producto} · {item.presentaciones?.unidades_equivalentes ?? "—"} UE</SelectItem>)}</SelectContent></Select></TableCell></TableRow>)}
      {vista === "cargas" && data?.cargas.filter(c => match(c.archivo)).map(c => <TableRow key={c.id}><TableCell>{c.tipo}</TableCell><TableCell><Button variant="link" onClick={async () => { const { data, error } = await supabase.storage.from("contpaq-originales").createSignedUrl(c.ruta,60); if (error) toast.error(error.message); else window.open(data.signedUrl,"_blank","noopener"); }}>{c.archivo}</Button></TableCell><TableCell>{c.filas} · {new Date(c.created_at).toLocaleDateString("es-MX")}</TableCell></TableRow>)}
    </TableBody></Table></div>
  </div>;
}
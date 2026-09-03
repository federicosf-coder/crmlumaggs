import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Search, Trash2, UserPlus, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContactFormDialog, type ContactEditData } from "@/components/ContactFormDialog";

const LEAD_SOURCE_ID = "7d615fa2-be2a-4e13-bcc3-e49452b7865e";

interface ContactoSinEmpresa {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  email2: string | null;
  phone: string | null;
  mobile: string | null;
  whatsapp_phone: string | null;
  job_title: string | null;
  department: string | null;
  notes: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  [key: string]: any;
}

function fullName(c: ContactoSinEmpresa) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "Sin nombre";
}

export default function ContactosSinEmpresa() {
  const { hasAnyRole } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editContact, setEditContact] = useState<ContactoSinEmpresa | null>(null);
  const [convertir, setConvertir] = useState<ContactoSinEmpresa | null>(null);
  const [eliminar, setEliminar] = useState<ContactoSinEmpresa | null>(null);
  const [working, setWorking] = useState(false);

  const puedeVer = hasAnyRole(["admin", "manager"]);

  const { data, isLoading } = useQuery({
    queryKey: ["contacts-sin-empresa"],
    enabled: puedeVer,
    queryFn: async () => {
      const { data: contacts, error } = await supabase
        .from("contacts")
        .select("*")
        .is("company_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (contacts ?? []) as ContactoSinEmpresa[];
      const ids = Array.from(new Set(rows.map((r) => r.created_by).filter(Boolean))) as string[];
      let nombres: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ids);
        nombres = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.full_name ?? "Sin nombre"]));
      }
      return { rows, nombres };
    },
  });

  const rows = data?.rows ?? [];
  const nombres = data?.nombres ?? {};

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((c) =>
      [fullName(c), c.email, c.email2, c.phone, c.mobile, c.whatsapp_phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const grupos = useMemo(() => {
    const map = new Map<string, ContactoSinEmpresa[]>();
    filtrados.forEach((c) => {
      const key = c.created_by ?? "__none__";
      map.set(key, [...(map.get(key) ?? []), c]);
    });
    return Array.from(map.entries())
      .map(([key, items]) => ({
        key,
        label: key === "__none__" ? "Sin creador asignado" : nombres[key] ?? "Usuario desconocido",
        items,
      }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [filtrados, nombres]);

  const refrescar = () => qc.invalidateQueries({ queryKey: ["contacts-sin-empresa"] });

  const handleConvertir = async () => {
    if (!convertir) return;
    setWorking(true);
    try {
      const { error: leadErr } = await (supabase as any).from("leads").insert({
        source_id: LEAD_SOURCE_ID,
        estatus: "nuevo",
        nombre: fullName(convertir),
        telefono: convertir.mobile ?? convertir.phone ?? null,
        email: convertir.email ?? null,
        mensaje: convertir.notes ?? null,
        payload: convertir,
      });
      if (leadErr) throw leadErr;
      const { error: delErr } = await supabase.from("contacts").delete().eq("id", convertir.id);
      if (delErr) throw delErr;
      toast.success("Contacto convertido a prospecto");
      setConvertir(null);
      refrescar();
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads-pending-count"] });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo convertir el contacto");
    } finally {
      setWorking(false);
    }
  };

  const handleEliminar = async () => {
    if (!eliminar) return;
    setWorking(true);
    try {
      const { error } = await supabase.from("contacts").delete().eq("id", eliminar.id);
      if (error) throw error;
      toast.success("Contacto eliminado");
      setEliminar(null);
      refrescar();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar el contacto");
    } finally {
      setWorking(false);
    }
  };

  if (!puedeVer) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          No tienes permisos para ver esta sección.
        </CardContent></Card>
      </div>
    );
  }

  const editData: ContactEditData | null = editContact
    ? {
        id: editContact.id,
        first_name: editContact.first_name ?? "",
        last_name: editContact.last_name ?? "",
        email: editContact.email,
        email2: editContact.email2,
        phone: editContact.phone,
        mobile: editContact.mobile,
        whatsapp_phone: editContact.whatsapp_phone,
        tel_emp: editContact.tel_emp ?? null,
        job_title: editContact.job_title,
        department: editContact.department,
        company_id: editContact.company_id,
        notes: editContact.notes,
        comm_email: editContact.comm_email,
        comm_email2: editContact.comm_email2,
        comm_whatsapp: editContact.comm_whatsapp,
        comm_cel: editContact.comm_cel,
        comm_tel: editContact.comm_tel,
        comm_tel_emp: editContact.comm_tel_emp,
        sede: editContact.sede ?? null,
        plaza_id: editContact.plaza_id ?? null,
        contacto_cobranza: editContact.contacto_cobranza,
        contacto_credito: editContact.contacto_credito,
      }
    : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/directory"><ArrowLeft className="h-4 w-4 mr-1" /> Directorio</Link>
          </Button>
          <div className="flex items-center gap-2">
            <UserX className="h-5 w-5" />
            <h1 className="text-xl font-light">Contactos sin empresa</h1>
            <Badge variant="outline">{rows.length} contactos sin empresa</Badge>
          </div>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nombre, teléfono o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Cargando...</CardContent></Card>
      )}
      {!isLoading && grupos.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          No hay contactos sin empresa.
        </CardContent></Card>
      )}

      {grupos.length > 0 && (
        <Accordion type="multiple" defaultValue={grupos.slice(0, 1).map((g) => g.key)} className="space-y-3">
          {grupos.map((g) => (
            <AccordionItem key={g.key} value={g.key} className="border rounded-md overflow-hidden">
              <AccordionTrigger className="px-4 py-3 bg-gradient-to-r from-violet-50 to-blue-50 hover:no-underline">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{g.label}</span>
                  <Badge variant="secondary">{g.items.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px] uppercase tracking-wide">Nombre completo</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide">Teléfono / Celular</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide">Email</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide">Puesto</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide">Notas</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide">Creado</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.items.map((c, i) => (
                      <TableRow key={c.id} className={i % 2 ? "bg-muted/30 hover:bg-blue-50/40" : "hover:bg-blue-50/40"}>
                        <TableCell className="text-sm">{fullName(c)}</TableCell>
                        <TableCell className="text-xs">
                          {[c.mobile, c.phone].filter(Boolean).join(" / ") || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{c.email ?? "—"}</TableCell>
                        <TableCell className="text-xs">{c.job_title ?? "—"}</TableCell>
                        <TableCell className="text-xs max-w-[220px] truncate">{c.notes ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString("es-MX")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => setEditContact(c)}>
                              <Building2 className="h-3.5 w-3.5 mr-1" /> Vincular a empresa
                            </Button>
                            <Button size="sm" variant="ghost" title="Convertir a lead" onClick={() => setConvertir(c)}>
                              <UserPlus className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" title="Eliminar" onClick={() => setEliminar(c)}>
                              <Trash2 className="h-4 w-4 text-rose-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {editContact && (
        <ContactFormDialog
          open={!!editContact}
          onOpenChange={(v) => { if (!v) { setEditContact(null); refrescar(); } }}
          editData={editData}
          onCreated={() => refrescar()}
        />
      )}

      <AlertDialog open={!!convertir} onOpenChange={(v) => !v && setConvertir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Convertir a prospecto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se creará un prospecto en la bandeja con los datos de{" "}
              <strong>{convertir ? fullName(convertir) : ""}</strong> y el contacto se eliminará del directorio
              (queda respaldado en el prospecto).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleConvertir(); }} disabled={working}>
              {working ? "Convirtiendo..." : "Convertir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!eliminar} onOpenChange={(v) => !v && setEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente a <strong>{eliminar ? fullName(eliminar) : ""}</strong>. Esta acción no
              se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); handleEliminar(); }}
              disabled={working}
            >
              {working ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Mail, Plus, Pencil, Trash2, X, UserPlus, Users } from "lucide-react";

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

interface Group {
  id: string;
  nombre: string;
  descripcion: string | null;
  is_active: boolean;
}
interface Member {
  id: string;
  group_id: string;
  user_id: string | null;
  nombre: string | null;
  email: string;
}
interface ProfileOption {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

export function EmailGroupsTab() {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [membersGroup, setMembersGroup] = useState<Group | null>(null);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["email_groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_groups")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return data as Group[];
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["email_group_counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_group_members")
        .select("group_id");
      const map: Record<string, number> = {};
      (data || []).forEach((m: any) => {
        map[m.group_id] = (map[m.group_id] || 0) + 1;
      });
      return map;
    },
  });

  const removeGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_groups"] });
      qc.invalidateQueries({ queryKey: ["email_group_counts"] });
      toast.success("Grupo eliminado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" /> Grupos de correo
        </CardTitle>
        <Button size="sm" onClick={() => setOpenNew(true)}>
          <Plus className="mr-1 h-4 w-4" /> Nuevo grupo
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Cargando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Miembros</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.nombre}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {g.descripcion || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{counts[g.id] || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    {g.is_active ? (
                      <Badge>Sí</Badge>
                    ) : (
                      <Badge variant="outline">No</Badge>
                    )}
                  </TableCell>
                  <TableCell className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setMembersGroup(g)}
                      title="Miembros"
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditGroup(g)}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`¿Eliminar el grupo "${g.nombre}"?`))
                          removeGroup.mutate(g.id);
                      }}
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {groups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Sin grupos. Crea uno para empezar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <GroupFormDialog
        open={openNew}
        onOpenChange={setOpenNew}
        group={null}
      />
      {editGroup && (
        <GroupFormDialog
          open={!!editGroup}
          onOpenChange={(o) => !o && setEditGroup(null)}
          group={editGroup}
        />
      )}
      {membersGroup && (
        <GroupMembersDialog
          group={membersGroup}
          open={!!membersGroup}
          onOpenChange={(o) => !o && setMembersGroup(null)}
        />
      )}
    </Card>
  );
}

// ── Group form (create/edit) ─────────────────────────
function GroupFormDialog({
  open,
  onOpenChange,
  group,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  group: Group | null;
}) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState(group?.nombre || "");
  const [descripcion, setDescripcion] = useState(group?.descripcion || "");
  const [active, setActive] = useState(group?.is_active ?? true);

  const save = useMutation({
    mutationFn: async () => {
      if (group) {
        const { error } = await supabase
          .from("email_groups")
          .update({ nombre, descripcion: descripcion || null, is_active: active })
          .eq("id", group.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("email_groups")
          .insert({ nombre, descripcion: descripcion || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_groups"] });
      toast.success(group ? "Grupo actualizado" : "Grupo creado");
      onOpenChange(false);
      if (!group) {
        setNombre("");
        setDescripcion("");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{group ? "Editar grupo" : "Nuevo grupo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre *</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Contabilidad"
            />
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
          {group && (
            <div className="flex items-center gap-2">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label>Activo</Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!nombre || save.isPending}>
            {save.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Members manager ──────────────────────────────────
function GroupMembersDialog({
  group,
  open,
  onOpenChange,
}: {
  group: Group;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"user" | "external">("user");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [extNombre, setExtNombre] = useState("");
  const [extEmail, setExtEmail] = useState("");

  const { data: members = [] } = useQuery({
    queryKey: ["email_group_members", group.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_group_members")
        .select("*")
        .eq("group_id", group.id)
        .order("nombre");
      if (error) throw error;
      return data as Member[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_for_email_groups"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id,full_name,email")
        .eq("is_active", true)
        .order("full_name");
      return (data || []) as ProfileOption[];
    },
  });

  const addMember = useMutation({
    mutationFn: async () => {
      let payload: any;
      if (tab === "user") {
        const p = profiles.find((x) => x.user_id === selectedUserId);
        if (!p) throw new Error("Selecciona un usuario");
        if (!p.email) throw new Error("El usuario no tiene correo");
        payload = {
          group_id: group.id,
          user_id: p.user_id,
          nombre: p.full_name,
          email: p.email,
        };
      } else {
        if (!isValidEmail(extEmail)) throw new Error("Correo inválido");
        payload = {
          group_id: group.id,
          user_id: null,
          nombre: extNombre || null,
          email: extEmail,
        };
      }
      const { error } = await supabase.from("email_group_members").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_group_members", group.id] });
      qc.invalidateQueries({ queryKey: ["email_group_counts"] });
      setSelectedUserId("");
      setExtNombre("");
      setExtEmail("");
      toast.success("Miembro agregado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_group_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_group_members", group.id] });
      qc.invalidateQueries({ queryKey: ["email_group_counts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Miembros · {group.nombre}
          </DialogTitle>
          <DialogDescription>
            Agrega usuarios internos (con su correo de perfil) o contactos externos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={tab === "user" ? "default" : "outline"}
              onClick={() => setTab("user")}
            >
              Usuario interno
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === "external" ? "default" : "outline"}
              onClick={() => setTab("external")}
            >
              Contacto externo
            </Button>
          </div>

          {tab === "user" ? (
            <div className="flex gap-2">
              <div className="flex-1">
                <SearchableSelect
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                  options={profiles
                    .filter((p) => p.email)
                    .map((p) => ({
                      value: p.user_id,
                      label: `${p.full_name || "—"} (${p.email})`,
                    }))}
                  placeholder="Buscar usuario..."
                />
              </div>
              <Button onClick={() => addMember.mutate()} disabled={!selectedUserId}>
                <UserPlus className="h-4 w-4 mr-1" /> Agregar
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-[1fr,1fr,auto] gap-2">
              <Input
                placeholder="Nombre (opcional)"
                value={extNombre}
                onChange={(e) => setExtNombre(e.target.value)}
              />
              <Input
                placeholder="correo@ejemplo.com"
                type="email"
                value={extEmail}
                onChange={(e) => setExtEmail(e.target.value)}
              />
              <Button onClick={() => addMember.mutate()} disabled={!extEmail}>
                <UserPlus className="h-4 w-4 mr-1" /> Agregar
              </Button>
            </div>
          )}

          <div className="border rounded-md max-h-72 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.nombre || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{m.email}</TableCell>
                    <TableCell>
                      {m.user_id ? (
                        <Badge variant="secondary">Usuario</Badge>
                      ) : (
                        <Badge variant="outline">Externo</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeMember.mutate(m.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {members.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      Sin miembros
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

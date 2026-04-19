import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { X, Pencil } from "lucide-react";
import { roleLabel } from "@/lib/roles";

type AppRole = "admin" | "manager" | "sales" | "delivery" | "warehouse" | "customer_service" | "accounting";
const ALL_ROLES: AppRole[] = ["admin", "manager", "sales", "delivery", "warehouse", "customer_service", "accounting"];

interface Team {
  id: string;
  name: string;
}

interface Plaza {
  id: string;
  nombre: string;
}

interface UserWithRoles {
  user_id: string;
  full_name: string | null;
  email: string | null;
  is_active: boolean;
  phone: string | null;
  plaza_id: string | null;
  approval_status: "pendiente" | "aprobado" | "rechazado";
  created_at: string;
  roles: AppRole[];
  team_ids: string[];
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<UserWithRoles | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTeamIds, setEditTeamIds] = useState<string[]>([]);
  const [editPlazaId, setEditPlazaId] = useState<string>("");
  const [plazas, setPlazas] = useState<Plaza[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { hasRole } = useAuth();

  const fetchUsers = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: allRoles }, { data: teamsData }, { data: membersData }, { data: plazasData }] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
      supabase.from("teams").select("id, name").eq("is_active", true),
      supabase.from("team_members").select("*"),
      supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre"),
    ]);

    setTeams(teamsData || []);
    setPlazas(plazasData || []);

    const mapped = (profiles || []).map((p) => ({
      user_id: p.user_id,
      full_name: p.full_name,
      email: p.email,
      is_active: p.is_active,
      phone: p.phone,
      plaza_id: (p as any).plaza_id ?? null,
      approval_status: ((p as any).approval_status ?? "aprobado") as "pendiente" | "aprobado" | "rechazado",
      created_at: (p as any).created_at ?? "",
      roles: (allRoles || []).filter((r) => r.user_id === p.user_id).map((r) => r.role as AppRole),
      team_ids: (membersData || []).filter((m) => m.user_id === p.user_id).map((m) => m.team_id),
    }));
    setUsers(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const addRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rol agregado" });
      fetchUsers();
    }
  };

  const removeRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rol eliminado" });
      fetchUsers();
    }
  };

  const updateUserPlaza = async (userId: string, plazaId: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ plaza_id: plazaId || null })
      .eq("user_id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Plaza actualizada" });
      fetchUsers();
    }
  };

  const setApprovalStatus = async (userId: string, status: "aprobado" | "rechazado") => {
    const { error } = await supabase
      .from("profiles")
      .update({ approval_status: status } as any)
      .eq("user_id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    if (status === "aprobado") {
      // Assign default 'sales' role if user has no roles yet
      const target = users.find((u) => u.user_id === userId);
      if (target && target.roles.length === 0) {
        await supabase.from("user_roles").insert({ user_id: userId, role: "sales" });
      }
    }
    toast({ title: status === "aprobado" ? "Usuario aprobado" : "Usuario rechazado" });
    fetchUsers();
  };

  const openEdit = (u: UserWithRoles) => {
    setEditUser(u);
    setEditName(u.full_name || "");
    setEditPhone(u.phone || "");
    setEditTeamIds([...u.team_ids]);
    setEditPlazaId(u.plaza_id || "");
  };

  const toggleTeam = (teamId: string) => {
    setEditTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const saveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      // Update profile
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ full_name: editName, phone: editPhone || null, plaza_id: editPlazaId || null })
        .eq("user_id", editUser.user_id);
      if (profErr) throw profErr;

      // Sync teams: remove old, add new
      const toRemove = editUser.team_ids.filter((id) => !editTeamIds.includes(id));
      const toAdd = editTeamIds.filter((id) => !editUser.team_ids.includes(id));

      for (const teamId of toRemove) {
        await supabase.from("team_members").delete().eq("user_id", editUser.user_id).eq("team_id", teamId);
      }
      for (const teamId of toAdd) {
        await supabase.from("team_members").insert({ user_id: editUser.user_id, team_id: teamId });
      }

      toast({ title: "Usuario actualizado" });
      setEditUser(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!hasRole("admin")) {
    return <p className="text-muted-foreground">No tienes permiso para ver esta página.</p>;
  }

  const getTeamNames = (teamIds: string[]) =>
    teamIds.map((id) => teams.find((t) => t.id === id)?.name).filter(Boolean);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Correo</Label>
                <Input value={editUser.email || ""} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Plaza Predeterminada</Label>
                <Select value={editPlazaId || "__none__"} onValueChange={(v) => setEditPlazaId(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Sin plaza" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin plaza</SelectItem>
                    {plazas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Equipos</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  {teams.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay equipos creados.</p>
                  ) : (
                    teams.map((team) => (
                      <div key={team.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`team-${team.id}`}
                          checked={editTeamIds.includes(team.id)}
                          onCheckedChange={() => toggleTeam(team.id)}
                        />
                        <label htmlFor={`team-${team.id}`} className="text-sm cursor-pointer">
                          {team.name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <Button onClick={saveEdit} disabled={saving} className="w-full">
                {saving ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle>Todos los Usuarios</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Equipos</TableHead>
                  <TableHead>Plaza</TableHead>
                  <TableHead>Agregar Rol</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.is_active ? "default" : "secondary"}>
                        {u.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Badge key={r} variant="outline" className="gap-1">
                            {roleLabel(r)}
                            <button onClick={() => removeRole(u.user_id, r)} className="hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {getTeamNames(u.team_ids).map((name) => (
                          <Badge key={name} variant="secondary" className="text-xs">
                            {name}
                          </Badge>
                        ))}
                        {u.team_ids.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.plaza_id || "__none__"}
                        onValueChange={(v) => updateUserPlaza(u.user_id, v === "__none__" ? "" : v)}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue placeholder="Sin plaza" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin plaza</SelectItem>
                          {plazas.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select onValueChange={(v) => addRole(u.user_id, v as AppRole)}>
                        <SelectTrigger className="w-44">
                          <SelectValue placeholder="Agregar rol..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_ROLES.filter((r) => !u.roles.includes(r)).map((r) => (
                            <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Editar usuario">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

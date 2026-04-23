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
import { X, Pencil, Merge, Power, Trash2, UserPlus, Search, KeyRound } from "lucide-react";
import { roleLabel } from "@/lib/roles";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [editEmail, setEditEmail] = useState("");
  const [editPwd, setEditPwd] = useState("");
  const [editPwdConfirm, setEditPwdConfirm] = useState("");
  const [plazas, setPlazas] = useState<Plaza[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { hasRole, user: currentUser } = useAuth();

  // Merge dialog state
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState<string>("");
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [mergeBusy, setMergeBusy] = useState(false);

  // Delete confirmation state
  const [deleteUser, setDeleteUser] = useState<UserWithRoles | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Password change state
  const [pwdUser, setPwdUser] = useState<UserWithRoles | null>(null);
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  // Create user dialog state
  const canManageUsers = hasRole("admin") || hasRole("manager");
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);

  // List filters
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [search, setSearch] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPlazaId, setNewPlazaId] = useState("");
  const [newTeamIds, setNewTeamIds] = useState<string[]>([]);
  const [newRoles, setNewRoles] = useState<AppRole[]>(["sales"]);

  const resetCreateForm = () => {
    setNewEmail("");
    setNewPassword("");
    setNewName("");
    setNewPhone("");
    setNewPlazaId("");
    setNewTeamIds([]);
    setNewRoles(["sales"]);
  };

  const handleChangePassword = async () => {
    if (!pwdUser) return;
    if (pwdNew.length < 6) {
      toast({ title: "La contraseña debe tener al menos 6 caracteres", variant: "destructive" });
      return;
    }
    if (pwdNew !== pwdConfirm) {
      toast({ title: "Las contraseñas no coinciden", variant: "destructive" });
      return;
    }
    setPwdBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-set-user-password", {
      body: { user_id: pwdUser.user_id, password: pwdNew },
    });
    setPwdBusy(false);
    const errMsg = (data as any)?.error || error?.message;
    if (errMsg) {
      toast({ title: "Error", description: errMsg, variant: "destructive" });
      return;
    }
    toast({ title: "Contraseña actualizada", description: `Se cambió la contraseña de ${pwdUser.full_name || pwdUser.email}.` });
    setPwdUser(null);
    setPwdNew("");
    setPwdConfirm("");
  };

  const toggleNewTeam = (teamId: string) => {
    setNewTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const toggleNewRole = (role: AppRole) => {
    setNewRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleCreateUser = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !newPassword || !newName.trim()) {
      toast({ title: "Completa nombre, correo y contraseña", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "La contraseña debe tener al menos 6 caracteres", variant: "destructive" });
      return;
    }
    setCreateBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: {
        email,
        password: newPassword,
        full_name: newName.trim(),
        phone: newPhone.trim() || null,
        plaza_id: newPlazaId || null,
        team_ids: newTeamIds,
        roles: newRoles,
      },
    });
    setCreateBusy(false);
    const errMsg = (data as any)?.error || error?.message;
    if (errMsg) {
      toast({ title: "Error al crear usuario", description: errMsg, variant: "destructive" });
      return;
    }
    toast({ title: "Usuario creado", description: "El usuario quedó aprobado y puede iniciar sesión." });
    setCreateOpen(false);
    resetCreateForm();
    fetchUsers();
  };

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

  const toggleActive = async (u: UserWithRoles) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !u.is_active })
      .eq("user_id", u.user_id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: u.is_active ? "Usuario desactivado" : "Usuario activado" });
      fetchUsers();
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleteBusy(true);
    const { error } = await supabase.rpc("delete_user_safe", { _user_id: deleteUser.user_id });
    setDeleteBusy(false);
    if (error) {
      toast({
        title: "No se puede eliminar",
        description: error.message + " — usa Desactivar.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Usuario eliminado" });
      setDeleteUser(null);
      fetchUsers();
    }
  };

  const handleMerge = async () => {
    if (!mergeSourceId || !mergeTargetId) {
      toast({ title: "Selecciona ambos usuarios", variant: "destructive" });
      return;
    }
    if (mergeSourceId === mergeTargetId) {
      toast({ title: "Origen y destino deben ser distintos", variant: "destructive" });
      return;
    }
    setMergeBusy(true);
    const { error } = await supabase.rpc("merge_users", {
      _source_user_id: mergeSourceId,
      _target_user_id: mergeTargetId,
    });
    setMergeBusy(false);
    if (error) {
      toast({ title: "Error en merge", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Usuarios fusionados correctamente" });
      setMergeOpen(false);
      setMergeSourceId("");
      setMergeTargetId("");
      fetchUsers();
    }
  };

  const openEdit = (u: UserWithRoles) => {
    setEditUser(u);
    setEditName(u.full_name || "");
    setEditPhone(u.phone || "");
    setEditTeamIds([...u.team_ids]);
    setEditPlazaId(u.plaza_id || "");
    setEditEmail("");
    setEditPwd("");
    setEditPwdConfirm("");
  };

  const toggleTeam = (teamId: string) => {
    setEditTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const saveEdit = async () => {
    if (!editUser) return;
    const hasExistingEmail = !!(editUser.email && editUser.email.trim());
    const wantsEmail = !hasExistingEmail && editEmail.trim().length > 0;
    const wantsPwd = editPwd.length > 0;

    if (wantsEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
      toast({ title: "Correo inválido", variant: "destructive" });
      return;
    }
    if (wantsPwd) {
      if (editPwd.length < 6) {
        toast({ title: "La contraseña debe tener al menos 6 caracteres", variant: "destructive" });
        return;
      }
      if (editPwd !== editPwdConfirm) {
        toast({ title: "Las contraseñas no coinciden", variant: "destructive" });
        return;
      }
    }

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

      // Assign email (only if user had no previous email — backend re-validates)
      if (wantsEmail) {
        const { data, error } = await supabase.functions.invoke("admin-update-user-email", {
          body: { user_id: editUser.user_id, email: editEmail.trim().toLowerCase() },
        });
        const errMsg = (data as any)?.error || error?.message;
        if (errMsg) throw new Error(errMsg);
      }

      // Change password
      if (wantsPwd) {
        const { data, error } = await supabase.functions.invoke("admin-set-user-password", {
          body: { user_id: editUser.user_id, password: editPwd },
        });
        const errMsg = (data as any)?.error || error?.message;
        if (errMsg) throw new Error(errMsg);
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

  if (!canManageUsers) {
    return <p className="text-muted-foreground">No tienes permiso para ver esta página.</p>;
  }

  const getTeamNames = (teamIds: string[]) =>
    teamIds.map((id) => teams.find((t) => t.id === id)?.name).filter(Boolean);

  const pendingUsers = users.filter((u) => u.approval_status === "pendiente");

  const filteredUsers = users.filter((u) => {
    if (statusFilter === "active" && !u.is_active) return false;
    if (statusFilter === "inactive" && u.is_active) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${u.full_name ?? ""} ${u.email ?? ""} ${u.phone ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => { resetCreateForm(); setCreateOpen(true); }}>
            <UserPlus className="h-4 w-4 mr-1" /> Nuevo usuario
          </Button>
          <Button size="sm" onClick={() => setMergeOpen(true)} variant="outline">
            <Merge className="h-4 w-4 mr-1" /> Fusionar
          </Button>
        </div>
      </div>

      {pendingUsers.length > 0 && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pendientes de Aprobación
              <Badge variant="secondary">{pendingUsers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.phone || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" onClick={() => setApprovalStatus(u.user_id, "aprobado")}>
                          Aprobar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setApprovalStatus(u.user_id, "rechazado")}>
                          Rechazar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                {editUser.email && editUser.email.trim() ? (
                  <>
                    <Input value={editUser.email} disabled readOnly className="bg-muted" />
                    <p className="text-xs text-muted-foreground">
                      El correo no puede modificarse porque ya está vinculado a documentos, empresas y otros registros existentes.
                    </p>
                  </>
                ) : (
                  <>
                    <Input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="usuario@dominio.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Este usuario no tiene correo asignado. Puedes asignarle uno por única vez.
                    </p>
                  </>
                )}
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
              {hasRole("admin") && (
                <div className="space-y-2 border-t pt-4">
                  <Label>Cambiar contraseña (opcional)</Label>
                  <Input
                    type="password"
                    value={editPwd}
                    onChange={(e) => setEditPwd(e.target.value)}
                    placeholder="Nueva contraseña (mín. 6)"
                    autoComplete="new-password"
                    name="new-password-no-autofill"
                    readOnly
                    onFocus={(e) => e.currentTarget.removeAttribute("readonly")}
                  />
                  <Input
                    type="password"
                    value={editPwdConfirm}
                    onChange={(e) => setEditPwdConfirm(e.target.value)}
                    placeholder="Confirmar contraseña"
                    autoComplete="new-password"
                    name="confirm-password-no-autofill"
                    readOnly
                    onFocus={(e) => e.currentTarget.removeAttribute("readonly")}
                  />
                  {editPwdConfirm && editPwd !== editPwdConfirm && (
                    <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Deja en blanco para no modificar la contraseña actual.
                  </p>
                </div>
              )}
              <Button onClick={saveEdit} disabled={saving} className="w-full">
                {saving ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">
              Usuarios <span className="text-muted-foreground font-normal text-sm">({filteredUsers.length})</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar nombre o correo..."
                  className="pl-8 h-9 w-64"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">No activos</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <p className="text-muted-foreground py-4 text-sm">Cargando...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-muted-foreground py-6 text-sm text-center">No hay usuarios que coincidan con los filtros.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="[&>th]:h-9 [&>th]:px-2 [&>th]:text-xs">
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
                {filteredUsers.map((u) => (
                  <TableRow key={u.user_id} className="[&>td]:py-1.5 [&>td]:px-2 text-sm">
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.is_active ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {u.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Badge key={r} variant="outline" className="gap-1 text-[10px] px-1.5 py-0">
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
                          <Badge key={name} variant="secondary" className="text-[10px] px-1.5 py-0">
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
                        <SelectTrigger className="w-36 h-8 text-xs">
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
                        <SelectTrigger className="w-36 h-8 text-xs">
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
                      <div className="flex items-center justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)} title="Editar usuario">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleActive(u)}
                          title={u.is_active ? "Desactivar" : "Activar"}
                        >
                          <Power className={`h-4 w-4 ${u.is_active ? "" : "text-muted-foreground"}`} />
                        </Button>
                        {hasRole("admin") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => { setPwdUser(u); setPwdNew(""); setPwdConfirm(""); }}
                            title="Cambiar contraseña"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDeleteUser(u)}
                          title="Eliminar"
                          disabled={u.user_id === currentUser?.id}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Merge Users Dialog */}
      <Dialog open={mergeOpen} onOpenChange={(o) => !o && setMergeOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fusionar usuarios</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              El usuario origen será eliminado y todas sus referencias (documentos, pagos, deals, tareas, equipos, roles, etc.) se reasignarán al usuario destino. Esta acción no se puede deshacer.
            </p>
            <div className="space-y-2">
              <Label>Origen (se eliminará)</Label>
              <Select value={mergeSourceId} onValueChange={setMergeSourceId}>
                <SelectTrigger><SelectValue placeholder="Selecciona usuario origen" /></SelectTrigger>
                <SelectContent>
                  {users.filter((u) => u.user_id !== currentUser?.id).map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name || u.email} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Destino (se conserva)</Label>
              <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                <SelectTrigger><SelectValue placeholder="Selecciona usuario destino" /></SelectTrigger>
                <SelectContent>
                  {users.filter((u) => u.user_id !== mergeSourceId).map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name || u.email} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleMerge} disabled={mergeBusy} className="w-full">
              {mergeBusy ? "Fusionando..." : "Fusionar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se eliminará si no tiene registros relacionados. Si tiene historial, usa Desactivar en su lugar.
              <br /><br />
              <strong>{deleteUser?.full_name || deleteUser?.email}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteBusy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteBusy ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); resetCreateForm(); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre completo *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Correo *</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contraseña temporal *</Label>
              <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <Label>Plaza Predeterminada</Label>
              <Select value={newPlazaId || "__none__"} onValueChange={(v) => setNewPlazaId(v === "__none__" ? "" : v)}>
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
              <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                {teams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay equipos creados.</p>
                ) : (
                  teams.map((team) => (
                    <div key={team.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`new-team-${team.id}`}
                        checked={newTeamIds.includes(team.id)}
                        onCheckedChange={() => toggleNewTeam(team.id)}
                      />
                      <label htmlFor={`new-team-${team.id}`} className="text-sm cursor-pointer">
                        {team.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                {ALL_ROLES.map((role) => (
                  <div key={role} className="flex items-center gap-2">
                    <Checkbox
                      id={`new-role-${role}`}
                      checked={newRoles.includes(role)}
                      onCheckedChange={() => toggleNewRole(role)}
                    />
                    <label htmlFor={`new-role-${role}`} className="text-sm cursor-pointer">
                      {roleLabel(role)}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={handleCreateUser} disabled={createBusy} className="w-full">
              {createBusy ? "Creando..." : "Crear Usuario"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog (admin only) */}
      <Dialog open={!!pwdUser} onOpenChange={(o) => { if (!o) { setPwdUser(null); setPwdNew(""); setPwdConfirm(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Usuario: <strong>{pwdUser?.full_name || pwdUser?.email}</strong>
            </div>
            <div className="space-y-2">
              <Label>Nueva contraseña</Label>
              <Input type="password" value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} />
            </div>
            <div className="space-y-2">
              <Label>Confirmar nueva contraseña</Label>
              <Input type="password" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} placeholder="Repite la contraseña" minLength={6} />
              {pwdConfirm && pwdNew !== pwdConfirm && (
                <p className="text-sm text-destructive">Las contraseñas no coinciden</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPwdUser(null)} disabled={pwdBusy}>Cancelar</Button>
              <Button onClick={handleChangePassword} disabled={pwdBusy || !pwdNew || pwdNew !== pwdConfirm}>
                {pwdBusy ? "Actualizando..." : "Cambiar contraseña"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

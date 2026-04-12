import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, X, UserPlus } from "lucide-react";

interface Profile {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  members: TeamMember[];
}

export default function TeamManagement() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const [{ data: teamsData }, { data: membersData }, { data: profilesData }] = await Promise.all([
      supabase.from("teams").select("*"),
      supabase.from("team_members").select("*"),
      supabase.from("profiles").select("user_id, full_name, email"),
    ]);

    const profMap = new Map((profilesData || []).map((p) => [p.user_id, p]));

    const mapped = (teamsData || []).map((t) => ({
      ...t,
      members: (membersData || [])
        .filter((m) => m.team_id === t.id)
        .map((m) => ({
          id: m.id,
          user_id: m.user_id,
          full_name: profMap.get(m.user_id)?.full_name || null,
          email: profMap.get(m.user_id)?.email || null,
        })),
    }));
    setTeams(mapped);
    setProfiles(profilesData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("teams").insert({ name, description: description || null });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Equipo creado" });
      setOpen(false);
      setName("");
      setDescription("");
      fetchData();
    }
  };

  const addMember = async (teamId: string, userId: string) => {
    const { error } = await supabase.from("team_members").insert({ team_id: teamId, user_id: userId });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Miembro agregado" });
      fetchData();
    }
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from("team_members").delete().eq("id", memberId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Miembro eliminado" });
      fetchData();
    }
  };

  const openMembers = (team: Team) => {
    setSelectedTeam(team);
    setMembersOpen(true);
  };

  // Refresh selected team data when teams change
  useEffect(() => {
    if (selectedTeam) {
      const updated = teams.find((t) => t.id === selectedTeam.id);
      if (updated) setSelectedTeam(updated);
    }
  }, [teams]);

  const availableUsers = (team: Team) =>
    profiles.filter((p) => !team.members.some((m) => m.user_id === p.user_id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Equipos</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nuevo Equipo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Crear Equipo</DialogTitle></DialogHeader>
            <form onSubmit={createTeam} className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre del Equipo</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Ventas Región Norte" required />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción opcional" />
              </div>
              <Button type="submit" className="w-full">Crear Equipo</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Members dialog */}
      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Miembros — {selectedTeam?.name}</DialogTitle>
          </DialogHeader>
          {selectedTeam && (
            <div className="space-y-4">
              {/* Add member */}
              <div className="space-y-2">
                <Label>Agregar Miembro</Label>
                <Select onValueChange={(userId) => addMember(selectedTeam.id, userId)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar usuario..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers(selectedTeam).map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.full_name || p.email || p.user_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Members list */}
              <div className="space-y-2">
                <Label>Miembros Actuales ({selectedTeam.members.length})</Label>
                {selectedTeam.members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin miembros aún.</p>
                ) : (
                  <div className="space-y-1">
                    {selectedTeam.members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-2 rounded-md border">
                        <div>
                          <p className="text-sm font-medium">{m.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeMember(m.id)}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle>Todos los Equipos</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : teams.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No hay equipos creados aún.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Miembros</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.description || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {t.members.length}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.is_active ? "default" : "secondary"}>
                        {t.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => openMembers(t)}>
                        <UserPlus className="mr-1 h-4 w-4" /> Miembros
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

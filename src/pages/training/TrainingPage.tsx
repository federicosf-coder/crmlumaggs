import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  GraduationCap, ExternalLink, Upload, CheckCircle2, Clock, XCircle,
  ShieldAlert, Plus, Pencil, Trash2, Eye, FileCheck2, FileX2, Download,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
type TrainingStatus = "pendiente" | "enviado" | "aprobado" | "rechazado";

type AppRole = "admin" | "manager" | "sales" | "delivery" | "warehouse" | "customer_service" | "accounting";

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  manager: "Gerente",
  sales: "Ventas",
  delivery: "Entregas",
  warehouse: "Almacén",
  customer_service: "Servicio al Cliente",
  accounting: "Contabilidad",
};

interface Course {
  id: string;
  nombre: string;
  descripcion: string | null;
  url_externa: string | null;
  plaza_id: string | null;
  target_role: AppRole | null;
  excluded_user_ids: string[] | null;
  obligatorio: boolean;
  icon: string | null;
  is_active: boolean;
}

interface UserTraining {
  id: string;
  user_id: string;
  course_id: string;
  status: TrainingStatus;
  fecha_realizacion: string | null;
  evidencia_path: string | null;
  evidencia_mime: string | null;
  admin_comentarios: string | null;
  reviewed_at: string | null;
}

interface Plaza { id: string; nombre: string }
interface Profile { user_id: string; full_name: string | null; email: string | null; plaza_id: string | null }

const STATUS_META: Record<TrainingStatus, { label: string; cls: string; Icon: any }> = {
  pendiente:  { label: "Pendiente",  cls: "bg-muted text-muted-foreground", Icon: Clock },
  enviado:    { label: "En revisión", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300", Icon: Eye },
  aprobado:   { label: "Completado", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", Icon: CheckCircle2 },
  rechazado:  { label: "Rechazado",  cls: "bg-destructive/15 text-destructive", Icon: XCircle },
};

export default function TrainingPage() {
  const { user, profile, roles, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const isManager = hasRole("manager");

  const [courses, setCourses] = useState<Course[]>([]);
  const [myTrainings, setMyTrainings] = useState<UserTraining[]>([]);
  const [plazas, setPlazas] = useState<Plaza[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const [{ data: c }, { data: ut }, { data: pz }] = await Promise.all([
      supabase.from("training_courses").select("*").order("obligatorio", { ascending: false }).order("nombre"),
      supabase.from("user_trainings").select("*").eq("user_id", user!.id),
      supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre"),
    ]);
    setCourses((c as any) ?? []);
    setMyTrainings((ut as any) ?? []);
    setPlazas((pz as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user) reload(); /* eslint-disable-next-line */ }, [user]);

  const myCourses = useMemo(() => {
    return courses.filter((c) => {
      if (!c.is_active) return false;
      if (c.target_role && !roles.includes(c.target_role as any)) return false;
      if ((c.excluded_user_ids ?? []).includes(user!.id)) return false;
      return true;
    });
  }, [courses, roles, user]);

  const trainingByCourse = useMemo(() => {
    const m = new Map<string, UserTraining>();
    myTrainings.forEach((t) => m.set(t.course_id, t));
    return m;
  }, [myTrainings]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <GraduationCap className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Capacitación</h1>
          <p className="text-sm text-muted-foreground">Cursos asignados, evidencias y cumplimiento.</p>
        </div>
      </div>

      <Tabs defaultValue="mis">
        <TabsList>
          <TabsTrigger value="mis">Mis capacitaciones</TabsTrigger>
          {(isAdmin || isManager) && <TabsTrigger value="compliance">Cumplimiento</TabsTrigger>}
          {(isAdmin || isManager) && <TabsTrigger value="review">Validaciones</TabsTrigger>}
          {isAdmin && <TabsTrigger value="manage">Cursos</TabsTrigger>}
        </TabsList>

        <TabsContent value="mis" className="mt-4">
          <MyTrainingsGrid
            courses={myCourses}
            trainingByCourse={trainingByCourse}
            userId={user!.id}
            onChange={reload}
            loading={loading}
          />
        </TabsContent>

        {(isAdmin || isManager) && (
          <TabsContent value="compliance" className="mt-4">
            <ComplianceDashboard />
          </TabsContent>
        )}

        {(isAdmin || isManager) && (
          <TabsContent value="review" className="mt-4">
            <ReviewQueue isAdmin={isAdmin} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="manage" className="mt-4">
            <CoursesAdmin courses={courses} onChange={reload} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

/* ---------------- Sales: card grid ---------------- */
function MyTrainingsGrid({
  courses, trainingByCourse, userId, onChange, loading,
}: {
  courses: Course[];
  trainingByCourse: Map<string, UserTraining>;
  userId: string;
  onChange: () => void;
  loading: boolean;
}) {
  const [submitFor, setSubmitFor] = useState<Course | null>(null);

  if (loading) return <div className="text-muted-foreground">Cargando…</div>;
  if (courses.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No tienes capacitaciones asignadas todavía.
        </CardContent>
      </Card>
    );
  }

  const total = courses.length;
  const aprobados = courses.filter((c) => trainingByCourse.get(c.id)?.status === "aprobado").length;
  const pct = Math.round((aprobados / total) * 100);

  return (
    <div className="space-y-5">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="text-sm font-medium">Tu cumplimiento</div>
            <div className="text-xs text-muted-foreground">{aprobados} de {total} capacitaciones aprobadas</div>
          </div>
          <div className="text-2xl font-bold tabular-nums">{pct}%</div>
          <div className="w-48"><Progress value={pct} /></div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => {
          const t = trainingByCourse.get(course.id);
          const status = t?.status ?? "pendiente";
          const meta = STATUS_META[status];
          return (
            <Card key={course.id} className="flex flex-col overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center text-xl">
                    {course.icon || "🎓"}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {course.obligatorio && (
                      <Badge variant="destructive" className="gap-1">
                        <ShieldAlert className="h-3 w-3" /> Obligatorio
                      </Badge>
                    )}
                    <Badge variant="secondary" className={meta.cls}>
                      <meta.Icon className="h-3 w-3 mr-1" />
                      {meta.label}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-base mt-2">{course.nombre}</CardTitle>
                {course.descripcion && (
                  <CardDescription className="line-clamp-3">{course.descripcion}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="mt-auto pt-0 space-y-2">
                {status === "rechazado" && t?.admin_comentarios && (
                  <div className="text-xs p-2 rounded bg-destructive/10 text-destructive">
                    <strong>Observación:</strong> {t.admin_comentarios}
                  </div>
                )}
                {status === "aprobado" && t?.fecha_realizacion && (
                  <div className="text-xs text-emerald-700 dark:text-emerald-400">
                    Aprobado · realizado el {t.fecha_realizacion}
                  </div>
                )}
                <div className="flex gap-2">
                  {course.url_externa && (
                    <Button asChild variant="default" size="sm" className="flex-1">
                      <a href={course.url_externa} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-1" /> Acceder
                      </a>
                    </Button>
                  )}
                  <Button
                    variant={status === "aprobado" ? "outline" : "secondary"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setSubmitFor(course)}
                    disabled={status === "aprobado" || status === "enviado"}
                  >
                    {status === "aprobado" ? <CheckCircle2 className="h-4 w-4 mr-1 text-emerald-600" /> : <Upload className="h-4 w-4 mr-1" />}
                    {status === "aprobado" ? "Completado" : status === "enviado" ? "En revisión" : status === "rechazado" ? "Reenviar" : "Registrar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {submitFor && (
        <SubmitEvidenceDialog
          course={submitFor}
          existing={trainingByCourse.get(submitFor.id)}
          userId={userId}
          onClose={() => setSubmitFor(null)}
          onSaved={() => { setSubmitFor(null); onChange(); }}
        />
      )}
    </div>
  );
}

function SubmitEvidenceDialog({
  course, existing, userId, onClose, onSaved,
}: {
  course: Course;
  existing?: UserTraining;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState<string>(existing?.fecha_realizacion || today);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!file && !existing?.evidencia_path) {
      toast({ title: "Falta el comprobante", description: "Sube un PDF o imagen.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      let path = existing?.evidencia_path ?? null;
      let mime = existing?.evidencia_mime ?? null;
      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        path = `${userId}/${course.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("training-evidence")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (upErr) throw upErr;
        mime = file.type;
      }
      const payload: any = {
        user_id: userId,
        course_id: course.id,
        status: "enviado" as TrainingStatus,
        fecha_realizacion: fecha,
        evidencia_path: path,
        evidencia_mime: mime,
        submitted_at: new Date().toISOString(),
        admin_comentarios: null,
      };
      const { error } = await supabase.from("user_trainings").upsert(payload, { onConflict: "user_id,course_id" });
      if (error) throw error;
      toast({ title: "Evidencia enviada", description: "Pendiente de validación por administrador." });
      onSaved();
    } catch (e: any) {
      toast({ title: "Error al enviar", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar finalización</DialogTitle>
          <DialogDescription className="break-words">{course.nombre}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Fecha en que la realizaste</Label>
            <Input type="date" value={fecha} max={today} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <Label>Comprobante (PDF, JPG o PNG)</Label>
            <Input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {existing?.evidencia_path && !file && (
              <p className="text-xs text-muted-foreground mt-1">
                Hay un comprobante previo cargado. Sube uno nuevo solo si quieres reemplazarlo.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Enviando…" : "Enviar para validación"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Admin: courses CRUD ---------------- */
function CoursesAdmin({ courses, onChange }: { courses: Course[]; onChange: () => void }) {
  const [editing, setEditing] = useState<Partial<Course> | null>(null);

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar curso? Se borrarán también los registros de los usuarios.")) return;
    const { error } = await supabase.from("training_courses").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Curso eliminado" }); onChange(); }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ obligatorio: false, is_active: true, icon: "🎓" })}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo curso
        </Button>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="py-2">Curso</TableHead>
              <TableHead className="py-2">Rol</TableHead>
              <TableHead className="py-2">Obligatorio</TableHead>
              <TableHead className="py-2">Activo</TableHead>
              <TableHead className="py-2"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="py-2">
                  <div className="flex items-center gap-2">
                    <span>{c.icon || "🎓"}</span>
                    <div>
                      <div className="font-medium">{c.nombre}</div>
                      {c.url_externa && <div className="text-xs text-muted-foreground truncate max-w-xs">{c.url_externa}</div>}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-2 text-sm">{c.target_role ? ROLE_LABELS[c.target_role] : "Todos"}</TableCell>
                <TableCell className="py-2">{c.obligatorio ? <Badge variant="destructive">Sí</Badge> : <span className="text-muted-foreground">No</span>}</TableCell>
                <TableCell className="py-2">{c.is_active ? <Badge variant="secondary">Activo</Badge> : <Badge variant="outline">Inactivo</Badge>}</TableCell>
                <TableCell className="py-2 text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {courses.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sin cursos.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {editing && (
        <CourseEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChange(); }}
        />
      )}
    </div>
  );
}

function CourseEditor({
  initial, onClose, onSaved,
}: { initial: Partial<Course>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Course>>(initial);
  const [busy, setBusy] = useState(false);
  const [eligibleUsers, setEligibleUsers] = useState<{ user_id: string; full_name: string | null; email: string | null }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const excluded = new Set<string>(form.excluded_user_ids ?? []);

  useEffect(() => {
    (async () => {
      setLoadingUsers(true);
      let userIds: string[] | null = null;
      if (form.target_role) {
        const { data: ur } = await supabase.from("user_roles").select("user_id").eq("role", form.target_role);
        userIds = (ur ?? []).map((r: any) => r.user_id);
        if (userIds.length === 0) { setEligibleUsers([]); setLoadingUsers(false); return; }
      }
      let q = supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("approval_status", "aprobado")
        .eq("is_active", true)
        .order("full_name");
      if (userIds) q = q.in("user_id", userIds);
      const { data } = await q;
      setEligibleUsers((data as any) ?? []);
      setLoadingUsers(false);
    })();
  }, [form.target_role]);

  const toggleExclude = (userId: string) => {
    const next = new Set(excluded);
    if (next.has(userId)) next.delete(userId); else next.add(userId);
    setForm({ ...form, excluded_user_ids: Array.from(next) });
  };

  const save = async () => {
    if (!form.nombre?.trim()) { toast({ title: "Nombre requerido", variant: "destructive" }); return; }
    setBusy(true);
    const payload = {
      nombre: form.nombre,
      descripcion: form.descripcion ?? null,
      url_externa: form.url_externa ?? null,
      plaza_id: null,
      target_role: form.target_role || null,
      excluded_user_ids: form.excluded_user_ids ?? [],
      obligatorio: !!form.obligatorio,
      icon: form.icon ?? "🎓",
      is_active: form.is_active ?? true,
    };
    const { error } = form.id
      ? await supabase.from("training_courses").update(payload).eq("id", form.id)
      : await supabase.from("training_courses").insert(payload as any);
    setBusy(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Guardado" });
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{form.id ? "Editar curso" : "Nuevo curso"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div>
              <Label>Ícono</Label>
              <Input value={form.icon ?? ""} onChange={(e) => setForm({ ...form, icon: e.target.value })} maxLength={4} />
            </div>
            <div>
              <Label>Nombre *</Label>
              <Input value={form.nombre ?? ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea rows={3} value={form.descripcion ?? ""} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <div>
            <Label>URL externa</Label>
            <Input placeholder="https://…" value={form.url_externa ?? ""} onChange={(e) => setForm({ ...form, url_externa: e.target.value })} />
          </div>
          <div>
            <Label>Rol objetivo</Label>
            <Select
              value={form.target_role || "all"}
              onValueChange={(v) => setForm({ ...form, target_role: v === "all" ? null : (v as AppRole), excluded_user_ids: [] })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Usuarios asignados ({eligibleUsers.length - excluded.size}/{eligibleUsers.length})</Label>
              <div className="flex gap-2">
                <button type="button" className="text-xs text-primary hover:underline"
                  onClick={() => setForm({ ...form, excluded_user_ids: [] })}>
                  Marcar todos
                </button>
                <button type="button" className="text-xs text-muted-foreground hover:underline"
                  onClick={() => setForm({ ...form, excluded_user_ids: eligibleUsers.map((u) => u.user_id) })}>
                  Desmarcar todos
                </button>
              </div>
            </div>
            <div className="border rounded-md max-h-56 overflow-y-auto divide-y">
              {loadingUsers && <div className="p-3 text-sm text-muted-foreground">Cargando usuarios…</div>}
              {!loadingUsers && eligibleUsers.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">No hay usuarios para el rol seleccionado.</div>
              )}
              {eligibleUsers.map((u) => {
                const checked = !excluded.has(u.user_id);
                return (
                  <label key={u.user_id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleExclude(u.user_id)}
                      className="h-4 w-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{u.full_name || u.email}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Desmarca a quienes no deban tomar este curso.</p>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2"><Switch checked={!!form.obligatorio} onCheckedChange={(v) => setForm({ ...form, obligatorio: v })} /> Obligatorio</label>
            <label className="flex items-center gap-2"><Switch checked={form.is_active ?? true} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /> Activo</label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Admin: review queue ---------------- */
function ReviewQueue({ isAdmin }: { isAdmin: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TrainingStatus | "all">("enviado");
  const [comment, setComment] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("user_trainings")
      .select("*, course:training_courses(nombre, obligatorio)")
      .order("submitted_at", { ascending: false });
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data } = await q;
    // The FK above may not exist; do a manual join fallback if needed
    if (!data) {
      setRows([]);
    } else {
      setRows(data as any);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  // Manual fallback: if profile join didn't resolve, fetch profiles separately
  useEffect(() => {
    (async () => {
      const need = rows.filter((r) => !r.profile);
      if (need.length === 0) return;
      const ids = Array.from(new Set(need.map((r) => r.user_id)));
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name, email, plaza_id").in("user_id", ids);
      if (!profs) return;
      const m = new Map(profs.map((p: any) => [p.user_id, p]));
      setRows((rs) => rs.map((r) => ({ ...r, profile: r.profile ?? m.get(r.user_id) })));
    })();
  }, [rows.length]);

  const openEvidence = async (path: string) => {
    const { data } = await supabase.storage.from("training-evidence").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    else toast({ title: "No se pudo abrir el archivo", variant: "destructive" });
  };

  const decide = async (row: any, status: "aprobado" | "rechazado") => {
    if (!isAdmin) return;
    const { error } = await supabase.from("user_trainings").update({
      status,
      admin_comentarios: comment[row.id] ?? row.admin_comentarios ?? null,
      reviewed_by: (await supabase.auth.getUser()).data.user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", row.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: status === "aprobado" ? "Visto bueno otorgado" : "Evidencia rechazada" }); load(); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle>Cola de validación</CardTitle>
          <CardDescription>Revisa y otorga el visto bueno (VGB) a las evidencias enviadas.</CardDescription>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="enviado">Pendientes</SelectItem>
            <SelectItem value="aprobado">Aprobados</SelectItem>
            <SelectItem value="rechazado">Rechazados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="py-2">Vendedor</TableHead>
              <TableHead className="py-2">Capacitación</TableHead>
              <TableHead className="py-2">Realizada</TableHead>
              <TableHead className="py-2">Evidencia</TableHead>
              <TableHead className="py-2">Estatus</TableHead>
              {isAdmin && <TableHead className="py-2">Comentario / Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Cargando…</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Sin registros.</TableCell></TableRow>}
            {rows.map((r) => {
              const meta = STATUS_META[r.status as TrainingStatus];
              return (
                <TableRow key={r.id}>
                  <TableCell className="py-2">
                    <div className="font-medium">{r.profile?.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.profile?.email}</div>
                  </TableCell>
                  <TableCell className="py-2">{r.course?.nombre} {r.course?.obligatorio && <Badge variant="destructive" className="ml-1 text-[10px]">Obligatorio</Badge>}</TableCell>
                  <TableCell className="py-2 text-sm">{r.fecha_realizacion || "—"}</TableCell>
                  <TableCell className="py-2">
                    {r.evidencia_path ? (
                      <Button variant="ghost" size="sm" onClick={() => openEvidence(r.evidencia_path)}>
                        <Download className="h-4 w-4 mr-1" /> Ver
                      </Button>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="py-2"><Badge variant="secondary" className={meta.cls}><meta.Icon className="h-3 w-3 mr-1" />{meta.label}</Badge></TableCell>
                  {isAdmin && (
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2 min-w-[280px]">
                        <Input
                          placeholder="Comentario (opcional para aprobar; recomendado al rechazar)"
                          defaultValue={r.admin_comentarios ?? ""}
                          onChange={(e) => setComment((c) => ({ ...c, [r.id]: e.target.value }))}
                          className="h-8"
                        />
                        <Button size="sm" variant="default" onClick={() => decide(r, "aprobado")}><FileCheck2 className="h-4 w-4" /></Button>
                        <Button size="sm" variant="destructive" onClick={() => decide(r, "rechazado")}><FileX2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------------- Admin/Manager: compliance dashboard ---------------- */
function ComplianceDashboard() {
  const [data, setData] = useState<{ profile: Profile; total: number; aprobados: number; pct: number }[]>([]);
  const [byPlaza, setByPlaza] = useState<{ plaza: string; pct: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: profs }, { data: courses }, { data: ut }, { data: plazas }, { data: ur }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, email, plaza_id").eq("approval_status", "aprobado").eq("is_active", true),
        supabase.from("training_courses").select("id, plaza_id, target_role, excluded_user_ids, is_active").eq("is_active", true),
        supabase.from("user_trainings").select("user_id, course_id, status"),
        supabase.from("plazas").select("id, nombre"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const plazaMap = new Map((plazas ?? []).map((p: any) => [p.id, p.nombre]));
      const rolesByUser = new Map<string, Set<string>>();
      (ur ?? []).forEach((r: any) => {
        if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, new Set());
        rolesByUser.get(r.user_id)!.add(r.role);
      });
      const utMap = new Map<string, TrainingStatus>();
      (ut ?? []).forEach((t: any) => utMap.set(`${t.user_id}:${t.course_id}`, t.status));
      const rows = (profs ?? []).map((p: any) => {
        const userRoles = rolesByUser.get(p.user_id) ?? new Set<string>();
        const applicable = (courses ?? []).filter((c: any) => {
          if (c.target_role && !userRoles.has(c.target_role)) return false;
          if ((c.excluded_user_ids ?? []).includes(p.user_id)) return false;
          return true;
        });
        const total = applicable.length;
        const aprobados = applicable.filter((c: any) => utMap.get(`${p.user_id}:${c.id}`) === "aprobado").length;
        return { profile: p, total, aprobados, pct: total ? Math.round((aprobados / total) * 100) : 0 };
      }).sort((a, b) => a.pct - b.pct);
      setData(rows);
      // by plaza
      const grouped = new Map<string, { a: number; t: number }>();
      rows.forEach((r) => {
        const key = plazaMap.get(r.profile.plaza_id ?? "") || "Sin plaza";
        const g = grouped.get(key) ?? { a: 0, t: 0 };
        g.a += r.aprobados; g.t += r.total;
        grouped.set(key, g);
      });
      setByPlaza(Array.from(grouped.entries()).map(([plaza, v]) => ({ plaza, pct: v.t ? Math.round((v.a / v.t) * 100) : 0 })));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {byPlaza.map((p) => (
          <Card key={p.plaza}>
            <CardContent className="py-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">{p.plaza}</div>
              <div className="text-3xl font-bold tabular-nums">{p.pct}%</div>
              <Progress value={p.pct} className="mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Cumplimiento por vendedor</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2">Vendedor</TableHead>
                <TableHead className="py-2 w-32">Aprobados</TableHead>
                <TableHead className="py-2">Avance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.profile.user_id}>
                  <TableCell className="py-2">
                    <div className="font-medium">{r.profile.full_name || r.profile.email}</div>
                    <div className="text-xs text-muted-foreground">{r.profile.email}</div>
                  </TableCell>
                  <TableCell className="py-2 text-sm tabular-nums">{r.aprobados} / {r.total}</TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <Progress value={r.pct} className="flex-1" />
                      <span className="text-sm tabular-nums w-10 text-right">{r.pct}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">Sin datos.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
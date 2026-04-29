import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useModuleAccess, type AccessLevel } from "@/hooks/useModuleAccess";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Building2, User, Search, Pencil, LayoutList, LayoutGrid, Phone, MapPin, CheckSquare, Trash2, Download, Upload, Mail, Globe, Briefcase, Users, Tag, FileText } from "lucide-react";
import { Merge } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { SortMenu } from "@/components/SortMenu";
import { CompanyFormDialog, type CompanyData, FORMA_PAGO_OPTS, LISTA_PRECIOS_OPTIONS } from "@/components/CompanyFormDialog";
import { ContactFormDialog, type ContactEditData } from "@/components/ContactFormDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { BulkEditDialog } from "@/components/BulkEditDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ImportExportMenu } from "@/components/ImportExportMenu";
import { fetchAllRows } from "@/lib/supabasePagination";
import { AddressDisplay } from "@/components/AddressDisplay";
import { MergeDuplicatesDialog } from "@/components/directory/MergeDuplicatesDialog";

interface Company {
  id: string; name: string; razon_social: string | null; industry: string | null; phone: string | null;
  email: string | null; city: string | null; is_active: boolean;
  address: string | null; state: string | null; zip_code: string | null;
  website: string | null; notes: string | null; plaza_id: string | null;
  lista_precios: string | null; industrias: string[] | null;
  tipo_destino_lubricante: string | null; potencial_unidades: string | null;
  tomador_decision: string | null; riesgo_cambio_marca: string | null;
  origen_contacto: string | null; evaluacion_lubricante: string | null;
  rol_lubricante: string | null; tipo_cliente_comercial: string | null;
  id_contpaq: string | null;
  tipo_pago: string | null; forma_pago: string | null; metodo_pago: string | null; uso_cfdi: string | null;
  plazas?: { nombre: string } | null;
  contacts?: { id: string }[];
}

interface Contact {
  id: string; first_name: string; last_name: string; email: string | null;
  phone: string | null; mobile: string | null; job_title: string | null;
  department: string | null; notes: string | null; is_active: boolean;
  company_id: string | null;
  companies?: { name: string; plazas?: { nombre: string } | null } | null;
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}

const TIPO_PAGO_LABEL: Record<string, string> = {
  contado: "Contado",
  credito: "Crédito",
  credito_cescemex: "Crédito Cescemex",
};
const METODO_PAGO_LABEL: Record<string, string> = {
  PUE: "PUE - Pago en una sola exhibición",
  PPD: "PPD - Pago en parcialidades o diferido",
};
const formaPagoLabel = (v?: string | null) => {
  if (!v) return null;
  return FORMA_PAGO_OPTS.find(o => o.v === v)?.l || v;
};
const listaPreciosLabel = (v?: string | null) => {
  if (!v) return null;
  return LISTA_PRECIOS_OPTIONS.find(o => o.v === v)?.l || v;
};

const TAB_COLORS: Record<string, { active: string; border: string }> = {
  companies: { active: "bg-blue-600 text-white hover:bg-blue-700", border: "border-blue-500" },
  contacts: { active: "bg-emerald-600 text-white hover:bg-emerald-700", border: "border-emerald-500" },
};

export default function Directory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "companies";
  const selectId = searchParams.get("select");
  const { hasRole } = useAuth();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [companySearch, setCompanySearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [companyOpen, setCompanyOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [editCompany, setEditCompany] = useState<CompanyData | null>(null);
  const [companyView, setCompanyView] = useState<"list" | "cards">("list");
  const [contactView, setContactView] = useState<"list" | "cards">("list");
  const [companySort, setCompanySort] = useState("name_asc");
  const [contactSort, setContactSort] = useState("last_name_asc");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [editContact, setEditContact] = useState<ContactEditData | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  const access = useModuleAccess("directorio");

  const setTab = (tab: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    }, { replace: true });
  };

  // Profiles for ejecutivo display
  const { data: allProfiles = [] } = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email");
      return data || [];
    },
  });

  const { data: plazasList = [] } = useQuery({
    queryKey: ["plazas_bulk"],
    queryFn: async () => {
      const { data } = await supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre");
      return data || [];
    },
  });

  // Company ejecutivos for selected company
  const { data: selectedCompanyEjecutivos = [] } = useQuery({
    queryKey: ["company_ejecutivos_detail", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data } = await supabase.from("company_ejecutivos").select("user_id").eq("company_id", selectedCompany.id);
      return (data || []).map((ce: any) => ce.user_id);
    },
    enabled: !!selectedCompany?.id,
  });

  // Contactos vinculados a la empresa seleccionada (para vista detalle)
  const { data: selectedCompanyContacts = [] } = useQuery({
    queryKey: ["company_contacts_detail", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, mobile, job_title")
        .eq("company_id", selectedCompany.id)
        .eq("is_active", true)
        .order("first_name");
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  // Contact ejecutivos for selected contact
  const { data: selectedContactEjecutivos = [] } = useQuery({
    queryKey: ["contact_ejecutivos_detail", selectedContact?.id],
    queryFn: async () => {
      if (!selectedContact?.id) return [];
      const { data } = await supabase.from("contact_ejecutivos").select("user_id").eq("contact_id", selectedContact.id);
      return (data || []).map((ce: any) => ce.user_id);
    },
    enabled: !!selectedContact?.id,
  });

  const getEjecutivoNames = (userIds: string[]) => {
    return userIds.map(uid => {
      const p = allProfiles.find((pr: any) => pr.user_id === uid);
      return p?.full_name || p?.email || "—";
    });
  };

  const fetchData = async () => {
    if (access.isLoading || !access.canView) { setLoading(false); return; }
    setLoading(true);
    const buildCompaniesQuery = () => {
      let q = supabase.from("companies").select("*, plazas(nombre), contacts(id)").order("name");

      if (access.accessLevel === "propio" && access.userId) {
        const userId = access.userId;
        return companyAssignedIds.length > 0
          ? q.or(`created_by.eq.${userId},created_by.is.null,id.in.(${companyAssignedIds.join(",")})`)
          : q.or(`created_by.eq.${userId},created_by.is.null`);
      }

      if (access.accessLevel === "equipo" && access.teamMemberIds.length > 0) {
        const teamCsv = access.teamMemberIds.join(",");
        return companyAssignedIds.length > 0
          ? q.or(`created_by.in.(${teamCsv}),created_by.is.null,id.in.(${companyAssignedIds.join(",")})`)
          : q.or(`created_by.in.(${teamCsv}),created_by.is.null`);
      }

      return q;
    };

    const buildContactsQuery = () => {
      let q = supabase.from("contacts").select("*, companies(name, plazas(nombre))").order("last_name");

      if (access.accessLevel === "propio" && access.userId) {
        const userId = access.userId;
        return contactAssignedIds.length > 0
          ? q.or(`created_by.eq.${userId},created_by.is.null,id.in.(${contactAssignedIds.join(",")})`)
          : q.or(`created_by.eq.${userId},created_by.is.null`);
      }

      if (access.accessLevel === "equipo" && access.teamMemberIds.length > 0) {
        const teamCsv = access.teamMemberIds.join(",");
        return contactAssignedIds.length > 0
          ? q.or(`created_by.in.(${teamCsv}),created_by.is.null,id.in.(${contactAssignedIds.join(",")})`)
          : q.or(`created_by.in.(${teamCsv}),created_by.is.null`);
      }

      return q;
    };

    let companyAssignedIds: string[] = [];
    let contactAssignedIds: string[] = [];

    if (access.accessLevel === "propio" && access.userId) {
      const userIds = [access.userId];
      const [{ data: coAssign }, { data: ctAssign }] = await Promise.all([
        supabase.from("company_ejecutivos").select("company_id").in("user_id", userIds),
        supabase.from("contact_ejecutivos").select("contact_id").in("user_id", userIds),
      ]);
      companyAssignedIds = Array.from(new Set((coAssign || []).map((r: any) => r.company_id)));
      contactAssignedIds = Array.from(new Set((ctAssign || []).map((r: any) => r.contact_id)));
    } else if (access.accessLevel === "equipo" && access.teamMemberIds.length > 0) {
      const teamIds = access.teamMemberIds;
      const [{ data: coAssign }, { data: ctAssign }] = await Promise.all([
        supabase.from("company_ejecutivos").select("company_id").in("user_id", teamIds),
        supabase.from("contact_ejecutivos").select("contact_id").in("user_id", teamIds),
      ]);
      companyAssignedIds = Array.from(new Set((coAssign || []).map((r: any) => r.company_id)));
      contactAssignedIds = Array.from(new Set((ctAssign || []).map((r: any) => r.contact_id)));
    }

    const [co, ct] = await Promise.all([
      fetchAllRows<Company>((from, to) => buildCompaniesQuery().range(from, to)),
      fetchAllRows<Contact>((from, to) => buildContactsQuery().range(from, to)),
    ]);
    setCompanies(co);
    setContacts(ct);
    setLoading(false);
  };

  useEffect(() => { if (!access.isLoading) fetchData(); }, [access.isLoading, access.accessLevel]);

  // Deep link: open detail when ?select=<id> matches a company/contact
  useEffect(() => {
    if (!selectId) return;
    if (activeTab === "companies") {
      const found = companies.find((c) => c.id === selectId);
      if (found) {
        setSelectedCompany(found);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete("select");
          return next;
        }, { replace: true });
      }
    } else if (activeTab === "contacts") {
      const found = contacts.find((c) => c.id === selectId);
      if (found) {
        setSelectedContact(found);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete("select");
          return next;
        }, { replace: true });
      }
    }
  }, [selectId, activeTab, companies, contacts, setSearchParams]);

  const filteredCompanies = companies
    .filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()))
    .sort((a, b) => {
      switch (companySort) {
        case "name_asc": return a.name.localeCompare(b.name);
        case "name_desc": return b.name.localeCompare(a.name);
        case "industry": return (a.industry || "").localeCompare(b.industry || "");
        case "plaza": return ((a.plazas as any)?.nombre || "").localeCompare((b.plazas as any)?.nombre || "");
        case "contacts_desc": return ((b.contacts as any[])?.length || 0) - ((a.contacts as any[])?.length || 0);
        default: return 0;
      }
    });
  const filteredContacts = contacts
    .filter(c =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(contactSearch.toLowerCase()) ||
      (c.companies?.name || "").toLowerCase().includes(contactSearch.toLowerCase())
    )
    .sort((a, b) => {
      switch (contactSort) {
        case "last_name_asc": return a.last_name.localeCompare(b.last_name);
        case "last_name_desc": return b.last_name.localeCompare(a.last_name);
        case "first_name_asc": return a.first_name.localeCompare(b.first_name);
        case "company": return (a.companies?.name || "").localeCompare(b.companies?.name || "");
        default: return 0;
      }
    });

  const search = activeTab === "companies" ? companySearch : contactSearch;
  const setSearch = activeTab === "companies" ? setCompanySearch : setContactSearch;
  const view = activeTab === "companies" ? companyView : contactView;
  const setView = activeTab === "companies" ? setCompanyView : setContactView;
  const tabColor = TAB_COLORS[activeTab] || TAB_COLORS.companies;

  const selectedIds = activeTab === "companies" ? selectedCompanyIds : selectedContactIds;
  const setSelectedIds = activeTab === "companies" ? setSelectedCompanyIds : setSelectedContactIds;
  const currentList = activeTab === "companies" ? filteredCompanies : filteredContacts;

  const toggleSelectAll = () => {
    if (selectedIds.size === currentList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentList.map(i => i.id)));
    }
  };

  const handleBulkToggleActive = async (active: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const table = activeTab === "companies" ? "companies" : "contacts";
      const { error } = await supabase.from(table).update({ is_active: active }).in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} registro(s) ${active ? "activados" : "desactivados"}`);
      setSelectedIds(new Set());
      fetchData();
    } catch (err: any) {
      toast.error("Error: " + (err.message || "Error"));
    }
  };

  return (
    <div className="space-y-4">
      {/* Header — matches Documentos */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Directorio</h1>
          <p className="text-muted-foreground text-sm">
            {activeTab === "companies"
              ? `${filteredCompanies.length} de ${companies.length} empresas`
              : `${filteredContacts.length} de ${contacts.length} contactos`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasRole("admin") && (
            <ImportExportMenu
              table={activeTab === "companies" ? "companies" : "contacts"}
              entityLabel={activeTab === "companies" ? "Empresas" : "Contactos"}
              upsertKey={activeTab === "companies" ? "name" : "email"}
              fields={activeTab === "companies" ? [
                { key: "id", label: "ID", importable: false },
                { key: "name", label: "Nombre Comercial", importable: true },
                { key: "razon_social", label: "Razón Social", importable: true },
                { key: "id_contpaq", label: "ID Contpaq", importable: true },
                { key: "industry", label: "Industria", importable: true },
                { key: "industrias", label: "Industrias", importable: true },
                { key: "phone", label: "Teléfono", importable: true },
                { key: "email", label: "Correo", importable: true },
                { key: "website", label: "Sitio Web", importable: true },
                { key: "address", label: "Dirección", importable: true },
                { key: "city", label: "Ciudad", importable: true },
                { key: "state", label: "Estado", importable: true },
                { key: "zip_code", label: "Código Postal", importable: true },
                { key: "plaza_id", label: "Plaza ID", importable: true },
                { key: "lista_precios", label: "Lista de Precios", importable: true },
                { key: "tipo_pago", label: "Tipo de Pago", importable: true },
                { key: "metodo_pago", label: "Método de Pago", importable: true },
                { key: "uso_cfdi", label: "Uso CFDI", importable: true },
                { key: "tipo_cliente_comercial", label: "Tipo Cliente Comercial", importable: true },
                { key: "origen_contacto", label: "Origen Contacto", importable: true },
                { key: "tomador_decision", label: "Tomador Decisión", importable: true },
                { key: "potencial_unidades", label: "Potencial Unidades", importable: true },
                { key: "tipo_destino_lubricante", label: "Tipo Destino Lubricante", importable: true },
                { key: "rol_lubricante", label: "Rol Lubricante", importable: true },
                { key: "evaluacion_lubricante", label: "Evaluación Lubricante", importable: true },
                { key: "riesgo_cambio_marca", label: "Riesgo Cambio Marca", importable: true },
                { key: "equipo", label: "Equipo", importable: true },
                { key: "notes", label: "Notas", importable: true },
                { key: "is_active", label: "Activo", importable: true },
                { key: "created_by", label: "Creado por", importable: false },
                { key: "created_at", label: "Creado", importable: false },
                { key: "updated_at", label: "Actualizado", importable: false },
              ] : [
                { key: "id", label: "ID", importable: false },
                { key: "first_name", label: "Nombre", importable: true },
                { key: "last_name", label: "Apellido", importable: true },
                { key: "email", label: "Correo", importable: true },
                { key: "phone", label: "Teléfono", importable: true },
                { key: "mobile", label: "Celular / WhatsApp", importable: true },
                { key: "job_title", label: "Puesto", importable: true },
                { key: "department", label: "Departamento", importable: true },
                { key: "company_id", label: "Empresa ID", importable: true },
                { key: "notes", label: "Notas", importable: true },
                { key: "is_active", label: "Activo", importable: true },
                { key: "created_by", label: "Creado por", importable: false },
                { key: "created_at", label: "Creado", importable: false },
                { key: "updated_at", label: "Actualizado", importable: false },
              ]}
              data={activeTab === "companies" ? filteredCompanies : filteredContacts}
              onImported={fetchData}
            />
          )}
          <Button
            size="sm"
            onClick={() => activeTab === "companies" ? setCompanyOpen(true) : setContactOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            {activeTab === "companies" ? "Agregar Empresa" : "Agregar Contacto"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMergeOpen(true)}>
            <Merge className="mr-1 h-4 w-4" />
            Fusionar duplicados
          </Button>
        </div>
      </div>

      {/* Tabs — button style matching Documentos */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[
            { value: "companies", label: "Empresas", icon: Building2 },
            { value: "contacts", label: "Contactos", icon: User },
          ].map((tab) => {
            const isActive = activeTab === tab.value;
            const colors = TAB_COLORS[tab.value];
            return (
              <Button
                key={tab.value}
                size="sm"
                className={`transition-all duration-150 gap-1.5 ${isActive ? colors.active : "bg-background text-foreground border border-input hover:bg-accent"}`}
                variant={isActive ? "default" : "outline"}
                onClick={() => setTab(tab.value)}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </Button>
            );
          })}
        </div>
        <div className="flex gap-1">
          <Button variant={view === "list" ? "default" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setView("list")}>
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button variant={view === "cards" ? "default" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setView("cards")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <Card className={`border-t-2 ${tabColor.border}`}>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={activeTab === "companies" ? "Buscar empresas..." : "Buscar contactos..."}
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <SortMenu
              value={activeTab === "companies" ? companySort : contactSort}
              onChange={activeTab === "companies" ? setCompanySort : setContactSort}
              options={activeTab === "companies" ? [
                { value: "name_asc", label: "Nombre A-Z" },
                { value: "name_desc", label: "Nombre Z-A" },
                { value: "industry", label: "Industria" },
                { value: "plaza", label: "Plaza" },
                { value: "contacts_desc", label: "Más contactos" },
              ] : [
                { value: "last_name_asc", label: "Apellido A-Z" },
                { value: "last_name_desc", label: "Apellido Z-A" },
                { value: "first_name_asc", label: "Nombre A-Z" },
                { value: "company", label: "Empresa" },
              ]}
            />
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 mb-2 bg-muted rounded-md">
              <CheckSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{selectedIds.size} seleccionado(s)</span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Deseleccionar</Button>
              <Button variant="outline" size="sm" onClick={() => setBulkEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-1" /> Editar seleccionados
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleBulkToggleActive(true)}>Activar</Button>
              <Button variant="outline" size="sm" onClick={() => handleBulkToggleActive(false)}>Desactivar</Button>
            </div>
          )}
          {activeTab === "companies" ? (
            /* ─── EMPRESAS ─── */
            loading ? (
              <p className="text-center py-8 text-muted-foreground">Cargando...</p>
            ) : filteredCompanies.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No se encontraron empresas</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Agrega una empresa para comenzar</p>
              </div>
            ) : companyView === "list" ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={filteredCompanies.length > 0 && selectedCompanyIds.size === filteredCompanies.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="w-[110px]">ID Contpaq</TableHead>
                      <TableHead className="hidden sm:table-cell">Industria</TableHead>
                      <TableHead>Contactos</TableHead>
                      <TableHead className="hidden md:table-cell">Plaza</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map(c => (
                      <TableRow key={c.id} className={`cursor-pointer transition-colors duration-150 hover:bg-muted/50 ${selectedCompanyIds.has(c.id) ? "bg-muted/30" : ""}`} onClick={() => setSelectedCompany(c)}>
                        <TableCell className="w-10" onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedCompanyIds.has(c.id)}
                            onCheckedChange={() => {
                              setSelectedCompanyIds(prev => {
                                const next = new Set(prev);
                                next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                                return next;
                              });
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="font-mono text-xs">{c.id_contpaq || "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell">{c.industry || "—"}</TableCell>
                        <TableCell>{(c.contacts as any[])?.length || 0}</TableCell>
                        <TableCell className="hidden md:table-cell">{(c.plazas as any)?.nombre || "—"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${c.is_active ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-700 border-slate-300"}`}>
                            {c.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCompanies.map(c => (
                  <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedCompany(c)}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-base">{c.name}</h3>
                          <p className="text-sm text-muted-foreground">{c.industry || "Sin industria"}</p>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${c.is_active ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-700 border-slate-300"}`}>
                          {c.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" /> {(c.contacts as any[])?.length || 0} contactos
                        </span>
                        {(c.plazas as any)?.nombre && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" /> {(c.plazas as any).nombre}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          ) : (
            /* ─── CONTACTOS ─── */
            loading ? (
              <p className="text-center py-8 text-muted-foreground">Cargando...</p>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-12">
                <User className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No se encontraron contactos</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Agrega un contacto para comenzar</p>
              </div>
            ) : contactView === "list" ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={filteredContacts.length > 0 && selectedContactIds.size === filteredContacts.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Apellido</TableHead>
                      <TableHead className="hidden sm:table-cell">Celular / WhatsApp</TableHead>
                      <TableHead className="hidden sm:table-cell">Empresa</TableHead>
                      <TableHead className="hidden md:table-cell">Plaza</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map(c => (
                      <TableRow key={c.id} className={`cursor-pointer transition-colors duration-150 hover:bg-muted/50 ${selectedContactIds.has(c.id) ? "bg-muted/30" : ""}`} onClick={() => setSelectedContact(c)}>
                        <TableCell className="w-10" onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedContactIds.has(c.id)}
                            onCheckedChange={() => {
                              setSelectedContactIds(prev => {
                                const next = new Set(prev);
                                next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                                return next;
                              });
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{c.first_name}</TableCell>
                        <TableCell>{c.last_name}</TableCell>
                        <TableCell className="hidden sm:table-cell">{c.mobile || "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell">{c.companies?.name || "—"}</TableCell>
                        <TableCell className="hidden md:table-cell">{(c.companies?.plazas as any)?.nombre || "—"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${c.is_active ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-700 border-slate-300"}`}>
                            {c.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredContacts.map(c => (
                  <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedContact(c)}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-base">{c.first_name} {c.last_name}</h3>
                          <p className="text-sm text-muted-foreground">{c.companies?.name || "Sin empresa"}</p>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${c.is_active ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-700 border-slate-300"}`}>
                          {c.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        {c.mobile && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" /> {c.mobile}
                          </span>
                        )}
                        {(c.companies?.plazas as any)?.nombre && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" /> {(c.companies!.plazas as any).nombre}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      <CompanyFormDialog open={companyOpen} onOpenChange={setCompanyOpen} onCreated={() => fetchData()} />
      <CompanyFormDialog
        open={!!editCompany}
        onOpenChange={open => { if (!open) setEditCompany(null); }}
        editData={editCompany}
        onCreated={() => { fetchData(); setSelectedCompany(null); }}
      />
      <ContactFormDialog open={contactOpen} onOpenChange={setContactOpen} onCreated={() => fetchData()} />
      <ContactFormDialog
        open={!!editContact}
        onOpenChange={open => { if (!open) setEditContact(null); }}
        editData={editContact}
        onCreated={() => { fetchData(); setSelectedContact(null); }}
      />

      {/* Company Detail Sheet */}
      <Sheet open={!!selectedCompany} onOpenChange={open => { if (!open) setSelectedCompany(null); }}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {selectedCompany && (
            <>
              <SheetHeader className="flex flex-row items-start justify-between">
                <div className="space-y-0.5">
                  <SheetTitle>{selectedCompany.name}</SheetTitle>
                  {selectedCompany.razon_social && selectedCompany.razon_social !== selectedCompany.name && (
                    <p className="text-xs text-muted-foreground">Razón Social: {selectedCompany.razon_social}</p>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditCompany(selectedCompany)}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
              </SheetHeader>

              <Tabs defaultValue="general" className="mt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
                  <TabsTrigger value="clasificacion" className="flex-1">Clasificación</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-3 mt-4">
                  {/* Resumen destacado */}
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <DetailRow label="Razón Social" value={selectedCompany.razon_social} />
                      <DetailRow label="Industria" value={selectedCompany.industry} />
                      <DetailRow label="Plaza" value={(selectedCompany.plazas as any)?.nombre} />
                      <DetailRow label="Lista de Precios" value={selectedCompany.lista_precios} />
                    </div>
                  </div>

                  {/* Equipo comercial */}
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                      <Users className="h-3.5 w-3.5" /> Equipo comercial
                    </div>
                    <DetailRow label="Ejecutivo(s) de Venta" value={getEjecutivoNames(selectedCompanyEjecutivos).join(", ") || "—"} />
                  </div>

                  {/* Contacto */}
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                      <Phone className="h-3.5 w-3.5" /> Contacto
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <DetailRow label="Correo" value={selectedCompany.email} />
                      <DetailRow label="Teléfono" value={selectedCompany.phone} />
                      <DetailRow label="Sitio Web" value={selectedCompany.website} />
                    </div>
                  </div>

                  {/* Ubicación */}
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                      <MapPin className="h-3.5 w-3.5" /> Ubicación
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Dirección</Label>
                      {selectedCompany.address ? (
                        <AddressDisplay address={selectedCompany.address} />
                      ) : (
                        <p className="text-sm text-muted-foreground">—</p>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <DetailRow label="Ciudad" value={selectedCompany.city} />
                      <DetailRow label="Estado" value={selectedCompany.state} />
                      <DetailRow label="C.P." value={selectedCompany.zip_code} />
                    </div>
                  </div>

                  {/* Notas */}
                  {selectedCompany.notes && (
                    <div className="rounded-lg border bg-accent/30 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                        <FileText className="h-3.5 w-3.5" /> Notas
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{selectedCompany.notes}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="clasificacion" className="space-y-3 mt-4">
                  {/* Datos fiscales y pago */}
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                      <Tag className="h-3.5 w-3.5" /> Datos fiscales y pago
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <DetailRow label="Tipo de Pago" value={selectedCompany.tipo_pago ? TIPO_PAGO_LABEL[selectedCompany.tipo_pago] || selectedCompany.tipo_pago : null} />
                      <DetailRow label="Forma de Pago (SAT)" value={formaPagoLabel(selectedCompany.forma_pago)} />
                      <DetailRow label="Método de Pago" value={selectedCompany.metodo_pago ? METODO_PAGO_LABEL[selectedCompany.metodo_pago] || selectedCompany.metodo_pago : null} />
                      <DetailRow label="Uso de CFDI" value={selectedCompany.uso_cfdi} />
                    </div>
                  </div>

                  {/* Industrias */}
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                      <Briefcase className="h-3.5 w-3.5" /> Industrias
                    </div>
                    {selectedCompany.industrias && selectedCompany.industrias.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedCompany.industrias.map(i => (
                          <Badge key={i} variant="secondary" className="text-xs">{i}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </div>

                  {/* Perfil comercial */}
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                      <Users className="h-3.5 w-3.5" /> Perfil comercial
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <DetailRow label="Tipo según destino" value={selectedCompany.tipo_destino_lubricante} />
                      <DetailRow label="Potencial de unidades" value={selectedCompany.potencial_unidades} />
                      <DetailRow label="Tomador de decisión" value={selectedCompany.tomador_decision} />
                      <DetailRow label="Riesgo cambio de marca" value={selectedCompany.riesgo_cambio_marca} />
                      <DetailRow label="Origen contacto" value={selectedCompany.origen_contacto} />
                      <DetailRow label="Evaluación lubricante" value={selectedCompany.evaluacion_lubricante} />
                      <DetailRow label="Rol del lubricante" value={selectedCompany.rol_lubricante} />
                      <DetailRow label="Tipo cliente (clasificación)" value={selectedCompany.tipo_cliente_comercial} />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Contact Detail Sheet */}
      <Sheet open={!!selectedContact} onOpenChange={open => { if (!open) setSelectedContact(null); }}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {selectedContact && (
            <>
              <SheetHeader className="flex flex-row items-center justify-between">
                <SheetTitle>{selectedContact.first_name} {selectedContact.last_name}</SheetTitle>
                <Button size="sm" variant="outline" onClick={() => setEditContact(selectedContact)}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                {/* Identidad */}
                <div className="grid grid-cols-2 gap-3">
                  <DetailRow label="Nombre" value={selectedContact.first_name} />
                  <DetailRow label="Apellido" value={selectedContact.last_name} />
                  <DetailRow label="Puesto" value={selectedContact.job_title} />
                  <DetailRow label="Departamento" value={selectedContact.department} />
                </div>

                {/* Empresa + Ejecutivo */}
                <div className="grid grid-cols-2 gap-3">
                  <DetailRow label="Empresa" value={selectedContact.companies?.name} />
                  <DetailRow label="Ejecutivo(s) de Venta" value={getEjecutivoNames(selectedContactEjecutivos).join(", ") || "—"} />
                </div>

                {/* Comunicación */}
                <div className="rounded-md border p-3 space-y-2">
                  <h4 className="text-sm font-semibold">Comunicación</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Whatsapp", value: (selectedContact as any).whatsapp_phone, active: !!(selectedContact as any).comm_whatsapp },
                      { label: "Email", value: selectedContact.email, active: !!(selectedContact as any).comm_email },
                      { label: "Email 2", value: (selectedContact as any).email2, active: !!(selectedContact as any).comm_email2 },
                      { label: "Cel", value: selectedContact.mobile, active: !!(selectedContact as any).comm_cel },
                      { label: "Tel", value: selectedContact.phone, active: !!(selectedContact as any).comm_tel },
                      { label: "Tel Emp", value: (selectedContact as any).tel_emp, active: !!(selectedContact as any).comm_tel_emp },
                    ].map((c) => (
                      <DetailRow
                        key={c.label}
                        label={c.active ? `${c.label} ✓` : c.label}
                        value={c.value}
                      />
                    ))}
                  </div>
                </div>

                {/* Plaza */}
                <div className="grid grid-cols-2 gap-3">
                  <DetailRow label="Plaza" value={(selectedContact.companies?.plazas as any)?.nombre} />
                </div>

                {/* Notas */}
                {selectedContact.notes && (
                  <>
                    <Separator className="my-1" />
                    <DetailRow label="Notas" value={selectedContact.notes} />
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Bulk edit dialog */}
      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedIds={Array.from(selectedIds)}
        table={activeTab === "companies" ? "companies" : "contacts"}
        fields={activeTab === "companies" ? [
          { key: "plaza_id", label: "Plaza", type: "select", options: plazasList.map(p => ({ value: p.id, label: p.nombre })) },
          { key: "lista_precios", label: "Lista de precios", type: "select", options: [
            { value: "UF1", label: "UF1" }, { value: "UF2", label: "UF2" },
            { value: "UF3", label: "UF3" }, { value: "UF4", label: "UF4" },
            { value: "R1", label: "R1" }, { value: "R2", label: "R2" },
            { value: "R3", label: "R3" }, { value: "R4", label: "R4" },
            { value: "lista_galper", label: "Lista Galper" },
          ]},
          { key: "is_active", label: "Estado", type: "select", options: [
            { value: "__true__", label: "Activo" }, { value: "__false__", label: "Inactivo" },
          ]},
          { key: "industry", label: "Industria", type: "text" },
          { key: "ejecutivos", label: "Ejecutivo(s) de Venta", type: "ejecutivos", junctionTable: "company_ejecutivos", junctionFkColumn: "company_id" },
        ] : [
          { key: "is_active", label: "Estado", type: "select", options: [
            { value: "__true__", label: "Activo" }, { value: "__false__", label: "Inactivo" },
          ]},
          { key: "job_title", label: "Puesto", type: "text" },
          { key: "department", label: "Departamento", type: "text" },
          { key: "ejecutivos", label: "Ejecutivo(s) de Venta", type: "ejecutivos", junctionTable: "contact_ejecutivos", junctionFkColumn: "contact_id" },
        ]}
        onSuccess={() => { setSelectedIds(new Set()); fetchData(); }}
      />
      <MergeDuplicatesDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        entity={activeTab === "companies" ? "companies" : "contacts"}
        onMerged={fetchData}
      />
    </div>
  );
}

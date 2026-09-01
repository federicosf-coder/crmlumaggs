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
import { Plus, Building2, User, Search, Pencil, LayoutList, LayoutGrid, Phone, MapPin, CheckSquare, Trash2, Download, Upload, Mail, Globe, Briefcase, Users, Tag, FileText, CreditCard, DollarSign, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Merge } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { SortMenu } from "@/components/SortMenu";
import { CompanyFormDialog, type CompanyData, FORMA_PAGO_OPTS, LISTA_PRECIOS_OPTIONS } from "@/components/CompanyFormDialog";
import { ContactFormDialog, type ContactEditData } from "@/components/ContactFormDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SlidersHorizontal, X, ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { BulkEditDialog } from "@/components/BulkEditDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ImportExportMenu } from "@/components/ImportExportMenu";
import { fetchAllRows } from "@/lib/supabasePagination";
import { AddressDisplay } from "@/components/AddressDisplay";
import { MergeDuplicatesDialog } from "@/components/directory/MergeDuplicatesDialog";
import { MergeContactsDialog } from "@/components/directory/MergeContactsDialog";
import { CompanyMetricsPanel } from "@/components/directory/CompanyMetricsPanel";
import { CompanyCreditoCobranzaTab } from "@/components/directory/CompanyCreditoCobranzaTab";
import { JustificacionPrecioBlock } from "@/components/directory/JustificacionPrecioBlock";

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
  creado_automaticamente?: boolean;
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
  credito: "Crédito (sin clasificar)",
  credito_directo: "Crédito Directo",
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
  const navigate = useNavigate();
  const activeTab = searchParams.get("tab") || "companies";
  const selectId = searchParams.get("select");
  const { hasRole } = useAuth();

  // Deep-link: subtab dentro del diálogo de empresa, y URL para "Regresar"
  const [initialSubtab, setInitialSubtab] = useState<string>("general");
  const [backUrl, setBackUrl] = useState<string | null>(null);

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
  const [companySortField, setCompanySortField] = useState<"name" | "id_contpaq" | "industry" | "contacts" | "plaza" | "ejecutivo" | "venta" | "estado">("name");
  const [companySortDir, setCompanySortDir] = useState<"asc" | "desc">("asc");
  const [contactSort, setContactSort] = useState("last_name_asc");
  const [mergeContactsOpen, setMergeContactsOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [editContact, setEditContact] = useState<ContactEditData | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  // Filtros avanzados (contactos)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterVendedor, setFilterVendedor] = useState<string>("all");
  const [filterSede, setFilterSede] = useState<string>("all");
  const [filterGiro, setFilterGiro] = useState<string>("all");

  // Filtros avanzados (empresas)
  const [companyFiltersOpen, setCompanyFiltersOpen] = useState(false);
  const [coFilterVendedor, setCoFilterVendedor] = useState<string>("all");
  const [coFilterPlaza, setCoFilterPlaza] = useState<string>("all");
  const [coFilterIndustria, setCoFilterIndustria] = useState<string>("all");

  // Vendedores (perfiles con rol sales)
  const { data: vendedoresList = [] } = useQuery({
    queryKey: ["vendedores_sales_profiles"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "sales");
      const ids = Array.from(new Set((roles || []).map((r: any) => r.user_id)));
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", ids)
        .order("full_name");
      return profs || [];
    },
  });

  // Mapa contact_id -> user_ids ejecutivos asignados
  const { data: contactEjecutivosMap = {} } = useQuery<Record<string, string[]>>({
    queryKey: ["contact_ejecutivos_map"],
    queryFn: async () => {
      const { data } = await supabase.from("contact_ejecutivos").select("contact_id, user_id");
      const map: Record<string, string[]> = {};
      (data || []).forEach((r: any) => {
        if (!map[r.contact_id]) map[r.contact_id] = [];
        map[r.contact_id].push(r.user_id);
      });
      return map;
    },
  });

  // Mapa company_id -> user_ids ejecutivos asignados
  const { data: companyEjecutivosMap = {} } = useQuery<Record<string, string[]>>({
    queryKey: ["company_ejecutivos_map"],
    queryFn: async () => {
      const { data } = await supabase.from("company_ejecutivos").select("company_id, user_id");
      const map: Record<string, string[]> = {};
      (data || []).forEach((r: any) => {
        if (!map[r.company_id]) map[r.company_id] = [];
        map[r.company_id].push(r.user_id);
      });
      return map;
    },
  });

  const sedeOptions = useMemo(() => {
    const s = new Set<string>();
    contacts.forEach(c => { const v = (c as any).sede; if (v) s.add(v); });
    return Array.from(s).sort();
  }, [contacts]);

  const giroOptions = useMemo(() => {
    const s = new Set<string>();
    contacts.forEach(c => { const v = (c.companies as any)?.industry || (companies.find(co => co.id === c.company_id)?.industry); if (v) s.add(v); });
    return Array.from(s).sort();
  }, [contacts, companies]);

  const sedeLabel = (v: string) => v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, " ");

  const clearContactFilters = () => {
    setFilterVendedor("all");
    setFilterSede("all");
    setFilterGiro("all");
    setContactSearch("");
  };

  const activeFilterCount =
    (filterVendedor !== "all" ? 1 : 0) +
    (filterSede !== "all" ? 1 : 0) +
    (filterGiro !== "all" ? 1 : 0);

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

  // Direcciones vinculadas a la empresa seleccionada (para vista detalle)
  const { data: selectedCompanyAddresses = [] } = useQuery({
    queryKey: ["company_addresses_detail", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data } = await supabase
        .from("direcciones_empresa")
        .select("id, nombre, tipo, tipos, calle, ciudad, estado, codigo_postal, direccion_completa, referencia, coordenadas_lat, coordenadas_lng")
        .eq("empresa_id", selectedCompany.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const { data: tiposDireccionCatalog = [] } = useQuery({
    queryKey: ["tipos_direccion_catalog_detail"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("tipos_direccion")
        .select("clave, etiqueta")
        .eq("is_active", true);
      return (data || []) as { clave: string; etiqueta: string }[];
    },
  });
  const labelTipoDireccion = (clave: string) =>
    tiposDireccionCatalog.find((t) => t.clave === clave)?.etiqueta || clave;

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
      let q = supabase.from("companies").select("*, plazas(nombre), contacts!contacts_company_id_fkey(id)").order("name");

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
      let q = supabase.from("contacts").select("*, companies!contacts_company_id_fkey(name, industry, plazas(nombre))").order("last_name");

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
        const sub = searchParams.get("subtab");
        const back = searchParams.get("back");
        if (sub) setInitialSubtab(sub);
        if (back) setBackUrl(back);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete("select");
          next.delete("subtab");
          next.delete("back");
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

  const companyHasVenta = (c: Company) =>
    Boolean((c as any).fecha_ultima_compra_chevron || (c as any).fecha_ultima_compra_phillips66 || (c as any).fecha_ultima_compra);
  const companyEjecutivoName = (c: Company) => {
    const ids = companyEjecutivosMap[c.id] || [];
    if (ids.length === 0) return "";
    const p = allProfiles.find((pr: any) => pr.user_id === ids[0]);
    return p?.full_name || p?.email || "";
  };
  // Opciones de filtros para empresas (derivadas de los datos cargados)
  const companyVendedorOptions = useMemo(() => {
    const ids = new Set<string>();
    companies.forEach(c => (companyEjecutivosMap[c.id] || []).forEach(uid => ids.add(uid)));
    return Array.from(ids).map(uid => {
      const p = allProfiles.find((pr: any) => pr.user_id === uid);
      return { user_id: uid, label: p?.full_name || p?.email || uid };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [companies, companyEjecutivosMap, allProfiles]);
  const companyPlazaOptions = useMemo(() => {
    const s = new Set<string>();
    companies.forEach(c => { const n = (c.plazas as any)?.nombre; if (n) s.add(n); });
    return Array.from(s).sort();
  }, [companies]);
  const companyIndustriaOptions = useMemo(() => {
    const s = new Set<string>();
    companies.forEach(c => { if (c.industry) s.add(c.industry); });
    return Array.from(s).sort();
  }, [companies]);
  const companyActiveFilterCount =
    (coFilterVendedor !== "all" ? 1 : 0) +
    (coFilterPlaza !== "all" ? 1 : 0) +
    (coFilterIndustria !== "all" ? 1 : 0);
  const clearCompanyFilters = () => {
    setCoFilterVendedor("all"); setCoFilterPlaza("all"); setCoFilterIndustria("all");
  };

  const filteredCompanies = companies
    .filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()))
    .filter(c => {
      if (coFilterVendedor !== "all") {
        const ids = companyEjecutivosMap[c.id] || [];
        if (!ids.includes(coFilterVendedor)) return false;
      }
      if (coFilterPlaza !== "all") {
        if (((c.plazas as any)?.nombre || "") !== coFilterPlaza) return false;
      }
      if (coFilterIndustria !== "all") {
        if ((c.industry || "") !== coFilterIndustria) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dir = companySortDir === "asc" ? 1 : -1;
      switch (companySortField) {
        case "name": return a.name.localeCompare(b.name) * dir;
        case "id_contpaq": return (a.id_contpaq || "").localeCompare(b.id_contpaq || "") * dir;
        case "industry": return (a.industry || "").localeCompare(b.industry || "") * dir;
        case "plaza": return ((a.plazas as any)?.nombre || "").localeCompare((b.plazas as any)?.nombre || "") * dir;
        case "contacts": return (((a.contacts as any[])?.length || 0) - ((b.contacts as any[])?.length || 0)) * dir;
        case "ejecutivo": return companyEjecutivoName(a).localeCompare(companyEjecutivoName(b)) * dir;
        case "venta": return ((companyHasVenta(a) ? 1 : 0) - (companyHasVenta(b) ? 1 : 0)) * dir;
        case "estado": return ((a.is_active ? 1 : 0) - (b.is_active ? 1 : 0)) * dir;
        default: return 0;
      }
    });
  const toggleCompanySort = (field: typeof companySortField) => {
    if (companySortField === field) {
      setCompanySortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setCompanySortField(field);
      setCompanySortDir("asc");
    }
  };
  const SortIcon = ({ field }: { field: typeof companySortField }) => {
    if (companySortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-50" />;
    return companySortDir === "asc"
      ? <ChevronUp className="h-3 w-3 ml-1 inline" />
      : <ChevronDown className="h-3 w-3 ml-1 inline" />;
  };
  const filteredContacts = contacts
    .filter(c => {
      const q = contactSearch.trim().toLowerCase();
      if (q) {
        const hay =
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
          (c.companies?.name || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q) ||
          (c.mobile || "").toLowerCase().includes(q) ||
          ((c as any).whatsapp_phone || "").toLowerCase().includes(q);
        if (!hay) return false;
      }
      if (filterVendedor !== "all") {
        const ids = contactEjecutivosMap[c.id] || [];
        if (!ids.includes(filterVendedor)) return false;
      }
      if (filterSede !== "all") {
        if ((c as any).sede !== filterSede) return false;
      }
      if (filterGiro !== "all") {
        const giro = (c.companies as any)?.industry || companies.find(co => co.id === c.company_id)?.industry;
        if (giro !== filterGiro) return false;
      }
      return true;
    })
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
          <Button
            size="sm"
            variant="outline"
            className="transition-all duration-150 gap-1.5 bg-background text-foreground border border-input hover:bg-accent"
            onClick={() => navigate("/directory/addresses")}
            title="Gestiona las direcciones de entrega, fiscal y comercial de las empresas"
          >
            <MapPin className="h-4 w-4" />
            Direcciones
          </Button>
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
                placeholder={activeTab === "companies" ? "Buscar empresas..." : "Buscar por nombre, empresa o teléfono..."}
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {activeTab === "contacts" && (
              <SortMenu
                value={contactSort}
                onChange={setContactSort}
                options={[
                  { value: "last_name_asc", label: "Apellido A-Z" },
                  { value: "last_name_desc", label: "Apellido Z-A" },
                  { value: "first_name_asc", label: "Nombre A-Z" },
                  { value: "company", label: "Empresa" },
                ]}
              />
            )}
            {activeTab === "contacts" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiltersOpen(o => !o)}
                className="gap-2"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">{activeFilterCount}</Badge>
                )}
                <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
              </Button>
            )}
            {activeTab === "contacts" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMergeContactsOpen(true)}
                className="gap-2"
              >
                <Merge className="h-4 w-4" />
                Fusionar duplicados
              </Button>
            )}
            {activeTab === "companies" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCompanyFiltersOpen(o => !o)}
                className="gap-2"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {companyActiveFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">{companyActiveFilterCount}</Badge>
                )}
                <ChevronDown className={`h-4 w-4 transition-transform ${companyFiltersOpen ? "rotate-180" : ""}`} />
              </Button>
            )}
          </div>
          {activeTab === "companies" && (
            <Collapsible open={companyFiltersOpen} onOpenChange={setCompanyFiltersOpen}>
              <CollapsibleContent className="pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Vendedor</Label>
                    <Select value={coFilterVendedor} onValueChange={setCoFilterVendedor}>
                      <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los vendedores</SelectItem>
                        {companyVendedorOptions.map(v => (
                          <SelectItem key={v.user_id} value={v.user_id}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Plaza</Label>
                    <Select value={coFilterPlaza} onValueChange={setCoFilterPlaza}>
                      <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las plazas</SelectItem>
                        {companyPlazaOptions.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Industria</Label>
                    <Select value={coFilterIndustria} onValueChange={setCoFilterIndustria}>
                      <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las industrias</SelectItem>
                        {companyIndustriaOptions.map(i => (
                          <SelectItem key={i} value={i}>{i}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {companyActiveFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearCompanyFilters}
                      className="gap-1 justify-self-start sm:justify-self-end"
                    >
                      <X className="h-4 w-4" /> Limpiar filtros
                    </Button>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
          {activeTab === "contacts" && (
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <CollapsibleContent className="pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Vendedor</Label>
                    <Select value={filterVendedor} onValueChange={setFilterVendedor}>
                      <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los vendedores</SelectItem>
                        {vendedoresList.map((v: any) => (
                          <SelectItem key={v.user_id} value={v.user_id}>
                            {v.full_name || v.email || "—"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Sede / Región</Label>
                    <Select value={filterSede} onValueChange={setFilterSede}>
                      <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las sedes</SelectItem>
                        {sedeOptions.map(s => (
                          <SelectItem key={s} value={s}>{sedeLabel(s)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Giro / Sector</Label>
                    <Select value={filterGiro} onValueChange={setFilterGiro}>
                      <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los giros</SelectItem>
                        {giroOptions.map(g => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearContactFilters}
                    disabled={activeFilterCount === 0 && !contactSearch}
                    className="gap-1 justify-self-start sm:justify-self-end"
                  >
                    <X className="h-4 w-4" /> Limpiar filtros
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
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
                      <TableHead><button type="button" onClick={() => toggleCompanySort("name")} className="inline-flex items-center hover:text-foreground">Empresa<SortIcon field="name" /></button></TableHead>
                      <TableHead className="w-[110px]"><button type="button" onClick={() => toggleCompanySort("id_contpaq")} className="inline-flex items-center hover:text-foreground">ID Contpaq<SortIcon field="id_contpaq" /></button></TableHead>
                      <TableHead className="hidden sm:table-cell"><button type="button" onClick={() => toggleCompanySort("industry")} className="inline-flex items-center hover:text-foreground">Industria<SortIcon field="industry" /></button></TableHead>
                      <TableHead><button type="button" onClick={() => toggleCompanySort("contacts")} className="inline-flex items-center hover:text-foreground">Contactos<SortIcon field="contacts" /></button></TableHead>
                      <TableHead className="hidden md:table-cell"><button type="button" onClick={() => toggleCompanySort("plaza")} className="inline-flex items-center hover:text-foreground">Plaza<SortIcon field="plaza" /></button></TableHead>
                      <TableHead className="hidden md:table-cell"><button type="button" onClick={() => toggleCompanySort("ejecutivo")} className="inline-flex items-center hover:text-foreground">Ejecutivo<SortIcon field="ejecutivo" /></button></TableHead>
                      <TableHead><button type="button" onClick={() => toggleCompanySort("venta")} className="inline-flex items-center hover:text-foreground">Venta<SortIcon field="venta" /></button></TableHead>
                      <TableHead><button type="button" onClick={() => toggleCompanySort("estado")} className="inline-flex items-center hover:text-foreground">Estado<SortIcon field="estado" /></button></TableHead>
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
                        <TableCell className="hidden md:table-cell">{companyEjecutivoName(c) || "—"}</TableCell>
                        <TableCell>
                          {companyHasVenta(c) ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200">Sí</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-slate-100 text-slate-700 border-slate-300">No</span>
                          )}
                        </TableCell>
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
                      <TableHead className="hidden sm:table-cell">WhatsApp</TableHead>
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
                        <TableCell className="hidden sm:table-cell">{(c as any).whatsapp_phone || "—"}</TableCell>
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

      <CompanyFormDialog
        open={companyOpen}
        onOpenChange={setCompanyOpen}
        onCreated={async (newId) => {
          // Limpiar filtros y búsqueda para que el nuevo registro sea visible
          setCompanySearch("");
          clearCompanyFilters();
          await fetchData();
          if (newId) {
            // Abrir la ficha recién creada para confirmación visual inmediata
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set("select", newId);
              return next;
            }, { replace: true });
          }
        }}
      />
      <CompanyFormDialog
        open={!!editCompany}
        onOpenChange={open => { if (!open) setEditCompany(null); }}
        editData={editCompany}
        onCreated={() => {
          fetchData();
          setEditCompany(null);
          if (backUrl) {
            const b = backUrl;
            setSelectedCompany(null);
            setBackUrl(null);
            setInitialSubtab("general");
            navigate(b);
          } else {
            setSelectedCompany(null);
          }
        }}
      />
      <ContactFormDialog open={contactOpen} onOpenChange={setContactOpen} onCreated={() => fetchData()} />
      <ContactFormDialog
        open={!!editContact}
        onOpenChange={open => { if (!open) setEditContact(null); }}
        editData={editContact}
        onCreated={() => { fetchData(); setSelectedContact(null); }}
      />

      {/* Company Detail Sheet */}
      {/* Company Detail Dialog */}
      <Dialog open={!!selectedCompany} onOpenChange={open => { if (!open) { setSelectedCompany(null); setBackUrl(null); setInitialSubtab("general"); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedCompany && (
            <>
              <DialogHeader className="flex flex-row items-start justify-between">
                <div className="space-y-0.5">
                  <DialogTitle>{selectedCompany.name}</DialogTitle>
                  {selectedCompany.razon_social && selectedCompany.razon_social !== selectedCompany.name && (
                    <p className="text-xs text-muted-foreground">Razón Social: {selectedCompany.razon_social}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1.5">
                    {backUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => { const b = backUrl; setSelectedCompany(null); setBackUrl(null); setInitialSubtab("general"); navigate(b); }}
                      >
                        ← Regresar a Cobranza
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => navigate(`/seguimiento/chevron?company=${selectedCompany.id}`)}
                    >
                      Seguimiento Chevron
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => navigate(`/seguimiento/phillips66?company=${selectedCompany.id}`)}
                    >
                      Seguimiento Galsa
                    </Button>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="mr-8" onClick={() => setEditCompany(selectedCompany)}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
              </DialogHeader>

              <div className="mt-3">
                <CompanyMetricsPanel companyId={selectedCompany.id} />
              </div>

              <Tabs defaultValue={initialSubtab} key={`${selectedCompany.id}-${initialSubtab}`} className="mt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
                  <TabsTrigger value="contactos" className="flex-1">Contactos</TabsTrigger>
                  <TabsTrigger value="direcciones" className="flex-1">Direcciones</TabsTrigger>
                  <TabsTrigger value="clasificacion" className="flex-1">Clasificación</TabsTrigger>
                  <TabsTrigger value="facturacion" className="flex-1">Detalles Facturación</TabsTrigger>
                  <TabsTrigger value="credito" className="flex-1">Crédito y Cobranza</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-3 mt-4 min-h-[580px] overflow-y-auto">
                  {selectedCompany.creado_automaticamente && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">Este cliente fue creado automáticamente por el sistema al importar un documento relacionado.</div>
                  )}
                  {/* Resumen destacado */}
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <DetailRow label="Razón Social" value={selectedCompany.razon_social} />
                      <DetailRow label="Industria" value={selectedCompany.industry} />
                      <DetailRow label="Plaza" value={(selectedCompany.plazas as any)?.nombre} />
                      <DetailRow label="Lista de Precios" value={listaPreciosLabel(selectedCompany.lista_precios)} />
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

                <TabsContent value="contactos" className="space-y-3 mt-4 min-h-[580px] overflow-y-auto">
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                      <User className="h-3.5 w-3.5" /> Contactos de la empresa
                    </div>
                    {selectedCompanyContacts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin contactos vinculados.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {selectedCompanyContacts.map((c: any) => (
                          <div key={c.id} className="flex items-center justify-between rounded border bg-muted/30 px-3 py-1.5 text-sm">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate">
                                {c.first_name} {c.last_name}
                                {c.job_title && <span className="text-muted-foreground font-normal"> — {c.job_title}</span>}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {c.email || "—"} · WhatsApp: {c.mobile || c.phone || "—"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="direcciones" className="space-y-3 mt-4 min-h-[580px] overflow-y-auto">
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                      <MapPin className="h-3.5 w-3.5" /> Direcciones de envío relacionadas
                    </div>
                    {selectedCompanyAddresses.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin direcciones vinculadas.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedCompanyAddresses.map((a: any) => {
                          const tipos = (a.tipos && a.tipos.length ? a.tipos : [a.tipo]).filter(Boolean);
                          return (
                            <div key={a.id} className="rounded border bg-muted/30 px-3 py-2 text-sm space-y-1">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="font-medium truncate">{a.nombre || a.direccion_completa || a.calle}</div>
                                <div className="flex flex-wrap gap-1">
                                  {tipos.map((t: string) => (
                                    <Badge key={t} variant="outline" className="text-xs">{labelTipoDireccion(t)}</Badge>
                                  ))}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <AddressDisplay
                                  address={a.direccion_completa || a.calle}
                                  lat={a.coordenadas_lat}
                                  lng={a.coordenadas_lng}
                                />
                              </div>
                              {a.referencia && (
                                <p className="text-xs text-muted-foreground italic">Ref: {a.referencia}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="clasificacion" className="space-y-3 mt-4 min-h-[580px] overflow-y-auto">
                  {/* Lista de precios + Tipo destino */}
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                      <Tag className="h-3.5 w-3.5" /> Clasificación comercial
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <DetailRow label="Lista de Precios" value={listaPreciosLabel(selectedCompany.lista_precios)} />
                      <DetailRow label="Tipo según destino" value={selectedCompany.tipo_destino_lubricante} />
                    </div>
                  </div>

                  <JustificacionPrecioBlock
                    companyId={selectedCompany.id}
                    initialValue={(selectedCompany as any).justificacion_precio_default}
                  />

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
                </TabsContent>

                <TabsContent value="facturacion" className="space-y-3 mt-4 min-h-[580px] overflow-y-auto">
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
                </TabsContent>

                <TabsContent value="credito" className="space-y-3 mt-4 min-h-[580px] overflow-y-auto">
                  <CompanyCreditoCobranzaTab
                    companyId={selectedCompany.id}
                    initialLimiteCredito={(selectedCompany as any).limite_credito ?? null}
                  />
                </TabsContent>

                <TabsContent value="evaluacion" className="space-y-3 mt-4 min-h-[580px] overflow-y-auto">
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Contact Detail Dialog */}
      <Dialog open={!!selectedContact} onOpenChange={open => { if (!open) setSelectedContact(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {selectedContact && (() => {
            const sc: any = selectedContact;
            const comms = [
              { label: "Whatsapp", value: sc.whatsapp_phone, active: !!sc.comm_whatsapp, icon: MessageCircle, color: "text-green-600" },
              { label: "Email", value: sc.email, active: !!sc.comm_email, icon: Mail, color: "text-blue-600" },
              { label: "Email 2", value: sc.email2, active: !!sc.comm_email2, icon: Mail, color: "text-blue-600" },
              { label: "Celular", value: sc.mobile, active: !!sc.comm_cel, icon: Phone, color: "text-indigo-600" },
              { label: "Tel.", value: sc.phone, active: !!sc.comm_tel, icon: Phone, color: "text-slate-600" },
              { label: "Tel. Empresa", value: sc.tel_emp, active: !!sc.comm_tel_emp, icon: Phone, color: "text-slate-600" },
            ].filter(c => c.value);
            return (
              <>
                <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-6 py-5 border-b shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <DialogTitle className="text-xl font-semibold tracking-tight">
                        {selectedContact.first_name} {selectedContact.last_name}
                      </DialogTitle>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {selectedContact.companies?.name && (
                          <Badge variant="secondary" className="gap-1">
                            <Building2 className="h-3 w-3" /> {selectedContact.companies.name}
                          </Badge>
                        )}
                        {selectedContact.job_title && (
                          <Badge variant="outline" className="gap-1">
                            <Briefcase className="h-3 w-3" /> {selectedContact.job_title}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setEditContact(selectedContact)}>
                      <Pencil className="h-4 w-4 mr-1" /> Editar
                    </Button>
                  </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                  {/* Comunicación */}
                  {comms.length > 0 && (
                    <section className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comunicación</h4>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {comms.map((c) => {
                          const Icon = c.icon;
                          return (
                            <div key={c.label} className="flex items-center gap-2.5 rounded-md border p-2.5 bg-muted/10">
                              <Icon className={`h-4 w-4 shrink-0 ${c.color}`} />
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                                  {c.label}
                                  {c.active && <span className="text-emerald-600">✓</span>}
                                </div>
                                <div className="text-sm truncate">{c.value}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Crédito y Cobranza */}
                  {(sc.contacto_cobranza || sc.contacto_credito) && (
                    <section className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Crédito y Cobranza</h4>
                      <div className="flex gap-2 flex-wrap">
                        {sc.contacto_cobranza && (
                          <Badge className="bg-orange-100 text-orange-800 border-orange-200 gap-1 hover:bg-orange-100">
                            <DollarSign className="h-3 w-3" /> Contacto de Cobranza
                          </Badge>
                        )}
                        {sc.contacto_credito && (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1 hover:bg-blue-100">
                            <CreditCard className="h-3 w-3" /> Contacto de Crédito
                          </Badge>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Información general */}
                  <section className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Información general</h4>
                    <div className="grid sm:grid-cols-2 gap-3 rounded-md border p-3 bg-muted/10">
                      <DetailRow label="Puesto" value={selectedContact.job_title} />
                      <DetailRow label="Departamento" value={selectedContact.department} />
                      <DetailRow label="Empresa" value={selectedContact.companies?.name} />
                      <DetailRow label="Plaza" value={(selectedContact.companies?.plazas as any)?.nombre} />
                      <DetailRow label="Ejecutivo(s) de Venta" value={getEjecutivoNames(selectedContactEjecutivos).join(", ") || "—"} />
                    </div>
                  </section>

                  {/* Notas */}
                  {selectedContact.notes && (
                    <section className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notas</h4>
                      <div className="rounded-md border p-3 bg-muted/10 text-sm whitespace-pre-wrap font-light">
                        {selectedContact.notes}
                      </div>
                    </section>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

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
      <MergeContactsDialog
        open={mergeContactsOpen}
        onOpenChange={setMergeContactsOpen}
        onMerged={fetchData}
      />
    </div>
  );
}

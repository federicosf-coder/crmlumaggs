import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Building2, User, Search, Pencil, List, LayoutGrid, Phone, MapPin } from "lucide-react";
import { SortMenu } from "@/components/SortMenu";
import { CompanyFormDialog, type CompanyData } from "@/components/CompanyFormDialog";
import { ContactFormDialog, type ContactEditData } from "@/components/ContactFormDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface Company {
  id: string; name: string; industry: string | null; phone: string | null;
  email: string | null; city: string | null; is_active: boolean;
  address: string | null; state: string | null; zip_code: string | null;
  website: string | null; notes: string | null; plaza_id: string | null;
  lista_precios: string | null; industrias: string[] | null; equipo: string | null;
  tipo_destino_lubricante: string | null; potencial_unidades: string | null;
  tomador_decision: string | null; riesgo_cambio_marca: string | null;
  origen_contacto: string | null; evaluacion_lubricante: string | null;
  rol_lubricante: string | null; tipo_cliente_comercial: string | null;
  plazas?: { nombre: string } | null;
  contacts?: { id: string }[];
}

interface Contact {
  id: string; first_name: string; last_name: string; email: string | null;
  phone: string | null; mobile: string | null; job_title: string | null; is_active: boolean;
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

export default function Directory() {
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

  const fetchData = async () => {
    setLoading(true);
    const [{ data: co }, { data: ct }] = await Promise.all([
      supabase.from("companies").select("*, plazas(nombre), contacts(id)").order("name"),
      supabase.from("contacts").select("*, companies(name, plazas(nombre))").order("last_name"),
    ]);
    setCompanies((co as Company[]) || []);
    setContacts((ct as Contact[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

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

  const ViewToggle = ({ view, setView }: { view: "list" | "cards"; setView: (v: "list" | "cards") => void }) => (
    <div className="flex gap-1 border rounded-md p-0.5">
      <Button variant={view === "list" ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setView("list")}>
        <List className="h-4 w-4" />
      </Button>
      <Button variant={view === "cards" ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setView("cards")}>
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Directorio</h1>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies" className="gap-2"><Building2 className="h-4 w-4" /> Empresas</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-2"><User className="h-4 w-4" /> Contactos</TabsTrigger>
        </TabsList>

        {/* ─── EMPRESAS ─── */}
        <TabsContent value="companies" className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar empresas..." className="pl-9" value={companySearch} onChange={e => setCompanySearch(e.target.value)} />
              </div>
              <ViewToggle view={companyView} setView={setCompanyView} />
              <SortMenu
                value={companySort}
                onChange={setCompanySort}
                options={[
                  { value: "name_asc", label: "Nombre A-Z" },
                  { value: "name_desc", label: "Nombre Z-A" },
                  { value: "industry", label: "Industria" },
                  { value: "plaza", label: "Plaza" },
                  { value: "contacts_desc", label: "Más contactos" },
                ]}
              />
            </div>
            <Button onClick={() => setCompanyOpen(true)}><Plus className="mr-2 h-4 w-4" /> Agregar Empresa</Button>
          </div>

          {loading ? (
            <p className="text-muted-foreground p-6">Cargando...</p>
          ) : filteredCompanies.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No se encontraron empresas.</p>
          ) : companyView === "list" ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Industria</TableHead>
                      <TableHead>Contactos</TableHead>
                      <TableHead>Plaza</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map(c => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedCompany(c)}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.industry || "—"}</TableCell>
                        <TableCell>{(c.contacts as any[])?.length || 0}</TableCell>
                        <TableCell>{(c.plazas as any)?.nombre || "—"}</TableCell>
                        <TableCell><Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Activo" : "Inactivo"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
                      <Badge variant={c.is_active ? "default" : "secondary"} className="text-xs shrink-0">
                        {c.is_active ? "Activo" : "Inactivo"}
                      </Badge>
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
          )}
        </TabsContent>

        {/* ─── CONTACTOS ─── */}
        <TabsContent value="contacts" className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar contactos..." className="pl-9" value={contactSearch} onChange={e => setContactSearch(e.target.value)} />
              </div>
              <ViewToggle view={contactView} setView={setContactView} />
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
            </div>
            <Button onClick={() => setContactOpen(true)}><Plus className="mr-2 h-4 w-4" /> Agregar Contacto</Button>
          </div>

          {loading ? (
            <p className="text-muted-foreground p-6">Cargando...</p>
          ) : filteredContacts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No se encontraron contactos.</p>
          ) : contactView === "list" ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Apellido</TableHead>
                      <TableHead>Teléfono Móvil</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Plaza</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.first_name}</TableCell>
                        <TableCell>{c.last_name}</TableCell>
                        <TableCell>{c.mobile || "—"}</TableCell>
                        <TableCell>{c.companies?.name || "—"}</TableCell>
                        <TableCell>{(c.companies?.plazas as any)?.nombre || "—"}</TableCell>
                        <TableCell><Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Activo" : "Inactivo"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContacts.map(c => (
                <Card key={c.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-base">{c.first_name} {c.last_name}</h3>
                        <p className="text-sm text-muted-foreground">{c.companies?.name || "Sin empresa"}</p>
                      </div>
                      <Badge variant={c.is_active ? "default" : "secondary"} className="text-xs shrink-0">
                        {c.is_active ? "Activo" : "Inactivo"}
                      </Badge>
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
          )}
        </TabsContent>
      </Tabs>

      <CompanyFormDialog open={companyOpen} onOpenChange={setCompanyOpen} onCreated={() => fetchData()} />
      <CompanyFormDialog
        open={!!editCompany}
        onOpenChange={open => { if (!open) setEditCompany(null); }}
        editData={editCompany}
        onCreated={() => { fetchData(); setSelectedCompany(null); }}
      />
      <ContactFormDialog open={contactOpen} onOpenChange={setContactOpen} onCreated={() => fetchData()} />

      {/* Company Detail Sheet */}
      <Sheet open={!!selectedCompany} onOpenChange={open => { if (!open) setSelectedCompany(null); }}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {selectedCompany && (
            <>
              <SheetHeader className="flex flex-row items-center justify-between">
                <SheetTitle>{selectedCompany.name}</SheetTitle>
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
                  <div className="grid grid-cols-2 gap-3">
                    <DetailRow label="Industria" value={selectedCompany.industry} />
                    <DetailRow label="Plaza" value={(selectedCompany.plazas as any)?.nombre} />
                    <DetailRow label="Sitio Web" value={selectedCompany.website} />
                    <DetailRow label="Teléfono" value={selectedCompany.phone} />
                    <DetailRow label="Correo" value={selectedCompany.email} />
                    <DetailRow label="Lista de Precios" value={selectedCompany.lista_precios} />
                    <DetailRow label="Dirección" value={selectedCompany.address} />
                    <DetailRow label="Ciudad" value={selectedCompany.city} />
                    <DetailRow label="Estado" value={selectedCompany.state} />
                    <DetailRow label="Código Postal" value={selectedCompany.zip_code} />
                  </div>
                  {selectedCompany.notes && (
                    <>
                      <Separator />
                      <DetailRow label="Notas" value={selectedCompany.notes} />
                    </>
                  )}
                </TabsContent>

                <TabsContent value="clasificacion" className="space-y-3 mt-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Industrias</Label>
                    {selectedCompany.industrias && selectedCompany.industrias.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedCompany.industrias.map(i => (
                          <Badge key={i} variant="secondary" className="text-xs">{i}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm">—</p>
                    )}
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3">
                    <DetailRow label="Equipo" value={selectedCompany.equipo} />
                    <DetailRow label="Tipo según destino" value={selectedCompany.tipo_destino_lubricante} />
                    <DetailRow label="Potencial de unidades" value={selectedCompany.potencial_unidades} />
                    <DetailRow label="Tomador de decisión" value={selectedCompany.tomador_decision} />
                    <DetailRow label="Riesgo cambio de marca" value={selectedCompany.riesgo_cambio_marca} />
                    <DetailRow label="Origen contacto" value={selectedCompany.origen_contacto} />
                    <DetailRow label="Evaluación lubricante" value={selectedCompany.evaluacion_lubricante} />
                    <DetailRow label="Rol del lubricante" value={selectedCompany.rol_lubricante} />
                    <DetailRow label="Tipo cliente comercial" value={selectedCompany.tipo_cliente_comercial} />
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

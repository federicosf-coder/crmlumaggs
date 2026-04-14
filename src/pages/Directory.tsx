import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Building2, User, Search, Pencil } from "lucide-react";
import { CompanyFormDialog, type CompanyData } from "@/components/CompanyFormDialog";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface Company {
  id: string; name: string; industry: string | null; phone: string | null;
  email: string | null; city: string | null; is_active: boolean;
  address: string | null; state: string | null; zip_code: string | null;
  website: string | null; notes: string | null;
  industrias: string[] | null; equipo: string | null;
  tipo_destino_lubricante: string | null; potencial_unidades: string | null;
  tomador_decision: string | null; riesgo_cambio_marca: string | null;
  origen_contacto: string | null; evaluacion_lubricante: string | null;
  rol_lubricante: string | null; tipo_cliente_comercial: string | null;
}

interface Contact {
  id: string; first_name: string; last_name: string; email: string | null;
  phone: string | null; job_title: string | null; is_active: boolean;
  companies?: { name: string } | null;
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

  const fetchData = async () => {
    setLoading(true);
    const [{ data: co }, { data: ct }] = await Promise.all([
      supabase.from("companies").select("*").order("name"),
      supabase.from("contacts").select("*, companies(name)").order("last_name"),
    ]);
    setCompanies((co as Company[]) || []);
    setContacts((ct as Contact[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredCompanies = companies.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()));
  const filteredContacts = contacts.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(contactSearch.toLowerCase()) ||
    (c.companies?.name || "").toLowerCase().includes(contactSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Directorio</h1>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies" className="gap-2"><Building2 className="h-4 w-4" /> Empresas</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-2"><User className="h-4 w-4" /> Contactos</TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar empresas..." className="pl-9" value={companySearch} onChange={e => setCompanySearch(e.target.value)} />
            </div>
            <Button onClick={() => setCompanyOpen(true)}><Plus className="mr-2 h-4 w-4" /> Agregar Empresa</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <p className="text-muted-foreground p-6">Cargando...</p>
              ) : filteredCompanies.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No se encontraron empresas.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead><TableHead>Equipo</TableHead>
                      <TableHead>Tipo Destino</TableHead><TableHead>Potencial</TableHead>
                      <TableHead>Teléfono</TableHead><TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map(c => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedCompany(c)}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.equipo || "—"}</TableCell>
                        <TableCell>{c.tipo_destino_lubricante || "—"}</TableCell>
                        <TableCell>{c.potencial_unidades || "—"}</TableCell>
                        <TableCell>{c.phone || "—"}</TableCell>
                        <TableCell><Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Activo" : "Inactivo"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar contactos..." className="pl-9" value={contactSearch} onChange={e => setContactSearch(e.target.value)} />
            </div>
            <Button onClick={() => setContactOpen(true)}><Plus className="mr-2 h-4 w-4" /> Agregar Contacto</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <p className="text-muted-foreground p-6">Cargando...</p>
              ) : filteredContacts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No se encontraron contactos.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead><TableHead>Empresa</TableHead>
                      <TableHead>Puesto</TableHead><TableHead>Correo</TableHead>
                      <TableHead>Teléfono</TableHead><TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.first_name} {c.last_name}</TableCell>
                        <TableCell>{c.companies?.name || "—"}</TableCell>
                        <TableCell>{c.job_title || "—"}</TableCell>
                        <TableCell>{c.email || "—"}</TableCell>
                        <TableCell>{c.phone || "—"}</TableCell>
                        <TableCell><Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Activo" : "Inactivo"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CompanyFormDialog open={companyOpen} onOpenChange={setCompanyOpen} onCreated={() => fetchData()} />
      <ContactFormDialog open={contactOpen} onOpenChange={setContactOpen} onCreated={() => fetchData()} />

      {/* Company Detail Sheet */}
      <Sheet open={!!selectedCompany} onOpenChange={open => { if (!open) setSelectedCompany(null); }}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {selectedCompany && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedCompany.name}</SheetTitle>
              </SheetHeader>

              <Tabs defaultValue="general" className="mt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
                  <TabsTrigger value="clasificacion" className="flex-1">Clasificación</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-3 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <DetailRow label="Industria" value={selectedCompany.industry} />
                    <DetailRow label="Sitio Web" value={selectedCompany.website} />
                    <DetailRow label="Teléfono" value={selectedCompany.phone} />
                    <DetailRow label="Correo" value={selectedCompany.email} />
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

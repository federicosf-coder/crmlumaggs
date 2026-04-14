import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Building2, User, Search } from "lucide-react";
import { CompanyFormDialog } from "@/components/CompanyFormDialog";
import { ContactFormDialog } from "@/components/ContactFormDialog";

interface Company {
  id: string; name: string; industry: string | null; phone: string | null;
  email: string | null; city: string | null; is_active: boolean;
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

export default function Directory() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [companySearch, setCompanySearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [companyOpen, setCompanyOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: co }, { data: ct }] = await Promise.all([
      supabase.from("companies").select("*").order("name"),
      supabase.from("contacts").select("*, companies(name)").order("last_name"),
    ]);
    setCompanies(co || []);
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
    </div>
  );
}

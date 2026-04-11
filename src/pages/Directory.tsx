import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Building2, User, Search } from "lucide-react";

interface Company {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  notes: string | null;
  is_active: boolean;
}

interface Contact {
  id: string;
  company_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  job_title: string | null;
  department: string | null;
  notes: string | null;
  is_active: boolean;
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
  const { toast } = useToast();
  const { user } = useAuth();

  // Company form
  const [cName, setCName] = useState("");
  const [cIndustry, setCIndustry] = useState("");
  const [cWebsite, setCWebsite] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cAddress, setCAddress] = useState("");
  const [cCity, setCCity] = useState("");
  const [cState, setCState] = useState("");
  const [cZip, setCZip] = useState("");
  const [cNotes, setCNotes] = useState("");

  // Contact form
  const [ctFirst, setCtFirst] = useState("");
  const [ctLast, setCtLast] = useState("");
  const [ctEmail, setCtEmail] = useState("");
  const [ctPhone, setCtPhone] = useState("");
  const [ctMobile, setCtMobile] = useState("");
  const [ctJobTitle, setCtJobTitle] = useState("");
  const [ctDept, setCtDept] = useState("");
  const [ctCompanyId, setCtCompanyId] = useState("");
  const [ctNotes, setCtNotes] = useState("");

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

  const resetCompanyForm = () => {
    setCName(""); setCIndustry(""); setCWebsite(""); setCPhone("");
    setCEmail(""); setCAddress(""); setCCity(""); setCState(""); setCZip(""); setCNotes("");
  };

  const resetContactForm = () => {
    setCtFirst(""); setCtLast(""); setCtEmail(""); setCtPhone("");
    setCtMobile(""); setCtJobTitle(""); setCtDept(""); setCtCompanyId(""); setCtNotes("");
  };

  const createCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("companies").insert({
      name: cName, industry: cIndustry || null, website: cWebsite || null,
      phone: cPhone || null, email: cEmail || null, address: cAddress || null,
      city: cCity || null, state: cState || null, zip_code: cZip || null,
      notes: cNotes || null, created_by: user?.id,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Company created" });
      setCompanyOpen(false);
      resetCompanyForm();
      fetchData();
    }
  };

  const createContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("contacts").insert({
      first_name: ctFirst, last_name: ctLast, email: ctEmail || null,
      phone: ctPhone || null, mobile: ctMobile || null, job_title: ctJobTitle || null,
      department: ctDept || null, company_id: ctCompanyId || null,
      notes: ctNotes || null, created_by: user?.id,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contact created" });
      setContactOpen(false);
      resetContactForm();
      fetchData();
    }
  };

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  );
  const filteredContacts = contacts.filter((c) =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(contactSearch.toLowerCase()) ||
    (c.companies?.name || "").toLowerCase().includes(contactSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Directory</h1>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="h-4 w-4" /> Companies
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-2">
            <User className="h-4 w-4" /> Contacts
          </TabsTrigger>
        </TabsList>

        {/* COMPANIES TAB */}
        <TabsContent value="companies" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search companies..." className="pl-9" value={companySearch} onChange={(e) => setCompanySearch(e.target.value)} />
            </div>
            <Dialog open={companyOpen} onOpenChange={setCompanyOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Add Company</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>New Company</DialogTitle></DialogHeader>
                <form onSubmit={createCompany} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label>Company Name *</Label>
                      <Input value={cName} onChange={(e) => setCName(e.target.value)} required />
                    </div>
                    <div className="space-y-2"><Label>Industry</Label><Input value={cIndustry} onChange={(e) => setCIndustry(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Website</Label><Input value={cWebsite} onChange={(e) => setCWebsite(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Phone</Label><Input value={cPhone} onChange={(e) => setCPhone(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Email</Label><Input value={cEmail} onChange={(e) => setCEmail(e.target.value)} /></div>
                    <div className="col-span-2 space-y-2"><Label>Address</Label><Input value={cAddress} onChange={(e) => setCAddress(e.target.value)} /></div>
                    <div className="space-y-2"><Label>City</Label><Input value={cCity} onChange={(e) => setCCity(e.target.value)} /></div>
                    <div className="space-y-2"><Label>State</Label><Input value={cState} onChange={(e) => setCState(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Zip Code</Label><Input value={cZip} onChange={(e) => setCZip(e.target.value)} /></div>
                    <div className="col-span-2 space-y-2"><Label>Notes</Label><Textarea value={cNotes} onChange={(e) => setCNotes(e.target.value)} /></div>
                  </div>
                  <Button type="submit" className="w-full">Create Company</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <p className="text-muted-foreground p-6">Loading...</p>
              ) : filteredCompanies.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No companies found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.industry || "—"}</TableCell>
                        <TableCell>{c.phone || "—"}</TableCell>
                        <TableCell>{c.email || "—"}</TableCell>
                        <TableCell>{c.city || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={c.is_active ? "default" : "secondary"}>
                            {c.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTACTS TAB */}
        <TabsContent value="contacts" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search contacts..." className="pl-9" value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} />
            </div>
            <Dialog open={contactOpen} onOpenChange={setContactOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Add Contact</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>New Contact</DialogTitle></DialogHeader>
                <form onSubmit={createContact} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>First Name *</Label><Input value={ctFirst} onChange={(e) => setCtFirst(e.target.value)} required /></div>
                    <div className="space-y-2"><Label>Last Name *</Label><Input value={ctLast} onChange={(e) => setCtLast(e.target.value)} required /></div>
                    <div className="space-y-2"><Label>Email</Label><Input type="email" value={ctEmail} onChange={(e) => setCtEmail(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Phone</Label><Input value={ctPhone} onChange={(e) => setCtPhone(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Mobile</Label><Input value={ctMobile} onChange={(e) => setCtMobile(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Job Title</Label><Input value={ctJobTitle} onChange={(e) => setCtJobTitle(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Department</Label><Input value={ctDept} onChange={(e) => setCtDept(e.target.value)} /></div>
                    <div className="space-y-2">
                      <Label>Company</Label>
                      <Select value={ctCompanyId} onValueChange={setCtCompanyId}>
                        <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                        <SelectContent>
                          {companies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-2"><Label>Notes</Label><Textarea value={ctNotes} onChange={(e) => setCtNotes(e.target.value)} /></div>
                  </div>
                  <Button type="submit" className="w-full">Create Contact</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <p className="text-muted-foreground p-6">Loading...</p>
              ) : filteredContacts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No contacts found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.first_name} {c.last_name}</TableCell>
                        <TableCell>{c.companies?.name || "—"}</TableCell>
                        <TableCell>{c.job_title || "—"}</TableCell>
                        <TableCell>{c.email || "—"}</TableCell>
                        <TableCell>{c.phone || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={c.is_active ? "default" : "secondary"}>
                            {c.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

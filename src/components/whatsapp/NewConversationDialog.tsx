import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp";
import { Plus, MessageCircle } from "lucide-react";

type AccountLite = { id: string; business_phone_number_id: string; label: string; color: string };

export type ReadyConversation = {
  id: string;
  wa_phone: string;
  contact_id: string | null;
  wa_profile_name: string | null;
  business_phone_number_id: string | null;
  whatsapp_account_id: string | null;
  unread_count: number;
  status: string;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_message_preview: string | null;
  assigned_to: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountLite[];
  defaultPhoneAccountId: string | null;
  onConversationReady: (conversation: ReadyConversation) => void;
}

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  whatsapp_phone: string | null;
  company_id: string | null;
  companies?: { name: string | null } | null;
};

const fullName = (c: ContactRow) => `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();

export function NewConversationDialog({
  open,
  onOpenChange,
  accounts,
  defaultPhoneAccountId,
  onConversationReady,
}: Props) {
  const [phoneAccountId, setPhoneAccountId] = useState<string | null>(defaultPhoneAccountId);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactId, setContactId] = useState("");
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"contacto" | "numero">("contacto");
  const [nombreLibre, setNombreLibre] = useState("");
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadContacts = useCallback(async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, whatsapp_phone, company_id")
      .order("first_name")
      .limit(2000);
    if (error) {
      console.error("[whatsapp] error cargando contactos", error);
      toast.error("No se pudieron cargar los contactos: " + error.message);
      setContacts([]);
      return;
    }
    const rows = (data ?? []) as unknown as ContactRow[];
    const companyIds = Array.from(
      new Set(rows.map((r) => r.company_id).filter(Boolean) as string[]),
    );
    let nameById = new Map<string, string | null>();
    if (companyIds.length) {
      const { data: comps } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", companyIds);
      nameById = new Map((comps ?? []).map((c: { id: string; name: string | null }) => [c.id, c.name]));
    }
    setContacts(
      rows.map((r) => ({
        ...r,
        companies: r.company_id ? { name: nameById.get(r.company_id) ?? null } : null,
      })),
    );
  }, []);

  useEffect(() => {
    if (open) {
      setPhoneAccountId(defaultPhoneAccountId ?? accounts[0]?.business_phone_number_id ?? null);
      loadContacts();
    }
  }, [open, defaultPhoneAccountId, accounts, loadContacts]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === contactId) ?? null,
    [contacts, contactId],
  );

  useEffect(() => {
    if (selectedContact) setPhone(selectedContact.whatsapp_phone ?? "");
  }, [selectedContact]);

  const options = useMemo(
    () =>
      contacts.map((c) => {
        const name = fullName(c) || "(Sin nombre)";
        const empresa = c.companies?.name;
        const label = empresa ? `${name} — ${empresa}` : name;
        return { value: c.id, label, searchText: `${label} ${c.whatsapp_phone ?? ""}` };
      }),
    [contacts],
  );

  const reset = () => {
    setContactId("");
    setPhone("");
    setNombreLibre("");
    setSaving(false);
  };

  const handleContactCreated = async (id: string) => {
    await loadContacts();
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, whatsapp_phone, company_id, companies(name)")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      const row = data as unknown as ContactRow;
      setContacts((prev) => (prev.some((c) => c.id === row.id) ? prev : [row, ...prev]));
      setContactId(row.id);
      setPhone(row.whatsapp_phone ?? "");
    }
    setContactDialogOpen(false);
  };

  const handleStart = async () => {
    if (mode === "contacto" && !selectedContact) {
      toast.error("Selecciona un contacto");
      return;
    }
    const account = accounts.find((a) => a.business_phone_number_id === phoneAccountId) ?? null;
    if (!account) {
      toast.error("Selecciona una línea de WhatsApp");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("El número de WhatsApp debe tener al menos 10 dígitos");
      return;
    }
    const waPhone = normalizePhoneForWhatsApp(phone);
    if (!waPhone) {
      toast.error("Número de WhatsApp inválido");
      return;
    }

    setSaving(true);
    try {
      if (selectedContact && (selectedContact.whatsapp_phone ?? "") !== phone) {
        const { error: upErr } = await supabase
          .from("contacts")
          .update({ whatsapp_phone: phone })
          .eq("id", selectedContact.id);
        if (upErr) console.warn("[whatsapp] no se pudo actualizar el teléfono del contacto", upErr);
      }

      const { data: existing, error: findErr } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .eq("wa_phone", waPhone)
        .maybeSingle();
      if (findErr) throw findErr;

      if (existing) {
        let row = existing as unknown as ReadyConversation;
        if (!row.contact_id && selectedContact) {
          const { data: updated } = await supabase
            .from("whatsapp_conversations")
            .update({ contact_id: selectedContact.id })
            .eq("id", row.id)
            .select()
            .single();
          if (updated) row = updated as unknown as ReadyConversation;
        }
        onConversationReady(row);
        toast.info("Ya existía una conversación con ese número");
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("whatsapp_conversations")
          .insert({
            wa_phone: waPhone,
            contact_id: selectedContact?.id ?? null,
            wa_profile_name: selectedContact
              ? fullName(selectedContact) || null
              : nombreLibre.trim() || null,
            business_phone_number_id: account.business_phone_number_id,
            whatsapp_account_id: account.id,
            status: "open",
            unread_count: 0,
          } as never)
          .select()
          .single();
        if (insErr) throw insErr;
        onConversationReady(inserted as unknown as ReadyConversation);
        toast.success("Conversación iniciada");
      }

      reset();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo iniciar la conversación");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) reset();
          onOpenChange(o);
        }}
      >
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-base font-light">
              <MessageCircle className="h-4 w-4 text-primary" /> Nueva conversación
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-5 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Línea</Label>
              <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
                {accounts.map((a) => {
                  const isSelected = phoneAccountId === a.business_phone_number_id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setPhoneAccountId(a.business_phone_number_id)}
                      className={`rounded-sm px-3 py-1.5 text-sm transition-colors ${
                        isSelected ? "bg-background shadow-sm font-medium" : "text-muted-foreground"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                        {a.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
              {([
                ["contacto", "Contacto registrado"],
                ["numero", "Número directo"],
              ] as const).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    if (m === "numero") {
                      setContactId("");
                    } else {
                      setNombreLibre("");
                    }
                    setPhone("");
                  }}
                  className={`rounded-sm px-3 py-1.5 text-sm transition-colors ${
                    mode === m ? "bg-background shadow-sm font-medium" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "contacto" ? (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Contacto</Label>
                <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <SearchableSelect
                    value={contactId}
                    onValueChange={setContactId}
                    options={options}
                    placeholder="Buscar contacto..."
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setContactDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Nuevo contacto
                </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Nombre (opcional)
                </Label>
                <Input
                  value={nombreLibre}
                  maxLength={80}
                  onChange={(e) => setNombreLibre(e.target.value)}
                  placeholder="Ej. Cliente nuevo"
                />
                <p className="text-[11px] text-muted-foreground font-light">
                  No se creará ningún contacto en el directorio.
                </p>
              </div>
            )}

            {(selectedContact || mode === "numero") && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Número de WhatsApp
                </Label>
                <Input
                  type="tel"
                  value={phone}
                  maxLength={20}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="686 123 4567"
                />
              </div>
            )}
          </div>

          <DialogFooter className="bg-muted/40 px-6 py-3 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleStart}
              disabled={
                saving ||
                (mode === "contacto" ? !selectedContact : phone.replace(/\D/g, "").length < 10)
              }
            >
              Iniciar conversación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContactFormDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        onCreated={handleContactCreated}
      />
    </>
  );
}

export default NewConversationDialog;

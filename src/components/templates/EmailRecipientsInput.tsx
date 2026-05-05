import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Users, X } from "lucide-react";
import type { EmailRecipientItem } from "@/lib/templates";

interface Props {
  value: EmailRecipientItem[];
  onChange: (v: EmailRecipientItem[]) => void;
  placeholder?: string;
}

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

interface GroupRow { id: string; nombre: string; member_count: number }

export function EmailRecipientsInput({ value, onChange, placeholder = "correo@ejemplo.com" }: Props) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);

  const { data: groups } = useQuery({
    queryKey: ["email-groups-with-counts"],
    queryFn: async () => {
      const { data: gs } = await (supabase as any)
        .from("email_groups")
        .select("id,nombre")
        .eq("is_active", true)
        .order("nombre");
      const groupsList = (gs || []) as { id: string; nombre: string }[];
      if (groupsList.length === 0) return [] as GroupRow[];
      const { data: members } = await (supabase as any)
        .from("email_group_members")
        .select("group_id")
        .in("group_id", groupsList.map((g) => g.id));
      const counts = new Map<string, number>();
      for (const m of (members || []) as any[]) counts.set(m.group_id, (counts.get(m.group_id) || 0) + 1);
      return groupsList.map((g) => ({ ...g, member_count: counts.get(g.id) || 0 })) as GroupRow[];
    },
  });

  const exists = (item: EmailRecipientItem) =>
    value.some((v) => v.type === item.type && v.value.toLowerCase() === item.value.toLowerCase());

  const addEmail = (raw?: string) => {
    const v = (raw ?? input).trim().replace(/,$/, "");
    if (!v) return;
    if (!isValidEmail(v)) return;
    const item: EmailRecipientItem = { type: "email", value: v, label: v };
    if (!exists(item)) onChange([...value, item]);
    setInput("");
  };

  const addGroup = (g: GroupRow) => {
    const item: EmailRecipientItem = { type: "group", value: g.id, label: g.nombre };
    if (!exists(item)) onChange([...value, item]);
    setOpen(false);
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," ) { e.preventDefault(); addEmail(); }
    else if (e.key === "Backspace" && !input && value.length > 0) onChange(value.slice(0, -1));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 min-h-[28px]">
        {value.map((item, i) => (
          <Badge key={`${item.type}-${item.value}-${i}`} variant={item.type === "group" ? "default" : "secondary"} className="gap-1">
            {item.type === "group" && <Users className="h-3 w-3" />}
            {item.label || item.value}
            <button type="button" onClick={() => remove(i)} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => input.trim() && addEmail()}
          placeholder={placeholder}
          type="email"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="shrink-0">
              <Users className="h-4 w-4 mr-1" /> Grupos <ChevronsUpDown className="h-3 w-3 ml-1 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-72" align="end">
            <Command>
              <CommandInput placeholder="Buscar grupo..." />
              <CommandList>
                <CommandEmpty>Sin grupos</CommandEmpty>
                <CommandGroup>
                  {(groups || []).map((g) => (
                    <CommandItem key={g.id} onSelect={() => addGroup(g)}>
                      <Users className="h-4 w-4 mr-2" />
                      <span className="flex-1">{g.nombre}</span>
                      <span className="text-xs text-muted-foreground">{g.member_count}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
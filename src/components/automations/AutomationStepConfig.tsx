import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ENTITY_OPTIONS, type AutomationDraft, type EntityType } from "./types";

export function AutomationStepConfig({
  draft, onChange,
}: {
  draft: AutomationDraft;
  onChange: (patch: Partial<AutomationDraft>) => void;
}) {
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <Label htmlFor="auto-name">Nombre *</Label>
        <Input
          id="auto-name"
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Ej. Notificar vencimiento de factura"
        />
      </div>
      <div>
        <Label htmlFor="auto-desc">Descripción</Label>
        <Textarea
          id="auto-desc"
          rows={3}
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Describe brevemente qué hace esta automatización"
        />
      </div>
      <div>
        <Label>Entidad principal *</Label>
        <Select
          value={draft.entity_type}
          onValueChange={(v) => onChange({ entity_type: v as EntityType })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ENTITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <Switch
          checked={draft.is_active}
          onCheckedChange={(v) => onChange({ is_active: v })}
          id="auto-active"
        />
        <Label htmlFor="auto-active" className="cursor-pointer">
          Activar automatización inmediatamente
        </Label>
      </div>
    </div>
  );
}
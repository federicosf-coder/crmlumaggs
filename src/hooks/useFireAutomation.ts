import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type FireAutomationArgs = {
  trigger_type: string; // e.g. "existing_button_click"
  entity_type: "deal" | "company" | "document" | "contact" | "task";
  entity_id?: string | null;
  trigger_key?: string | null; // e.g. button id
  context?: Record<string, any>;
  silent?: boolean;
};

/**
 * Fires the run-automations edge function (fire-and-forget).
 * Does not block the UI; surfaces a toast only on hard failure when not silent.
 */
export async function fireAutomation(args: FireAutomationArgs) {
  try {
    const { data, error } = await supabase.functions.invoke("run-automations", {
      body: {
        trigger_type: args.trigger_type,
        entity_type: args.entity_type,
        entity_id: args.entity_id ?? null,
        trigger_key: args.trigger_key ?? null,
        context: args.context ?? {},
      },
    });
    if (error) throw error;
    return data as { matched: number; runs: any[] };
  } catch (e: any) {
    console.error("[fireAutomation] failed", e);
    if (!args.silent) toast.error(`Automatización falló: ${e?.message || e}`);
    return null;
  }
}
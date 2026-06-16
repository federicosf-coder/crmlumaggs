import { cn } from "@/lib/utils";

interface Props {
  at: string | null | undefined;
  className?: string;
  emptyLabel?: string;
}

/**
 * Small caption shown below action buttons that trigger an automation
 * (correo/WhatsApp). Renders "Último envío: dd/MM/yyyy HH:mm" or a
 * subtle placeholder when there is no previous send.
 */
export function LastSendStamp({ at, className, emptyLabel = "Sin envíos previos" }: Props) {
  let text = emptyLabel;
  if (at) {
    const d = new Date(at);
    const fmt = d.toLocaleString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    text = `Último envío: ${fmt}`;
  }
  return (
    <p
      className={cn(
        "text-[10px] text-muted-foreground mt-1 text-center leading-tight",
        className,
      )}
    >
      {text}
    </p>
  );
}

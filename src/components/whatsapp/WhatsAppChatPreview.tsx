import { Check } from "lucide-react";

interface Props {
  imageUrl?: string | null;
  bodyText: string;
  /** Variables nombradas { nombre_cliente: "Juan", ... } */
  variables?: Record<string, string>;
  contactName?: string;
  linePhone?: string;
  className?: string;
}

/** Reemplaza placeholders {var} con valores reales para la vista previa. */
function renderBody(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([a-z_][a-z0-9_]*)\}/gi, (m, k) => {
    const v = vars[String(k).toLowerCase()];
    return v && v.trim() ? v : m;
  });
}

/** Simulador de chat de WhatsApp para previsualizar plantillas con imagen + body. */
export function WhatsAppChatPreview({
  imageUrl,
  bodyText,
  variables = {},
  contactName = "Cliente",
  linePhone,
  className,
}: Props) {
  const rendered = renderBody(bodyText || "Escribe el mensaje…", variables);
  const time = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className={
        "relative w-full max-w-[320px] mx-auto rounded-2xl overflow-hidden shadow-xl border border-border " +
        (className || "")
      }
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' fill='%23E5DDD5'/><circle cx='20' cy='20' r='2' fill='%23D9D2C9'/><circle cx='60' cy='40' r='2' fill='%23D9D2C9'/><circle cx='40' cy='60' r='2' fill='%23D9D2C9'/></svg>\")",
        backgroundColor: "#ECE5DD",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2 bg-[#075E54] text-white">
        <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold">
          {contactName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{contactName}</div>
          <div className="text-[10px] opacity-80 truncate">
            {linePhone ? `vía ${linePhone}` : "en línea"}
          </div>
        </div>
      </div>

      {/* Mensaje */}
      <div className="p-3 min-h-[200px]">
        <div className="ml-auto max-w-[85%] bg-[#DCF8C6] rounded-lg shadow-sm overflow-hidden">
          {imageUrl && (
            <div className="bg-black/5">
              <img
                src={imageUrl}
                alt="Promo"
                className="w-full object-cover"
                style={{ aspectRatio: "1.91/1" }}
              />
            </div>
          )}
          <div className="px-2.5 py-2">
            <div className="text-[13px] text-[#303030] whitespace-pre-wrap leading-snug">
              {rendered}
            </div>
            <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-[#667781]">
              <span>{time}</span>
              <Check className="h-3 w-3" />
              <Check className="h-3 w-3 -ml-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
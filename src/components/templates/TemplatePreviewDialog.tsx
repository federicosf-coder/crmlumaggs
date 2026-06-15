import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, Template, EmailRecipientItem, listTemplateAttachments, getAttachmentPublicUrl, type TemplateAttachment } from "@/lib/templates";
import { useResolvedTemplate } from "@/hooks/useResolvedTemplate";
import { useQuery } from "@tanstack/react-query";
import { Paperclip } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: Template | null;
}

const PLACEHOLDER_RE = /\{[\w_]+\}/g;
const HIGHLIGHT = (m: string) =>
  `<span style="background:#fef3c7;color:#92400e;padding:1px 4px;border-radius:3px;font-weight:600">${m}</span>`;

function highlight(text: string): string {
  return (text || "").replace(PLACEHOLDER_RE, (m) => HIGHLIGHT(m));
}

function recipientsLabel(items?: EmailRecipientItem[] | null): string {
  if (!items || items.length === 0) return "";
  return items.map((i) => i.label || i.value).join(", ");
}

export function TemplatePreviewDialog({ open, onOpenChange, template }: Props) {
  if (!template) return null;
  const isEmail = template.type === "email";
  const to = recipientsLabel(template.to_emails);
  const cc = recipientsLabel(template.cc_emails);

  const { data: resolved } = useResolvedTemplate({
    body: template.body || "",
    subject: template.subject || "",
    enabled: open,
  });
  const previewBody = resolved?.resolvedBody ?? template.body ?? "";
  const previewSubject = resolved?.resolvedSubject ?? template.subject ?? "";

  const { data: attachments = [] } = useQuery<TemplateAttachment[]>({
    queryKey: ["template-attachments-preview", template.id],
    queryFn: () => listTemplateAttachments(template.id),
    enabled: open && !!template.id,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Vista previa — {template.name}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto pr-1">
          <div className="mb-3">
            <Badge variant="secondary">{CATEGORY_LABELS[template.category]}</Badge>
          </div>

          {isEmail ? (
            <div className="border rounded-lg bg-muted/30 p-4 space-y-3">
              <div className="text-sm space-y-1">
                <div><span className="text-muted-foreground">De:</span> <span className="font-medium">no-reply@lumaggs.com.mx</span></div>
                <div><span className="text-muted-foreground">Para:</span> <span className="font-medium">{to || "—"}</span></div>
                {cc && (
                  <div><span className="text-muted-foreground">CC:</span> <span className="font-medium">{cc}</span></div>
                )}
                <div><span className="text-muted-foreground">Asunto:</span> <span className="font-medium">{previewSubject || "—"}</span></div>
              </div>
              <div className="border-t" />
              <div
                className="bg-white rounded-md p-4 text-sm leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: highlight(previewBody) }}
              />
              {attachments.length > 0 && (
                <div className="bg-white rounded-md p-4 border-t text-sm">
                  <div className="flex items-center gap-1.5 font-semibold text-gray-800 mb-2">
                    <Paperclip className="h-3.5 w-3.5" /> Documentos adjuntos
                  </div>
                  <ul className="space-y-1 pl-5 list-disc">
                    {attachments.map((a) => (
                      <li key={a.id}>
                        <a href={getAttachmentPublicUrl(a.file_path)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                          {a.file_name}
                        </a>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({a.mime_type.split("/").pop()?.toUpperCase()})
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground mt-2 italic">
                    Los adjuntos se envían como enlaces de descarga dentro del cuerpo del correo.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-100 rounded-lg p-6 flex justify-center">
              <div className="w-full max-w-sm">
                <div className="bg-[#075E54] text-white text-xs px-3 py-2 rounded-t-lg">WhatsApp</div>
                <div className="bg-[#ECE5DD] p-3 rounded-b-lg min-h-[180px]">
                  <div className="ml-auto max-w-[90%] bg-[#DCF8C6] rounded-lg shadow-sm px-3 py-2">
                    <div
                      className="text-[13px] text-[#303030] whitespace-pre-wrap leading-snug"
                      dangerouslySetInnerHTML={{ __html: highlight(previewBody) }}
                    />
                    {attachments.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-[#bfd9b3] text-[12px] text-[#303030]">
                        <div className="font-semibold mb-0.5">📎 Adjuntos</div>
                        {attachments.map((a) => (
                          <div key={a.id} className="truncate">
                            • <a href={getAttachmentPublicUrl(a.file_path)} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{a.file_name}</a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
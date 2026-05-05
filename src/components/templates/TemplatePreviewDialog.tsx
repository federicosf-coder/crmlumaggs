import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, Template, EmailRecipientItem } from "@/lib/templates";

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
                <div><span className="text-muted-foreground">Asunto:</span> <span className="font-medium">{template.subject || "—"}</span></div>
              </div>
              <div className="border-t" />
              <div
                className="bg-white rounded-md p-4 text-sm leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: highlight(template.body || "") }}
              />
            </div>
          ) : (
            <div className="bg-gray-100 rounded-lg p-6 flex justify-center">
              <div className="w-full max-w-sm">
                <div className="bg-[#075E54] text-white text-xs px-3 py-2 rounded-t-lg">WhatsApp</div>
                <div className="bg-[#ECE5DD] p-3 rounded-b-lg min-h-[180px]">
                  <div className="ml-auto max-w-[90%] bg-[#DCF8C6] rounded-lg shadow-sm px-3 py-2">
                    <div
                      className="text-[13px] text-[#303030] whitespace-pre-wrap leading-snug"
                      dangerouslySetInnerHTML={{ __html: highlight(template.body || "") }}
                    />
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
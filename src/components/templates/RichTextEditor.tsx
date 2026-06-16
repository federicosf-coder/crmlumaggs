import { useEffect, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { FontFamily } from "@tiptap/extension-font-family";
import { TextAlign } from "@tiptap/extension-text-align";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Heading1, Heading2, Link as LinkIcon, Minus, ChevronDown,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Type, Palette,
  Strikethrough, RemoveFormatting, Table as TableIcon,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { TemplatePlaceholder } from "@/lib/templates";

// Custom mark attribute for inline font-size (extends TextStyle).
const FontSize = Extension.create({
  name: "fontSize",
  addOptions() { return { types: ["textStyle"] as string[] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontSize?.replace(/['"]+/g, "") || null,
          renderHTML: (attrs: any) => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }: any) =>
        chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }: any) =>
        chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    } as any;
  },
});

// Custom block attribute for line height on paragraphs and headings.
const LineHeight = Extension.create({
  name: "lineHeight",
  addOptions() { return { types: ["paragraph", "heading"] as string[] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.lineHeight || null,
          renderHTML: (attrs: any) => attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setLineHeight: (value: string) => ({ commands }: any) =>
        this.options.types.every((t: string) => commands.updateAttributes(t, { lineHeight: value })),
      unsetLineHeight: () => ({ commands }: any) =>
        this.options.types.every((t: string) => commands.resetAttributes(t, "lineHeight")),
    } as any;
  },
});

const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "Predeterminada", value: "" },
  { label: "Sans-serif", value: "Arial, Helvetica, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Monospace", value: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier", value: "'Courier New', monospace" },
];

const FONT_SIZES = ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px", "48px"];

const LINE_HEIGHTS: { label: string; value: string }[] = [
  { label: "Sencillo (1.0)", value: "1" },
  { label: "Compacto (1.15)", value: "1.15" },
  { label: "Normal (1.5)", value: "1.5" },
  { label: "Doble (2)", value: "2" },
  { label: "Amplio (2.5)", value: "2.5" },
];

const COLORS = [
  "#000000", "#374151", "#6b7280", "#9ca3af",
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#0ea5e9", "#3b82f6", "#6366f1", "#a855f7",
  "#ec4899", "#ffffff",
];

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholders?: TemplatePlaceholder[];
  placeholder?: string;
}

function ToolbarButton({
  active, onClick, title, children,
}: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", active && "bg-muted text-foreground")}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );
}

export function RichTextEditor({ value, onChange, placeholders = [], placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TextStyle,
      Color,
      FontFamily.configure({ types: ["textStyle"] }),
      FontSize,
      LineHeight,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[220px] px-3 py-2",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync external value when editing a different template
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || "") !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value]);

  const insertPlaceholder = (key: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(key + " ").run();
  };

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL:", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const sortedPlaceholders = useMemo(
    () => [...placeholders].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [placeholders]
  );

  if (!editor) return null;

  const currentFontFamily = (editor.getAttributes("textStyle") as any).fontFamily || "";
  const currentFontSize = (editor.getAttributes("textStyle") as any).fontSize || "";
  const currentColor = (editor.getAttributes("textStyle") as any).color || "";

  return (
    <div className="rounded-md border bg-background">
      <div className="flex flex-wrap items-center gap-0.5 border-b p-1">
        {/* Font family */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs min-w-[120px] justify-between" title="Fuente">
              <span className="truncate">{FONT_FAMILIES.find(f => f.value === currentFontFamily)?.label || "Fuente"}</span>
              <ChevronDown className="h-3 w-3 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {FONT_FAMILIES.map(f => (
              <DropdownMenuItem key={f.label} onSelect={() => {
                if (!f.value) editor.chain().focus().unsetFontFamily().run();
                else editor.chain().focus().setFontFamily(f.value).run();
              }}>
                <span style={{ fontFamily: f.value || undefined }}>{f.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Font size */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs min-w-[64px] justify-between" title="Tamaño de fuente">
              <span className="truncate">{currentFontSize || "Tamaño"}</span>
              <ChevronDown className="h-3 w-3 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-32">
            <DropdownMenuItem onSelect={() => (editor.chain().focus() as any).unsetFontSize().run()}>
              Predeterminado
            </DropdownMenuItem>
            {FONT_SIZES.map(s => (
              <DropdownMenuItem key={s} onSelect={() => (editor.chain().focus() as any).setFontSize(s).run()}>
                <span style={{ fontSize: s }}>{s}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton title="Negritas" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Cursiva" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Subrayado" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Tachado" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        {/* Color */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 relative" title="Color de texto">
              <Palette className="h-4 w-4" />
              <span className="absolute bottom-1 left-1.5 right-1.5 h-0.5 rounded" style={{ background: currentColor || "currentColor" }} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="p-2 w-56">
            <div className="grid grid-cols-7 gap-1.5">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className="h-6 w-6 rounded border hover:scale-110 transition-transform"
                  style={{ background: c }}
                  onClick={() => editor.chain().focus().setColor(c).run()}
                  title={c}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={currentColor || "#000000"}
                onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                className="h-7 w-10 cursor-pointer rounded border bg-transparent"
              />
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs"
                onClick={() => editor.chain().focus().unsetColor().run()}>
                Quitar color
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton title="Título 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Título 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" />
        {/* Alignment */}
        <ToolbarButton title="Alinear izquierda" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Centrar" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Alinear derecha" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Justificar" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>

        {/* Line height */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" title="Interlineado">
              <Type className="h-3.5 w-3.5" /> Interlineado <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {LINE_HEIGHTS.map(lh => (
              <DropdownMenuItem key={lh.value} onSelect={() => (editor.chain().focus() as any).setLineHeight(lh.value).run()}>
                {lh.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => (editor.chain().focus() as any).unsetLineHeight().run()}>
              Restablecer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton title="Lista con viñetas" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Lista numerada" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton title="Enlace" active={editor.isActive("link")} onClick={setLink}>
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Línea horizontal" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Quitar formato" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          <RemoveFormatting className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs">
              Insertar placeholder <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 p-0">
            <ScrollArea className="h-72">
              {sortedPlaceholders.length === 0 && (
                <div className="p-3 text-xs text-muted-foreground">Sin placeholders</div>
              )}
              {sortedPlaceholders.map((p) => (
                <DropdownMenuItem key={p.id} onSelect={() => insertPlaceholder(p.key)} className="flex flex-col items-start gap-0.5 py-2">
                  <code className="text-[11px] font-mono text-primary">{p.key}</code>
                  <span className="text-[11px] text-muted-foreground truncate w-full">{p.label}</span>
                </DropdownMenuItem>
              ))}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
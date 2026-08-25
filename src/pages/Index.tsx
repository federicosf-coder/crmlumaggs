import { useAuth } from "@/contexts/AuthContext";
import { useAlertasPendientes } from "@/hooks/useAlertasPendientes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText, Package, Truck, BookOpen, ArrowLeftRight, FolderKanban,
  GraduationCap, BarChart3, Briefcase, Wallet, FolderOpen, FileCheck, MessageCircle,
  Zap, ArrowRight, Sparkles, TrendingUp,

} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

type Mod = {
  title: string;
  description: string;
  icon: any;
  url: string;
  /** Tailwind color tokens for accent (text/border/from/to) */
  accent: {
    icon: string;       // bg + text for icon chip
    ring: string;       // hover ring color
    gradient: string;   // soft background gradient
    text: string;       // title color on hover
    dot: string;        // small status dot
  };
};

const A = {
  blue:     { icon: "bg-blue-500 text-white",       ring: "hover:ring-blue-300",     gradient: "from-blue-50 via-white to-sky-50",        text: "group-hover:text-blue-700",     dot: "bg-blue-500"     },
  red:      { icon: "bg-red-500 text-white",        ring: "hover:ring-red-300",      gradient: "from-red-50 via-white to-rose-50",        text: "group-hover:text-red-700",      dot: "bg-red-500"      },
  emerald:  { icon: "bg-emerald-500 text-white",    ring: "hover:ring-emerald-300",  gradient: "from-emerald-50 via-white to-teal-50",    text: "group-hover:text-emerald-700",  dot: "bg-emerald-500"  },
  amber:    { icon: "bg-amber-500 text-white",      ring: "hover:ring-amber-300",    gradient: "from-amber-50 via-white to-orange-50",    text: "group-hover:text-amber-700",    dot: "bg-amber-500"    },
  violet:   { icon: "bg-violet-500 text-white",     ring: "hover:ring-violet-300",   gradient: "from-violet-50 via-white to-fuchsia-50",  text: "group-hover:text-violet-700",   dot: "bg-violet-500"   },
  indigo:   { icon: "bg-indigo-500 text-white",     ring: "hover:ring-indigo-300",   gradient: "from-indigo-50 via-white to-blue-50",     text: "group-hover:text-indigo-700",   dot: "bg-indigo-500"   },
  cyan:     { icon: "bg-cyan-500 text-white",       ring: "hover:ring-cyan-300",     gradient: "from-cyan-50 via-white to-sky-50",        text: "group-hover:text-cyan-700",     dot: "bg-cyan-500"     },
  pink:     { icon: "bg-pink-500 text-white",       ring: "hover:ring-pink-300",     gradient: "from-pink-50 via-white to-rose-50",       text: "group-hover:text-pink-700",     dot: "bg-pink-500"     },
  lime:     { icon: "bg-lime-500 text-white",       ring: "hover:ring-lime-300",     gradient: "from-lime-50 via-white to-emerald-50",    text: "group-hover:text-lime-700",     dot: "bg-lime-500"     },
  orange:   { icon: "bg-orange-500 text-white",     ring: "hover:ring-orange-300",   gradient: "from-orange-50 via-white to-amber-50",    text: "group-hover:text-orange-700",   dot: "bg-orange-500"   },
  slate:    { icon: "bg-slate-700 text-white",      ring: "hover:ring-slate-300",    gradient: "from-slate-50 via-white to-zinc-50",      text: "group-hover:text-slate-800",    dot: "bg-slate-500"    },
};

// Highlight (kept at top, full-width on small screens)
const featured: Mod = {
  title: "Portal del Vendedor",
  description: "Tu centro de control diario: agenda, pendientes y oportunidades en un solo lugar.",
  icon: Briefcase,
  url: "/seller-portal",
  accent: A.indigo,
};

const groups: { title: string; subtitle: string; items: Mod[] }[] = [
  {
    title: "Comercial",
    subtitle: "Clientes, ventas y seguimiento",
    items: [
      { title: "Documentos",            description: "Cotizaciones, pedidos y facturas",     icon: FileText,      url: "/documents",  accent: A.violet },
      { title: "Productos",             description: "Catálogo y existencias",               icon: Package,       url: "/inventory",  accent: A.amber  },
      { title: "Actividades",           description: "Pendientes y seguimiento del equipo",  icon: FolderKanban,  url: "/activities", accent: A.pink   },
      { title: "Directorio",            description: "Empresas y contactos",                 icon: BookOpen,      url: "/directory",  accent: A.blue   },
      { title: "Cobranza",              description: "Pagos y aplicaciones de cobro",        icon: Wallet,        url: "/cobranza",   accent: A.emerald},
      { title: "WhatsApp",              description: "Conversaciones con clientes",          icon: MessageCircle, url: "/whatsapp",   accent: A.lime   },
      { title: "Seguimiento",           description: "Seguimiento de ventas y clientes",    icon: TrendingUp,    url: "/seguimiento", accent: A.slate  },
    ],
  },
  {
    title: "Operaciones",
    subtitle: "Inventario, entregas y logística",
    items: [
      { title: "Entregas",              description: "Programación y seguimiento de rutas",  icon: Truck,         url: "/delivery",   accent: A.orange },
      { title: "Transferencias",        description: "Movimientos entre plazas",             icon: ArrowLeftRight,url: "/transfers",  accent: A.indigo },
      { title: "Creditos",              description: "Onboarding y aprobación de crédito",   icon: FileCheck,     url: "/credito",    accent: A.cyan   },
    ],
  },
  {
    title: "Conocimiento y análisis",
    subtitle: "Información para decidir mejor",
    items: [
      { title: "Biblioteca",            description: "Recursos, fichas técnicas y guías",    icon: FolderOpen,    url: "/biblioteca", accent: A.cyan   },
      { title: "Capacitación",          description: "Aprendizaje y onboarding del equipo",  icon: GraduationCap, url: "/training",   accent: A.violet },
      { title: "Reportes",              description: "Análisis e indicadores del negocio",   icon: BarChart3,     url: "/reports",    accent: A.emerald},
      { title: "Automatizaciones",      description: "Flujos automáticos del sistema",       icon: Zap,           url: "/automations",accent: A.amber  },
    ],
  },
];

function ModuleCard({ mod, onClick, featured = false }: { mod: Mod; onClick: () => void; featured?: boolean }) {
  const Icon = mod.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden text-left rounded-2xl border border-border bg-gradient-to-br ${mod.accent.gradient} p-3 sm:p-5 transition-all duration-300 ring-0 hover:ring-2 ${mod.accent.ring} hover:-translate-y-0.5 hover:shadow-lg ${featured ? "sm:p-6 lg:p-7" : ""}`}
    >
      {/* Decorative blob */}
      <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl ${mod.accent.icon.split(" ")[0]}`} />

      <div className="relative flex items-start gap-3 sm:gap-4">
        <div className={`shrink-0 flex items-center justify-center rounded-xl shadow-sm ${mod.accent.icon} ${featured ? "h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14" : "h-9 w-9 sm:h-11 sm:w-11"}`}>
          <Icon className={featured ? "h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" : "h-4 w-4 sm:h-5 sm:w-5"} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className={`font-semibold text-foreground truncate transition-colors ${mod.accent.text} ${featured ? "text-base sm:text-lg lg:text-xl" : "text-sm sm:text-base"}`}>
              {mod.title}
            </h3>
            <ArrowRight className="h-4 w-4 text-muted-foreground/60 shrink-0 transition-all duration-300 group-hover:text-foreground group-hover:translate-x-0.5" />
          </div>
          <p className={`mt-1 text-muted-foreground leading-snug ${featured ? "text-xs sm:text-sm" : "text-[11px] sm:text-xs"}`}>
            {mod.description}
          </p>
          {featured && (
            <div className="mt-2 sm:mt-3 inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-indigo-700">
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              Recomendado para empezar el día
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default function Index() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const firstName = (profile?.full_name || "Usuario").split(" ")[0];

  return (
    <div className="space-y-5 sm:space-y-8 pb-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-border bg-gradient-to-br from-blue-600 via-indigo-600 to-rose-500 p-4 sm:p-8 text-white shadow-md">
        <div className="absolute inset-0 opacity-30 pointer-events-none" aria-hidden>
          <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute right-10 -bottom-16 h-56 w-56 rounded-full bg-amber-300/40 blur-3xl" />
          <div className="absolute left-1/3 top-1/2 h-32 w-32 rounded-full bg-emerald-300/30 blur-3xl" />
        </div>
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-[11px] font-medium uppercase tracking-wider backdrop-blur-sm">
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            LubriManager
          </span>
          <h1 className="mt-2 sm:mt-3 text-lg sm:text-4xl font-bold leading-tight">
            Bienvenido, {firstName} 👋
          </h1>
          <p className="mt-1 sm:mt-2 max-w-2xl text-xs sm:text-base text-white/85">
            Plataforma de distribución de lubricantes <span className="font-semibold">Chevron</span> y <span className="font-semibold">Phillips 66</span>. Elige por dónde empezar hoy.
          </p>
        </div>
      </section>

      {/* Featured: Portal del Vendedor (siempre debajo de Inicio) */}
      <section>
        <div className="grid grid-cols-1 gap-4">
          <ModuleCard mod={featured} onClick={() => navigate(featured.url)} featured />
        </div>
      </section>

      {/* Groups */}
      {groups.map((g) => (
        <section key={g.title} className="space-y-2 sm:space-y-3">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight">{g.title}</h2>
              <p className="text-[11px] sm:text-xs text-muted-foreground">{g.subtitle}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
            {g.items.map((mod) => (
              <ModuleCard key={mod.url} mod={mod} onClick={() => navigate(mod.url)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIndustriasCatalog } from "@/hooks/useIndustriasCatalog";
import {
  type DatosClienteAutorizacion,
  TIPO_DESTINO_OPTS,
  LISTA_PRECIOS_OPTIONS,
  TIPO_PAGO_OPTS,
  METODO_PAGO_OPTS,
  FORMA_PAGO_OPTS,
  USO_CFDI_OPTS,
} from "@/lib/autorizacionDatosCliente";

type Opt = { v: string; l: string };

export function AutorizacionDatosClienteBlock({
  value,
  onChange,
  disabled,
}: {
  value: DatosClienteAutorizacion;
  onChange: (next: DatosClienteAutorizacion) => void;
  disabled?: boolean;
}) {
  const { data: industriasCatalog = [] } = useIndustriasCatalog();

  const set = <K extends keyof DatosClienteAutorizacion>(
    key: K,
    v: DatosClienteAutorizacion[K]
  ) => onChange({ ...value, [key]: v });

  const renderSelect = (
    label: string,
    key: keyof DatosClienteAutorizacion,
    opts: Opt[]
  ) => (
    <div className="space-y-1">
      <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
      <Select
        disabled={disabled}
        value={(value[key] as string) || "none"}
        onValueChange={(v) => set(key, (v === "none" ? null : v) as any)}
      >
        <SelectTrigger className="h-8 font-light text-sm">
          <SelectValue placeholder="Sin definir" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Sin definir</SelectItem>
          {opts.map((o) => (
            <SelectItem key={o.v} value={o.v}>
              {o.l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const industriasDisponibles = industriasCatalog.filter(
    (c) => !value.industrias.includes(c.clave)
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Clasificación</p>

        <div className="space-y-1">
          <Label className="text-xs font-normal text-muted-foreground">
            Industria (multiopción)
          </Label>
          <div className="flex flex-wrap gap-1">
            {value.industrias.length === 0 && (
              <span className="text-sm text-muted-foreground italic">Sin industrias</span>
            )}
            {value.industrias.map((ind) => (
              <Badge key={ind} variant="secondary" className="font-light py-0 h-5">
                {industriasCatalog.find((c) => c.clave === ind)?.etiqueta || ind}
                {!disabled && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-3.5 w-3.5 ml-1"
                    onClick={() =>
                      set(
                        "industrias",
                        value.industrias.filter((i) => i !== ind)
                      )
                    }
                  >
                    <X className="h-2.5 w-2.5" />
                  </Button>
                )}
              </Badge>
            ))}
          </div>
          {!disabled && (
            <Select
              value=""
              onValueChange={(v) => {
                if (v && !value.industrias.includes(v)) {
                  set("industrias", [...value.industrias, v]);
                }
              }}
            >
              <SelectTrigger className="h-8 font-light text-sm">
                <SelectValue placeholder="Agregar industria..." />
              </SelectTrigger>
              <SelectContent>
                {industriasDisponibles.map((o) => (
                  <SelectItem key={o.clave} value={o.clave}>
                    {o.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {renderSelect(
            "Tipo según destino del lubricante",
            "tipo_destino_lubricante",
            TIPO_DESTINO_OPTS
          )}
          {renderSelect("Lista de precios", "lista_precios", LISTA_PRECIOS_OPTIONS)}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Detalles de facturación
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs font-normal text-muted-foreground">
              Límite de crédito
            </Label>
            <Input
              type="number"
              step="0.01"
              disabled={disabled}
              className="h-8 font-light text-sm"
              value={value.limite_credito ?? ""}
              placeholder="0.00"
              onChange={(e) =>
                set("limite_credito", e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </div>
          {renderSelect("Tipo de Pago", "tipo_pago", TIPO_PAGO_OPTS)}
          {renderSelect("Forma de Pago (SAT)", "forma_pago", FORMA_PAGO_OPTS)}
          {renderSelect("Método de Pago", "metodo_pago", METODO_PAGO_OPTS)}
          {renderSelect("Uso de CFDI", "uso_cfdi", USO_CFDI_OPTS)}
        </div>
      </div>
    </div>
  );
}

import { useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DictadoButtonProps {
  onResult: (textoNuevo: string) => void;
  className?: string;
}

export function DictadoButton({ onResult, className }: DictadoButtonProps) {
  const [escuchando, setEscuchando] = useState(false);
  const recognitionRef = useRef<any>(null);

  const SpeechRecognition =
    typeof window !== "undefined" &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  if (!SpeechRecognition) return null;

  const toggle = () => {
    if (escuchando) {
      recognitionRef.current?.stop();
      return;
    }
    try {
      const rec = new SpeechRecognition();
      recognitionRef.current = rec;
      rec.lang = "es-MX";
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (e: any) => {
        const texto = Array.from(e.results)
          .slice(e.resultIndex)
          .map((r: any) => r[0]?.transcript || "")
          .join(" ")
          .trim();
        if (texto) onResult(texto);
      };
      rec.onerror = (e: any) => {
        setEscuchando(false);
        if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
          toast.error("Permiso de micrófono denegado");
        } else if (e?.error && e.error !== "aborted" && e.error !== "no-speech") {
          toast.error("No se pudo usar el dictado por voz");
        }
      };
      rec.onend = () => setEscuchando(false);
      rec.start();
      setEscuchando(true);
    } catch {
      setEscuchando(false);
      toast.error("No se pudo iniciar el dictado por voz");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title="Dictar por voz"
      onClick={toggle}
      className={cn("h-7 w-7", escuchando && "animate-pulse text-red-600", className)}
    >
      {escuchando ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}

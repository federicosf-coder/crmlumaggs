import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DictationButtonProps {
  onTranscript: (text: string) => void;
  /** Idioma BCP-47, por defecto es-MX */
  lang?: string;
  className?: string;
  size?: "sm" | "icon";
  title?: string;
}

/**
 * Botón de dictado por voz usando la Web Speech API del navegador.
 * Pulsa para iniciar/detener; entrega el texto reconocido vía onTranscript.
 */
export function DictationButton({
  onTranscript,
  lang = "es-MX",
  className,
  size = "icon",
  title = "Dictar por voz",
}: DictationButtonProps) {
  const { toast } = useToast();
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef<string>("");

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch {}
    };
  }, []);

  const start = () => {
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({
        title: "Dictado no disponible",
        description: "Tu navegador no soporta el reconocimiento de voz. Prueba con Chrome o Edge.",
        variant: "destructive",
      });
      return;
    }
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    let finalText = "";
    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      const combined = (baseTextRef.current
        ? baseTextRef.current.replace(/\s+$/, "") + " "
        : "") + (finalText + interim).trimStart();
      onTranscript(combined);
    };
    rec.onerror = (e: any) => {
      setListening(false);
      if (e?.error && e.error !== "aborted" && e.error !== "no-speech") {
        toast({
          title: "Error de dictado",
          description: e.error === "not-allowed"
            ? "Permiso de micrófono denegado."
            : String(e.error),
          variant: "destructive",
        });
      }
    };
    rec.onend = () => setListening(false);

    try {
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const stop = () => {
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (listening) {
      stop();
    } else {
      // Capturamos el texto actual desde el padre vía un truco: el padre puede
      // pasar el texto base al hacer click usando data-base-text en el botón.
      const base = (e.currentTarget as HTMLElement).dataset.baseText || "";
      baseTextRef.current = base;
      start();
    }
  };

  return (
    <Button
      type="button"
      variant={listening ? "default" : "outline"}
      size={size}
      onClick={handleClick}
      title={title}
      className={cn(
        "shrink-0",
        listening && "bg-rose-500 hover:bg-rose-600 text-white animate-pulse",
        className,
      )}
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}
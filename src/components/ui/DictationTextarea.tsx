import { useState, useRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface DictationTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
}

export function DictationTextarea({
  value,
  onChange,
  className,
  disabled,
  ...props
}: DictationTextareaProps) {
  const [listening, setListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const toggleDictation = useCallback(() => {
    const SpeechRecognition =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      null;

    if (!SpeechRecognition) {
      toast.error("Tu navegador no soporta dictado por voz");
      return;
    }

    if (!listening) {
      const recognition = new SpeechRecognition();
      recognition.lang = "es-MX";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          }
        }

        if (!finalTranscript) return;

        const el = textareaRef.current;
        if (el && typeof el.selectionStart === "number") {
          const start = el.selectionStart || 0;
          const end = el.selectionEnd || 0;
          const before = value.slice(0, start);
          const after = value.slice(end);
          const insertion = finalTranscript.trim() + " ";
          const newValue = (before + insertion + after).trimStart();
          onChange(newValue);
          const cursor = start + insertion.length;
          requestAnimationFrame(() => {
            el.selectionStart = el.selectionEnd = cursor;
            el.focus();
          });
        } else {
          onChange((value + " " + finalTranscript).trim());
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed") {
          toast.error("Permiso de micrófono denegado");
        } else if (event.error === "no-speech") {
          toast.info("No se detectó voz");
        } else if (event.error === "aborted") {
          // Usuario detuvo o cambió de campo; no mostrar error.
        } else {
          toast.error("Error de dictado: " + event.error);
        }
        setListening(false);
      };

      recognition.onend = () => {
        setListening(false);
      };

      try {
        recognition.start();
        (window as any).__dictationRecognition = recognition;
        setListening(true);
      } catch (e) {
        toast.error("No se pudo iniciar el dictado");
      }
    } else {
      const recognition = (window as any).__dictationRecognition;
      if (recognition) {
        try {
          recognition.stop();
        } catch {}
      }
      setListening(false);
    }
  }, [listening, onChange, value]);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn("pr-10", className)}
        {...props}
      />
      <Button
        type="button"
        size="icon"
        variant={listening ? "default" : "ghost"}
        className="absolute top-2 right-2 h-7 w-7"
        onClick={toggleDictation}
        disabled={disabled}
        title={listening ? "Detener dictado" : "Dictar con micrófono"}
      >
        {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>
    </div>
  );
}

import { useCallback, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Tracks autosave status and provides a debounced saver per field.
 * - Text fields: call scheduleSave(key, value) to debounce.
 * - Select/blur events: call saveNow(key, value) to save immediately.
 * Avoids duplicate saves if the value did not change.
 */
export function useAutosaveStatus(
  saveFn: (changes: Record<string, any>) => Promise<void>,
  debounceMs = 800
) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const lastSavedRef = useRef<Record<string, any>>({});
  const timersRef = useRef<Record<string, any>>({});
  const enabledRef = useRef(false);

  const setEnabled = useCallback((on: boolean) => {
    enabledRef.current = on;
  }, []);

  const seed = useCallback((values: Record<string, any>) => {
    lastSavedRef.current = { ...values };
  }, []);

  const doSave = useCallback(
    async (changes: Record<string, any>) => {
      // Filter out unchanged values (compare by JSON for arrays)
      const filtered: Record<string, any> = {};
      for (const k of Object.keys(changes)) {
        const prev = lastSavedRef.current[k];
        const next = changes[k];
        const same =
          prev === next ||
          (Array.isArray(prev) && Array.isArray(next) && JSON.stringify(prev) === JSON.stringify(next));
        if (!same) filtered[k] = next;
      }
      if (Object.keys(filtered).length === 0) return;

      setStatus("saving");
      try {
        await saveFn(filtered);
        Object.assign(lastSavedRef.current, filtered);
        setStatus("saved");
      } catch (e) {
        setStatus("error");
      }
    },
    [saveFn]
  );

  const scheduleSave = useCallback(
    (key: string, value: any) => {
      if (!enabledRef.current) return;
      if (timersRef.current[key]) clearTimeout(timersRef.current[key]);
      timersRef.current[key] = setTimeout(() => {
        doSave({ [key]: value });
      }, debounceMs);
    },
    [doSave, debounceMs]
  );

  const saveNow = useCallback(
    (key: string, value: any) => {
      if (!enabledRef.current) return;
      if (timersRef.current[key]) {
        clearTimeout(timersRef.current[key]);
        delete timersRef.current[key];
      }
      return doSave({ [key]: value });
    },
    [doSave]
  );

  return { status, setStatus, seed, setEnabled, scheduleSave, saveNow, doSave };
}

export function AutosaveIndicatorText(status: AutosaveStatus): string {
  switch (status) {
    case "saving":
      return "Guardando…";
    case "saved":
      return "Guardado";
    case "error":
      return "Error al guardar";
    default:
      return "";
  }
}
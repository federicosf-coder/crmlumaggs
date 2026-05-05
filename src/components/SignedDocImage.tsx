import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { extractDocFilesPath } from "@/lib/storageSignedUrl";

/**
 * Renderiza un <img> usando un URL firmado del bucket privado document-files.
 * Acepta el URL público antiguo o un path crudo.
 */
export function SignedDocImage({
  src,
  alt,
  className,
  expiresIn = 3600,
}: {
  src: string;
  alt?: string;
  className?: string;
  expiresIn?: number;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      const path = extractDocFilesPath(src);
      const { data } = await supabase.storage
        .from("document-files")
        .createSignedUrl(path, expiresIn);
      if (active) setUrl(data?.signedUrl ?? null);
    })();
    return () => { active = false; };
  }, [src, expiresIn]);
  if (!url) return <div className={className} aria-label={alt} />;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
import { useQuery } from '@tanstack/react-query';
import { resolveTemplate } from '@/lib/resolveTemplate';

interface Params {
  body?: string;
  subject?: string;
  documentoId?: string;
  contactoId?: string;
  pagoId?: string;
  enabled?: boolean;
}

export function useResolvedTemplate({
  body = '',
  subject = '',
  documentoId,
  contactoId,
  pagoId,
  enabled = true,
}: Params) {
  return useQuery({
    queryKey: ['resolved-template', body, subject, documentoId, contactoId, pagoId],
    queryFn: async () => ({
      resolvedBody: await resolveTemplate(body, { documentoId, contactoId, pagoId }),
      resolvedSubject: subject
        ? await resolveTemplate(subject, { documentoId, contactoId, pagoId })
        : subject,
    }),
    enabled: enabled && (!!body || !!subject),
    staleTime: 30_000,
  });
}
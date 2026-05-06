import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'

interface RawHtmlProps {
  __html?: string
}

// Minimal pass-through component: the actual HTML is provided via htmlOverride
// in send-transactional-email, so this component renders a placeholder.
// React Email will still render this if htmlOverride is missing.
const RawHtmlEmail = ({ __html }: RawHtmlProps) =>
  React.createElement('div', {
    dangerouslySetInnerHTML: { __html: __html || '' },
  })

export const template = {
  component: RawHtmlEmail,
  subject: (data: Record<string, any>) => data?.__subject || 'Mensaje',
  displayName: 'HTML personalizado (automatización)',
  previewData: { __html: '<p>Contenido</p>', __subject: 'Asunto' },
} satisfies TemplateEntry
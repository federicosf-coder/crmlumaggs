import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Lumaggs CRM'

interface PagoConfirmationProps {
  empresa?: string
  fechaPago?: string
  montoTotal?: string
  moneda?: string
  observaciones?: string
  documentos?: Array<{ tipo: string; numero: string; monto: string }>
  comprobantes?: Array<{ nombre: string; url: string }>
  registradoPor?: string
}

const PagoConfirmationEmail = ({
  empresa,
  fechaPago,
  montoTotal,
  moneda,
  observaciones,
  documentos,
  comprobantes,
  registradoPor,
}: PagoConfirmationProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>
      Confirmación de pago registrado{empresa ? ` — ${empresa}` : ''}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Pago registrado</Heading>
        <Text style={text}>
          Se ha registrado un nuevo pago en {SITE_NAME}
          {registradoPor ? ` por ${registradoPor}` : ''}.
        </Text>

        <Section style={card}>
          <Row label="Empresa" value={empresa || '—'} />
          <Row label="Fecha de pago" value={fechaPago || '—'} />
          <Row
            label="Monto total"
            value={`${montoTotal || '0.00'} ${moneda || 'MXN'}`}
            highlight
          />
        </Section>

        {documentos && documentos.length > 0 && (
          <>
            <Heading as="h2" style={h2}>
              Documentos ligados
            </Heading>
            <Section style={card}>
              {documentos.map((d, i) => (
                <div key={i} style={docRow}>
                  <Text style={docText}>
                    <strong>{d.tipo}</strong> {d.numero}
                  </Text>
                  <Text style={docAmount}>{d.monto}</Text>
                </div>
              ))}
            </Section>
          </>
        )}

        {comprobantes && comprobantes.length > 0 && (
          <>
            <Heading as="h2" style={h2}>
              Comprobantes
            </Heading>
            <Section style={card}>
              {comprobantes.map((c, i) => (
                <div key={i} style={docRow}>
                  <Link href={c.url} style={linkStyle}>
                    {c.nombre}
                  </Link>
                </div>
              ))}
            </Section>
          </>
        )}

        {observaciones && (
          <>
            <Heading as="h2" style={h2}>
              Observaciones
            </Heading>
            <Text style={text}>{observaciones}</Text>
          </>
        )}

        <Hr style={hr} />
        <Text style={footer}>
          Este es un correo automático de {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

const Row = ({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) => (
  <div style={rowStyle}>
    <Text style={rowLabel}>{label}</Text>
    <Text style={highlight ? rowValueHighlight : rowValue}>{value}</Text>
  </div>
)

export const template = {
  component: PagoConfirmationEmail,
  subject: (data: Record<string, any>) =>
    `Pago registrado${data?.empresa ? ` — ${data.empresa}` : ''}`,
  displayName: 'Confirmación de pago',
  previewData: {
    empresa: 'Empresa Demo S.A.',
    fechaPago: '2026-04-16',
    montoTotal: '15,000.00',
    moneda: 'MXN',
    observaciones: 'Pago a cuenta de facturas pendientes.',
    documentos: [
      { tipo: 'Factura', numero: 'F-001', monto: '$10,000.00' },
      { tipo: 'Factura', numero: 'F-002', monto: '$5,000.00' },
    ],
    comprobantes: [
      { nombre: 'comprobante.pdf', url: 'https://example.com/file.pdf' },
    ],
    registradoPor: 'Juan Pérez',
  },
} satisfies TemplateEntry

const linkStyle = {
  fontSize: '13px',
  color: '#2563eb',
  textDecoration: 'underline',
}

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
}
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const h1 = {
  fontSize: '22px',
  fontWeight: '700',
  color: '#0f172a',
  margin: '0 0 16px',
}
const h2 = {
  fontSize: '15px',
  fontWeight: '600',
  color: '#0f172a',
  margin: '24px 0 8px',
}
const text = {
  fontSize: '14px',
  color: '#475569',
  lineHeight: '1.6',
  margin: '0 0 12px',
}
const card = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '12px 16px',
  margin: '8px 0',
}
const rowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  borderBottom: '1px solid #e2e8f0',
  padding: '6px 0',
}
const rowLabel = {
  fontSize: '13px',
  color: '#64748b',
  margin: '0',
}
const rowValue = {
  fontSize: '13px',
  color: '#0f172a',
  fontWeight: '500',
  margin: '0',
}
const rowValueHighlight = {
  fontSize: '15px',
  color: '#0f172a',
  fontWeight: '700',
  margin: '0',
}
const docRow = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '4px 0',
}
const docText = { fontSize: '13px', color: '#0f172a', margin: '0' }
const docAmount = {
  fontSize: '13px',
  color: '#0f172a',
  fontWeight: '600',
  margin: '0',
}
const hr = { border: 'none', borderTop: '1px solid #e2e8f0', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '0' }

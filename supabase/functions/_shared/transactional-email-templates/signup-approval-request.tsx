/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  newUserName?: string
  newUserEmail?: string
  newUserPhone?: string
  reviewUrl?: string
}

const SignupApprovalRequestEmail = ({
  newUserName,
  newUserEmail,
  newUserPhone,
  reviewUrl,
}: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Nuevo registro pendiente de aprobación</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nuevo usuario pendiente de aprobación</Heading>
        <Text style={text}>
          Se ha registrado un nuevo usuario en la plataforma y requiere tu aprobación
          para poder acceder.
        </Text>

        <Section style={card}>
          <Text style={label}>Nombre</Text>
          <Text style={value}>{newUserName || '—'}</Text>
          <Hr style={hr} />
          <Text style={label}>Correo</Text>
          <Text style={value}>{newUserEmail || '—'}</Text>
          {newUserPhone && (
            <>
              <Hr style={hr} />
              <Text style={label}>Teléfono</Text>
              <Text style={value}>{newUserPhone}</Text>
            </>
          )}
        </Section>

        {reviewUrl && (
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={reviewUrl} style={button}>
              Revisar solicitud
            </Button>
          </Section>
        )}

        <Text style={footer}>
          Este es un correo automático del sistema. Recibes esta notificación
          porque eres administrador de la plataforma.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SignupApprovalRequestEmail,
  subject: 'Nuevo registro pendiente de aprobación',
  displayName: 'Solicitud de aprobación de registro',
  previewData: {
    newUserName: 'Juan Pérez',
    newUserEmail: 'juan@ejemplo.com',
    newUserPhone: '55 1234 5678',
    reviewUrl: 'https://portal.lumaggs.com.mx/admin/users',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 20px' }
const card = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px' }
const label = { fontSize: '11px', textTransform: 'uppercase' as const, color: '#64748b', margin: '0', letterSpacing: '0.05em' }
const value = { fontSize: '15px', color: '#0f172a', margin: '4px 0 0', fontWeight: 500 }
const hr = { borderColor: '#e2e8f0', margin: '12px 0' }
const button = { backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 24px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 600, display: 'inline-block' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0', textAlign: 'center' as const }

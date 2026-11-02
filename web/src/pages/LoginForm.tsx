import { Button, Field, Heading, Input, Stack, Text } from '@chakra-ui/react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { describeError } from '../lib/errors'

/**
 * Inloggen met een code uit de e-mail. Daarmee is het e-mailadres meteen
 * geverifieerd (requirement 10): er is geen wachtwoord om te onthouden of te lekken.
 */
export function LoginForm({ title = 'Inloggen', intro }: { title?: string; intro?: string }) {
  const { requestCode, verifyCode } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setError(null)
    try {
      await requestCode(email)
      setSent(true)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    setError(null)
    try {
      await verifyCode(email, code)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack gap="4" as="form" onSubmit={sent ? verify : send}>
      <Heading size="xl">{title}</Heading>
      {intro && <Text color="fg.muted">{intro}</Text>}

      <Field.Root required disabled={sent}>
        <Field.Label>E-mailadres</Field.Label>
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="naam@voorbeeld.nl"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field.Root>

      {sent && (
        <Field.Root required invalid={error !== null}>
          <Field.Label>Code uit de e-mail</Field.Label>
          <Input
            autoFocus
            autoComplete="one-time-code"
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Field.HelperText>We hebben een code gestuurd naar {email.trim()}. Kijk ook in je spam.</Field.HelperText>
        </Field.Root>
      )}

      {error && (
        <Text color="red.600" role="alert">
          {error}
        </Text>
      )}

      <Button type="submit" colorPalette="green" loading={busy} disabled={sent ? !code.trim() : !email.trim()}>
        {sent ? 'Inloggen' : 'Stuur me een code'}
      </Button>
      {sent && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setSent(false)
            setCode('')
            setError(null)
          }}
        >
          Ander e-mailadres of nieuwe code
        </Button>
      )}
    </Stack>
  )
}

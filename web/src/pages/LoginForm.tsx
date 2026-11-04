import { Button, Field, Heading, Input, Stack, Text } from '@chakra-ui/react'
import { useState, type FormEvent } from 'react'
import { useAuth, type CodePurpose } from '../auth/AuthProvider'
import { describeError } from '../lib/errors'

type Mode = 'password' | CodePurpose

/**
 * Inloggen met e-mailadres en wachtwoord. Een nieuw account en "wachtwoord
 * vergeten" gaan met een code uit de e-mail: zo is het e-mailadres één keer
 * geverifieerd (requirement 10). Daarna kies je een wachtwoord en blijf je ingelogd.
 */
export function LoginForm({ title, intro }: { title?: string; intro?: string }) {
  const { requestCode, verifyCode, signInWithPassword } = useAuth()
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function switchTo(next: Mode) {
    setMode(next)
    setSent(false)
    setCode('')
    setPassword('')
    setError(null)
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    if (mode === 'password') {
      if (!password) return
      void run(() => signInWithPassword(email, password))
    } else if (!sent) {
      void run(async () => {
        await requestCode(email, mode)
        setSent(true)
      })
    } else if (code.trim()) {
      // Na de code vraagt de app om een (nieuw) wachtwoord.
      void run(() => verifyCode(email, code))
    }
  }

  const heading =
    mode === 'signup' ? 'Account maken' : mode === 'reset' ? 'Wachtwoord vergeten' : (title ?? 'Inloggen')
  const explanation =
    mode === 'signup'
      ? 'Vul je e-mailadres in. Je krijgt een code om je adres te bevestigen. Daarna kies je een wachtwoord.'
      : mode === 'reset'
        ? 'Vul het e-mailadres van je account in. Je krijgt een code, daarna kies je een nieuw wachtwoord.'
        : intro

  const submitLabel =
    mode === 'password' ? 'Inloggen' : sent ? 'Bevestigen' : 'Stuur me een code'
  const canSubmit = email.trim() !== '' && (mode === 'password' ? password !== '' : !sent || code.trim() !== '')

  return (
    <Stack gap="4" as="form" onSubmit={submit}>
      <Heading size="xl">{heading}</Heading>
      {explanation && <Text color="fg.muted">{explanation}</Text>}

      <Field.Root required disabled={sent}>
        <Field.Label>E-mailadres</Field.Label>
        <Input
          type="email"
          name="email"
          autoComplete={mode === 'signup' ? 'email' : 'username'}
          inputMode="email"
          placeholder="naam@voorbeeld.nl"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field.Root>

      {mode === 'password' && (
        <Field.Root required>
          <Field.Label>Wachtwoord</Field.Label>
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field.Root>
      )}

      {mode !== 'password' && sent && (
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

      <Button type="submit" colorPalette="green" loading={busy} disabled={!canSubmit}>
        {submitLabel}
      </Button>

      {mode === 'password' ? (
        <Stack gap="1">
          <Button type="button" variant="ghost" onClick={() => switchTo('reset')}>
            Wachtwoord vergeten?
          </Button>
          <Button type="button" variant="ghost" onClick={() => switchTo('signup')}>
            Nog geen account? Account maken
          </Button>
        </Stack>
      ) : (
        <Stack gap="1">
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
          <Button type="button" variant="ghost" onClick={() => switchTo('password')}>
            Terug naar inloggen
          </Button>
        </Stack>
      )}
    </Stack>
  )
}

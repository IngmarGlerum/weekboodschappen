import { Box, Button, Field, Heading, Input, Stack, Text } from '@chakra-ui/react'
import { useState, type FormEvent } from 'react'
import { MIN_PASSWORD_LENGTH, useAuth } from '../auth/AuthProvider'
import { notify } from '../components/toaster'
import { describeError } from '../lib/errors'

/**
 * Na een code uit de e-mail (nieuw account of wachtwoord vergeten) kies je een
 * wachtwoord. Daarna log je voortaan in met e-mailadres en wachtwoord.
 */
export default function SetPasswordPage() {
  const { user, setPassword, signOut } = useAuth()
  const [password, setPw] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH
  const mismatch = repeat.length > 0 && repeat !== password
  const canSave = password.length >= MIN_PASSWORD_LENGTH && repeat === password

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setBusy(true)
    setError(null)
    try {
      await setPassword(password)
      notify.success('Wachtwoord opgeslagen')
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box minH="100dvh" bg="bg.subtle" display="flex" alignItems="center" justifyContent="center" px="4" py="8">
      <Stack gap="4" w="full" maxW="420px" bg="bg" p="6" rounded="lg" borderWidth="1px" as="form" onSubmit={submit}>
        <Heading size="xl">Kies een wachtwoord</Heading>
        <Text color="fg.muted">
          Je e-mailadres {user?.email} is bevestigd. Kies een wachtwoord; daarmee log je voortaan in. Op dit apparaat
          blijf je ingelogd.
        </Text>
        {/* Voor wachtwoordbeheerders: het bijbehorende e-mailadres. */}
        <input type="email" name="email" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
        <Field.Root required invalid={tooShort}>
          <Field.Label>Nieuw wachtwoord</Field.Label>
          <Input
            type="password"
            name="new-password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPw(e.target.value)}
          />
          <Field.HelperText>Minstens {MIN_PASSWORD_LENGTH} tekens.</Field.HelperText>
        </Field.Root>
        <Field.Root required invalid={mismatch}>
          <Field.Label>Herhaal het wachtwoord</Field.Label>
          <Input
            type="password"
            name="repeat-password"
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
          {mismatch && <Field.ErrorText>De wachtwoorden zijn niet gelijk.</Field.ErrorText>}
        </Field.Root>
        {error && (
          <Text color="red.600" role="alert">
            {error}
          </Text>
        )}
        <Button type="submit" colorPalette="green" loading={busy} disabled={!canSave}>
          Wachtwoord opslaan
        </Button>
        <Button type="button" variant="ghost" onClick={() => void signOut()}>
          Uitloggen
        </Button>
      </Stack>
    </Box>
  )
}

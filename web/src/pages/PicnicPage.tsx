import { Badge, Box, Button, Card, Field, HStack, Heading, IconButton, Input, Spinner, Stack, Text } from '@chakra-ui/react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { LuArrowLeft } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { useCurrentHousehold } from '../auth/HouseholdProvider'
import { notify } from '../components/toaster'
import { picnicApi, picnicConfigured, PicnicApiError, type PicnicStatus } from '../lib/picnicApi'

/**
 * Picnic koppelen aan de gekozen planning: één keer inloggen met het Picnic-account
 * (met sms-code). De server bewaart alleen de sleutel die Picnic teruggeeft, versleuteld;
 * het wachtwoord wordt niet bewaard. De koppeling geldt voor alle leden van de planning.
 */
export default function PicnicPage() {
  const navigate = useNavigate()
  const household = useCurrentHousehold()
  const [status, setStatus] = useState<PicnicStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'login' | 'code'>('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!picnicConfigured()) return
    try {
      const s = await picnicApi.status(household.id)
      setStatus(s)
      setStep(s.secondFactorPending ? 'code' : 'login')
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }, [household.id])

  useEffect(() => {
    void load()
  }, [load])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof PicnicApiError || e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function login(e: FormEvent) {
    e.preventDefault()
    void run(async () => {
      const result = await picnicApi.login(household.id, email.trim(), password)
      setPassword('')
      if (result.status === 'second_factor_required') setStep('code')
      else {
        notify.success('Picnic is gekoppeld')
        await load()
      }
    })
  }

  function verify(e: FormEvent) {
    e.preventDefault()
    void run(async () => {
      await picnicApi.verify(household.id, code.trim())
      setCode('')
      notify.success('Picnic is gekoppeld')
      await load()
    })
  }

  function logout() {
    void run(async () => {
      await picnicApi.logout(household.id)
      notify.success('Picnic is ontkoppeld')
      await load()
    })
  }

  return (
    <Stack gap="5">
      <HStack>
        <IconButton variant="ghost" aria-label="Terug" onClick={() => navigate(-1)}>
          <LuArrowLeft />
        </IconButton>
        <Heading size="lg">Picnic</Heading>
      </HStack>

      {!picnicConfigured() ? (
        <Text color="fg.muted">
          De Picnic-koppeling is nog niet ingesteld. Zodra de Picnic-server online staat, verschijnt hier de knop om
          in te loggen.
        </Text>
      ) : loadError ? (
        <Stack gap="2">
          <Text color="red.600" role="alert">
            {loadError}
          </Text>
          <Button variant="outline" alignSelf="flex-start" onClick={() => void load()}>
            Opnieuw proberen
          </Button>
        </Stack>
      ) : !status ? (
        <Spinner />
      ) : status.connected ? (
        <Card.Root variant="outline">
          <Card.Body gap="3">
            <HStack justify="space-between">
              <Text fontWeight="semibold">Gekoppeld met Picnic</Text>
              <Badge colorPalette="green">Actief</Badge>
            </HStack>
            <Text color="fg.muted" fontSize="sm">
              Voor de planning "{household.name}". Iedereen in deze planning kan nu producten kiezen en het mandje vullen.
            </Text>
            {error && (
              <Text color="red.600" fontSize="sm" role="alert">
                {error}
              </Text>
            )}
            <Button variant="outline" colorPalette="red" alignSelf="flex-start" loading={busy} onClick={logout}>
              Ontkoppelen
            </Button>
          </Card.Body>
        </Card.Root>
      ) : step === 'login' ? (
        <Stack gap="4" as="form" onSubmit={login}>
          <Text color="fg.muted">
            Log één keer in met jullie Picnic-account. Het wachtwoord wordt niet bewaard; Picnic stuurt daarna een
            sms-code naar het telefoonnummer van het account.
          </Text>
          <Field.Root required>
            <Field.Label>E-mailadres bij Picnic</Field.Label>
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field.Root>
          <Field.Root required>
            <Field.Label>Wachtwoord bij Picnic</Field.Label>
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field.Root>
          {error && (
            <Text color="red.600" role="alert">
              {error}
            </Text>
          )}
          <Button type="submit" colorPalette="green" loading={busy} disabled={!email.trim() || !password}>
            Inloggen bij Picnic
          </Button>
        </Stack>
      ) : (
        <Stack gap="4" as="form" onSubmit={verify}>
          <Text color="fg.muted">Picnic heeft een sms gestuurd met een code. Vul die hier in.</Text>
          <Field.Root required>
            <Field.Label>Code uit de sms</Field.Label>
            <Input autoFocus autoComplete="one-time-code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field.Root>
          {error && (
            <Text color="red.600" role="alert">
              {error}
            </Text>
          )}
          <Button type="submit" colorPalette="green" loading={busy} disabled={!code.trim()}>
            Bevestigen
          </Button>
          <Box>
            <Button variant="ghost" size="sm" onClick={() => setStep('login')}>
              Opnieuw beginnen
            </Button>
          </Box>
        </Stack>
      )}
    </Stack>
  )
}

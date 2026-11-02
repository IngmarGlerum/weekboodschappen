import { Box, Button, Field, Heading, Input, Stack, Text } from '@chakra-ui/react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useHousehold } from '../auth/HouseholdProvider'
import { describeError } from '../lib/errors'

/** Eerste keer inloggen zonder uitnodiging: maak een huishouden aan. */
export default function StartPage() {
  const { household, createHousehold } = useHousehold()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('Ons huishouden')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (household) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await createHousehold(name.trim())
      navigate('/', { replace: true })
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box minH="100dvh" bg="bg.subtle" display="flex" alignItems="center" justifyContent="center" px="4" py="8">
      <Stack gap="5" w="full" maxW="420px" bg="bg" p="6" rounded="lg" borderWidth="1px" as="form" onSubmit={submit}>
        <Heading size="xl">Welkom!</Heading>
        <Text color="fg.muted">
          Je bent ingelogd als {user?.email}. Maak een huishouden aan om samen te plannen. Daarna nodig je je partner
          uit via de pagina Huishouden. Is je partner al begonnen? Open dan de uitnodigingslink die je kreeg, in plaats
          van hier een nieuw huishouden te maken.
        </Text>
        <Field.Root required>
          <Field.Label>Naam van het huishouden</Field.Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field.Root>
        {error && (
          <Text color="red.600" role="alert">
            {error}
          </Text>
        )}
        <Button type="submit" colorPalette="green" loading={busy} disabled={!name.trim()}>
          Huishouden aanmaken
        </Button>
        <Button type="button" variant="ghost" onClick={() => void signOut()}>
          Uitloggen
        </Button>
      </Stack>
    </Box>
  )
}

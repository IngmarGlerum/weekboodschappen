import { Box, Button, Heading, Spinner, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useHousehold } from '../auth/HouseholdProvider'
import { describeError } from '../lib/errors'
import { LoginForm } from './LoginForm'
import SetPasswordPage from './SetPasswordPage'

/**
 * De pagina achter de uitnodigingslink (requirement 10). De link zelf geeft
 * niets weg: de database controleert dat het geverifieerde e-mailadres van de
 * ingelogde gebruiker hetzelfde is als dat van de uitnodiging.
 */
export default function InvitePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { mode, user, loading: authLoading, needsPassword } = useAuth()
  const { loading: householdLoading, acceptInvitation } = useHousehold()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (mode === 'local') return <Navigate to="/" replace />
  // Nieuw account via de uitnodiging: eerst een wachtwoord kiezen, dan meedoen.
  if (user && needsPassword) return <SetPasswordPage />

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      await acceptInvitation(id)
      navigate('/', { replace: true })
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  let content
  if (authLoading || householdLoading) {
    content = <Spinner alignSelf="center" />
  } else if (!user) {
    content = (
      <LoginForm
        title="Je bent uitgenodigd"
        intro="Log in, of maak een account, met het e-mailadres waarop je de uitnodiging kreeg. Dat adres wordt gecontroleerd."
      />
    )
  } else {
    content = (
      <>
        <Heading size="xl">Je bent uitgenodigd</Heading>
        <Text color="fg.muted">Je bent ingelogd als {user.email}. Wil je meedoen met deze planning? Je andere planningen blijven gewoon bestaan.</Text>
        {error && (
          <Text color="red.600" role="alert">
            {error}
          </Text>
        )}
        <Button colorPalette="green" loading={busy} onClick={accept}>
          Meedoen
        </Button>
      </>
    )
  }

  return (
    <Box minH="100dvh" bg="bg.subtle" display="flex" alignItems="center" justifyContent="center" px="4" py="8">
      <Stack gap="5" w="full" maxW="420px" bg="bg" p="6" rounded="lg" borderWidth="1px">
        {content}
      </Stack>
    </Box>
  )
}

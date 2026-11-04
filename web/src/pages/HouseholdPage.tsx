import { Badge, Box, Button, Card, Field, Flex, HStack, Heading, IconButton, Input, Stack, Text } from '@chakra-ui/react'
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { LuArrowLeft, LuCamera, LuCopy, LuDoorOpen, LuMail, LuTrash2 } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useCurrentHousehold, useHousehold } from '../auth/HouseholdProvider'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { HouseholdAvatar } from '../components/HouseholdAvatar'
import { notify } from '../components/toaster'
import { fileToAvatar } from '../lib/avatar'
import { describeError } from '../lib/errors'
import { requireSupabase } from '../lib/supabase'

interface Member {
  user_id: string
  email: string
  role: string
}

interface Invitation {
  id: string
  email: string
  expires_at: string
}

const inviteUrl = (id: string) => `${window.location.origin}/uitnodiging/${id}`

/** Naam, foto, leden en uitnodigingen van de gekozen planning (requirement 8 en 10). Alleen in online modus. */
export default function HouseholdPage() {
  const navigate = useNavigate()
  const household = useCurrentHousehold()
  const { households, updateHousehold, leaveHousehold } = useHousehold()
  const { user, signOut } = useAuth()
  const [name, setName] = useState(household.name)
  const [savingName, setSavingName] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastLink, setLastLink] = useState<{ email: string; url: string } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const supabase = requireSupabase()
      const [overview, pending] = await Promise.all([
        supabase.rpc('household_overview', { p_household: household.id }),
        supabase
          .from('invitations')
          .select('id, email, expires_at')
          .eq('household_id', household.id)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }),
      ])
      if (overview.error) throw overview.error
      if (pending.error) throw pending.error
      setMembers((overview.data ?? []) as Member[])
      setInvitations((pending.data ?? []) as Invitation[])
      setLoadError(null)
    } catch (error) {
      setLoadError(describeError(error))
    }
  }, [household.id])

  useEffect(() => {
    void load()
  }, [load])

  // Wissel je van planning, of wijzigt de ander de naam, dan volgt het veld.
  useEffect(() => {
    setName(household.name)
  }, [household.id, household.name])

  async function saveName(e: FormEvent) {
    e.preventDefault()
    const next = name.trim()
    if (!next || next === household.name) return
    setSavingName(true)
    try {
      await updateHousehold(household.id, { name: next })
      notify.success('Naam opgeslagen')
    } catch (error) {
      notify.error('Opslaan mislukt', describeError(error))
    } finally {
      setSavingName(false)
    }
  }

  async function pickAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setSavingAvatar(true)
    try {
      await updateHousehold(household.id, { avatar: await fileToAvatar(file) })
      notify.success('Foto opgeslagen')
    } catch (error) {
      notify.error('Foto opslaan mislukt', describeError(error))
    } finally {
      setSavingAvatar(false)
    }
  }

  async function removeAvatar() {
    setSavingAvatar(true)
    try {
      await updateHousehold(household.id, { avatar: null })
    } catch (error) {
      notify.error('Foto weghalen mislukt', describeError(error))
    } finally {
      setSavingAvatar(false)
    }
  }

  async function leave() {
    setConfirmLeave(false)
    try {
      await leaveHousehold(household.id)
      notify.success(`Je hebt ${household.name} verlaten`)
      navigate('/', { replace: true })
    } catch (error) {
      notify.error('Verlaten mislukt', describeError(error))
    }
  }

  const lastMember = members.length === 1

  async function invite(e: FormEvent) {
    e.preventDefault()
    const address = email.trim().toLowerCase()
    if (!address || !user) return
    setBusy(true)
    try {
      const { data, error } = await requireSupabase()
        .from('invitations')
        .insert({ household_id: household.id, email: address, invited_by: user.id })
        .select('id')
        .single()
      if (error) throw error
      setLastLink({ email: address, url: inviteUrl(data.id as string) })
      setEmail('')
      await load()
    } catch (error) {
      notify.error('Uitnodigen mislukt', describeError(error))
    } finally {
      setBusy(false)
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      notify.success('Link gekopieerd')
    } catch (error) {
      notify.error('Kopiëren mislukt', describeError(error))
    }
  }

  async function revoke(id: string) {
    const { error } = await requireSupabase().from('invitations').delete().eq('id', id)
    if (error) notify.error('Intrekken mislukt', describeError(error))
    else await load()
  }

  const mailto = (to: string, url: string) =>
    `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent('Uitnodiging voor onze Weekplanner')}&body=${encodeURIComponent(
      `Hoi! Hier is de link om mee te doen met onze Weekplanner:\n\n${url}\n\nLog in met dit e-mailadres (${to}). De link werkt één keer en is 7 dagen geldig.`,
    )}`

  return (
    <Stack gap="5">
      <HStack>
        <IconButton variant="ghost" aria-label="Terug" onClick={() => navigate(-1)}>
          <LuArrowLeft />
        </IconButton>
        <Heading size="lg">Planning</Heading>
      </HStack>

      <Stack gap="3">
        <HStack gap="4" align="center">
          <HouseholdAvatar household={household} size="2xl" />
          <Stack gap="2">
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickAvatar} />
            <Button size="sm" variant="outline" loading={savingAvatar} onClick={() => fileInput.current?.click()}>
              <LuCamera /> {household.avatar ? 'Andere foto' : 'Kies een foto'}
            </Button>
            {household.avatar && (
              <Button size="sm" variant="ghost" colorPalette="red" disabled={savingAvatar} onClick={removeAvatar}>
                Foto weghalen
              </Button>
            )}
          </Stack>
        </HStack>
        <form onSubmit={saveName}>
          <Field.Root>
            <Field.Label>Naam van de planning</Field.Label>
            <Flex gap="2" w="full">
              <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
              <Button
                type="submit"
                colorPalette="green"
                loading={savingName}
                disabled={!name.trim() || name.trim() === household.name}
              >
                Opslaan
              </Button>
            </Flex>
            <Field.HelperText>Naam en foto zien alle leden bovenaan het scherm.</Field.HelperText>
          </Field.Root>
        </form>
        {loadError && (
          <Text color="red.600" role="alert">
            {loadError}
          </Text>
        )}
      </Stack>

      <Stack gap="2">
        <Heading size="md">Leden</Heading>
        {members.map((m) => (
          <Card.Root key={m.user_id} variant="outline">
            <Card.Body p="3">
              <Flex justify="space-between" align="center">
                <Text truncate>{m.email}</Text>
                {m.user_id === user?.id && <Badge colorPalette="green">jij</Badge>}
              </Flex>
            </Card.Body>
          </Card.Root>
        ))}
      </Stack>

      <Stack gap="3">
        <Heading size="md">Iemand uitnodigen</Heading>
        <Text color="fg.muted" fontSize="sm">
          Vul het e-mailadres in van je partner. Je krijgt een link die één keer werkt en 7 dagen geldig is. Alleen
          iemand die inlogt met precies dit e-mailadres kan meedoen.
        </Text>
        <form onSubmit={invite}>
          <Field.Root>
            <Field.Label>E-mailadres</Field.Label>
            <Flex gap="2" w="full">
              <Input
                type="email"
                inputMode="email"
                placeholder="naam@voorbeeld.nl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" colorPalette="green" loading={busy} disabled={!email.trim()}>
                Maak link
              </Button>
            </Flex>
          </Field.Root>
        </form>

        {lastLink && (
          <Card.Root variant="subtle" colorPalette="green">
            <Card.Body p="3" gap="2">
              <Text fontSize="sm">Link voor {lastLink.email}:</Text>
              <Text fontSize="sm" wordBreak="break-all" fontFamily="mono">
                {lastLink.url}
              </Text>
              <HStack gap="2" flexWrap="wrap">
                <Button size="sm" variant="outline" onClick={() => copy(lastLink.url)}>
                  <LuCopy /> Kopieer link
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={mailto(lastLink.email, lastLink.url)}>
                    <LuMail /> Open in e-mail
                  </a>
                </Button>
              </HStack>
            </Card.Body>
          </Card.Root>
        )}
      </Stack>

      {invitations.length > 0 && (
        <Stack gap="2">
          <Heading size="md">Openstaande uitnodigingen</Heading>
          {invitations.map((inv) => (
            <Card.Root key={inv.id} variant="outline">
              <Card.Body p="3">
                <Flex justify="space-between" align="center" gap="2">
                  <Box minW="0">
                    <Text truncate>{inv.email}</Text>
                    <Text color="fg.muted" fontSize="sm">
                      Geldig tot {new Date(inv.expires_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
                    </Text>
                  </Box>
                  <HStack gap="1">
                    <IconButton size="sm" variant="ghost" aria-label="Kopieer link" onClick={() => copy(inviteUrl(inv.id))}>
                      <LuCopy />
                    </IconButton>
                    <IconButton
                      size="sm"
                      variant="ghost"
                      colorPalette="red"
                      aria-label={`Trek uitnodiging voor ${inv.email} in`}
                      onClick={() => revoke(inv.id)}
                    >
                      <LuTrash2 />
                    </IconButton>
                  </HStack>
                </Flex>
              </Card.Body>
            </Card.Root>
          ))}
        </Stack>
      )}

      <Stack gap="2" pt="2" borderTopWidth="1px">
        <Button
          variant="outline"
          colorPalette="red"
          alignSelf="flex-start"
          mt="3"
          disabled={members.length === 0}
          onClick={() => setConfirmLeave(true)}
        >
          <LuDoorOpen /> Planning verlaten
        </Button>
        <Button variant="ghost" alignSelf="flex-start" onClick={() => void signOut()}>
          Uitloggen
        </Button>
      </Stack>

      <ConfirmDialog
        open={confirmLeave}
        title={`${household.name} verlaten?`}
        message={
          lastMember
            ? 'Je bent het enige lid. Als je deze planning verlaat, worden de planning en alles erin (gerechten, weken, weekmenu\'s) definitief verwijderd.'
            : households.length > 1
              ? 'Je ziet deze planning daarna niet meer. De andere leden kunnen gewoon verder. Je kunt alleen terug met een nieuwe uitnodiging.'
              : 'Je ziet deze planning daarna niet meer, en je hebt dan geen planning meer. De andere leden kunnen gewoon verder.'
        }
        confirmLabel={lastMember ? 'Verlaten en verwijderen' : 'Verlaten'}
        destructive
        onConfirm={() => void leave()}
        onCancel={() => setConfirmLeave(false)}
      />
    </Stack>
  )
}

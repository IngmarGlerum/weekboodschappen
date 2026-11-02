import { Card, Heading, Stack, Text } from '@chakra-ui/react'
import { LuApple, LuBookmark, LuUsers } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export default function MorePage() {
  const navigate = useNavigate()
  const { mode, user } = useAuth()

  const items = [
    { to: '/weekmenus', icon: LuBookmark, title: "Weekmenu's", text: 'Opgeslagen weken om opnieuw te gebruiken.' },
    { to: '/ingredienten', icon: LuApple, title: 'Ingrediënten', text: 'Jullie eigen lijst, met huisvoorraad.' },
    ...(mode === 'online'
      ? [{ to: '/huishouden', icon: LuUsers, title: 'Huishouden', text: 'Leden, uitnodigen en uitloggen.' }]
      : []),
  ]

  return (
    <Stack gap="4">
      <Heading size="lg">Meer</Heading>
      <Stack gap="2">
        {items.map(({ to, icon: Icon, title, text }) => (
          <Card.Root key={to} variant="outline" asChild>
            <button type="button" onClick={() => navigate(to)} style={{ textAlign: 'left' }}>
              <Card.Body p="3" flexDirection="row" alignItems="center" gap="3">
                <Icon size={22} />
                <Stack gap="0">
                  <Text fontWeight="semibold">{title}</Text>
                  <Text color="fg.muted" fontSize="sm">
                    {text}
                  </Text>
                </Stack>
              </Card.Body>
            </button>
          </Card.Root>
        ))}
      </Stack>
      <Text color="fg.muted" fontSize="sm">
        {mode === 'local'
          ? 'De app draait nu alleen op dit apparaat. Stel Supabase en PowerSync in om samen te kunnen werken.'
          : `Ingelogd als ${user?.email ?? ''}.`}
      </Text>
    </Stack>
  )
}

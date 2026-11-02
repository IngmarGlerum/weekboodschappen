import { Badge, Box, Button, Flex, HStack, Heading, Text } from '@chakra-ui/react'
import { useStatus } from '@powersync/react'
import { createContext, useContext, useMemo, useState } from 'react'
import { LuCalendarDays, LuEllipsis, LuShoppingCart, LuStore, LuUtensils } from 'react-icons/lu'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { startOfWeek, todayISO } from '../domain/dates'

interface WeekContextValue {
  /** Maandag van de week waar de gebruiker mee bezig is; gedeeld door Week en Boodschappen. */
  weekStart: string
  setWeekStart: (weekStart: string) => void
}

const WeekContext = createContext<WeekContextValue | null>(null)

export function useWeek(): WeekContextValue {
  const value = useContext(WeekContext)
  if (!value) throw new Error('useWeek buiten AppShell')
  return value
}

function SyncBadge() {
  const { mode } = useAuth()
  const status = useStatus()
  if (mode === 'local') return <Badge colorPalette="gray">Alleen dit apparaat</Badge>
  if (status.dataFlowStatus.uploading) return <Badge colorPalette="blue">Verzenden…</Badge>
  if (status.connected) return <Badge colorPalette="green">Gesynchroniseerd</Badge>
  return <Badge colorPalette="orange">Offline</Badge>
}

const NAV = [
  { to: '/', label: 'Week', icon: LuCalendarDays, match: (p: string) => p === '/' },
  { to: '/gerechten', label: 'Gerechten', icon: LuUtensils, match: (p: string) => p.startsWith('/gerechten') },
  { to: '/boodschappen', label: 'Boodschappen', icon: LuShoppingCart, match: (p: string) => p.startsWith('/boodschappen') },
  { to: '/winkel', label: 'Winkel', icon: LuStore, match: (p: string) => p.startsWith('/winkel') },
  {
    to: '/meer',
    label: 'Meer',
    icon: LuEllipsis,
    match: (p: string) => ['/meer', '/ingredienten', '/weekmenus', '/huishouden'].some((x) => p.startsWith(x)),
  },
]

export default function AppShell() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()))
  const location = useLocation()
  const navigate = useNavigate()
  const weekValue = useMemo(() => ({ weekStart, setWeekStart }), [weekStart])

  return (
    <WeekContext.Provider value={weekValue}>
      <Flex direction="column" minH="100dvh" bg="bg.subtle">
        <Flex
          as="header"
          position="sticky"
          top="0"
          zIndex="sticky"
          bg="bg"
          borderBottomWidth="1px"
          px="4"
          py="3"
          justify="space-between"
          align="center"
          pt="max(12px, env(safe-area-inset-top))"
        >
          <Heading size="md">Weekplanner</Heading>
          <SyncBadge />
        </Flex>

        <Box as="main" flex="1" w="full" maxW="720px" mx="auto" px="4" pt="4" pb="96px">
          <Outlet />
        </Box>

        <HStack
          as="nav"
          aria-label="Hoofdmenu"
          position="fixed"
          bottom="0"
          left="0"
          right="0"
          bg="bg"
          borderTopWidth="1px"
          gap="0"
          justify="space-around"
          pb="env(safe-area-inset-bottom)"
          zIndex="sticky"
        >
          {NAV.map(({ to, label, icon: Icon, match }) => {
            const active = match(location.pathname)
            return (
              <Button
                key={to}
                variant="plain"
                flex="1"
                h="auto"
                py="2"
                flexDirection="column"
                gap="0.5"
                color={active ? 'green.600' : 'fg.muted'}
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate(to)}
              >
                <Icon size={22} />
                <Text fontSize="xs" fontWeight={active ? 'semibold' : 'normal'}>
                  {label}
                </Text>
              </Button>
            )
          })}
        </HStack>
      </Flex>
    </WeekContext.Provider>
  )
}

import { Box, Button, Flex, HStack, Heading, IconButton, Text, useBreakpointValue } from '@chakra-ui/react'
import { createContext, useContext, useMemo, useRef, useState } from 'react'
import { LuCalendarDays, LuEllipsis, LuListTodo, LuMenu, LuShoppingCart, LuUtensils } from 'react-icons/lu'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useCurrentHousehold } from '../auth/HouseholdProvider'
import { startOfWeek, todayISO } from '../domain/dates'
import { HouseholdAvatar } from './HouseholdAvatar'
import { StoreListPanel } from './list/StoreListPanel'
import { SettingsDrawer } from './SettingsDrawer'
import { SyncBadge } from './SyncStatusDialog'

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

const NAV = [
  { to: '/', label: 'Week', icon: LuCalendarDays, match: (p: string) => p === '/' },
  { to: '/lijst', label: 'Lijst', icon: LuListTodo, match: (p: string) => p.startsWith('/lijst') },
  { to: '/gerechten', label: 'Gerechten', icon: LuUtensils, match: (p: string) => p.startsWith('/gerechten') },
  { to: '/boodschappen', label: 'Boodschappen', icon: LuShoppingCart, match: (p: string) => p.startsWith('/boodschappen') },
  {
    to: '/meer',
    label: 'Meer',
    icon: LuEllipsis,
    match: (p: string) => ['/meer', '/ingredienten', '/weekmenus', '/planning'].some((x) => p.startsWith(x)),
  },
]

/**
 * Op de telefoon vegen tussen Week en Lijst: op Week naar links vegen gaat naar
 * de Lijst, op de Lijst naar rechts vegen terug naar Week. (Op de Lijst is naar
 * links vegen over een item: verwijderen.)
 */
function useSwipeBetweenWeekAndList(enabled: boolean) {
  const location = useLocation()
  const navigate = useNavigate()
  const start = useRef<{ x: number; y: number; t: number } | null>(null)

  function onTouchStart(e: TouchEvent) {
    const target = e.target as HTMLElement
    if (!enabled || e.touches.length !== 1 || target.closest('input, textarea, [data-no-swipe]')) {
      start.current = null
      return
    }
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY, t: Date.now() }
  }

  function onTouchEnd(e: TouchEvent) {
    const s = start.current
    start.current = null
    if (!s || e.changedTouches.length !== 1) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    // Snel en duidelijk zijwaarts; lang vasthouden is slepen in de lijst, geen vegen.
    if (Date.now() - s.t > 600 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return
    if (location.pathname === '/' && dx < 0) navigate('/lijst')
    else if (location.pathname.startsWith('/lijst') && dx > 0) navigate('/')
  }

  return { onTouchStart, onTouchEnd }
}

export default function AppShell() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()))
  const location = useLocation()
  const navigate = useNavigate()
  const weekValue = useMemo(() => ({ weekStart, setWeekStart }), [weekStart])
  const household = useCurrentHousehold()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const wide = useBreakpointValue({ base: false, lg: true }) ?? false
  const sideBySide = wide && location.pathname === '/'
  const swipe = useSwipeBetweenWeekAndList(!wide)

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
          gap="2"
          pt="max(12px, env(safe-area-inset-top))"
        >
          <HStack gap="1" minW="0" flex="1">
            <IconButton variant="ghost" aria-label="Instellingen openen" onClick={() => setDrawerOpen(true)}>
              <LuMenu />
            </IconButton>
            <Button
              variant="plain"
              px="1"
              gap="2"
              minW="0"
              aria-label={`Planning: ${household.name}. Tik om te wisselen.`}
              onClick={() => setDrawerOpen(true)}
            >
              <HouseholdAvatar household={household} />
              <Heading size="md" truncate>
                {household.name}
              </Heading>
            </Button>
          </HStack>
          <Box flexShrink={0}>
            <SyncBadge />
          </Box>
        </Flex>
        <SettingsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

        {sideBySide ? (
          // Breed scherm: de week en de lijst naast elkaar, elk met een eigen scrollbalk.
          <Flex as="main" flex="1" w="full" maxW="1280px" mx="auto" px="4" gap="6" align="flex-start">
            <Box flex="1.2" minW="0" pt="4" pb="96px">
              <Outlet />
            </Box>
            <Box
              as="aside"
              aria-label="Lijst"
              flex="1"
              minW="0"
              position="sticky"
              top="64px"
              maxH="calc(100dvh - 64px - 72px)"
              overflowY="auto"
              pt="4"
              pb="4"
              px="1"
            >
              <StoreListPanel compact />
            </Box>
          </Flex>
        ) : (
          <Box
            as="main"
            flex="1"
            w="full"
            maxW="720px"
            mx="auto"
            px="4"
            pt="4"
            pb="96px"
            onTouchStart={(e) => swipe.onTouchStart(e.nativeEvent)}
            onTouchEnd={(e) => swipe.onTouchEnd(e.nativeEvent)}
          >
            <Outlet />
          </Box>
        )}

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

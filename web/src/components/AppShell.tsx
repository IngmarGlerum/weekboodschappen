import { Box, Button, Flex, HStack, Heading, IconButton, Text, useBreakpointValue } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { LuCalendarDays, LuEllipsis, LuListTodo, LuMenu, LuShoppingCart, LuUtensils } from 'react-icons/lu'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useCurrentHousehold } from '../auth/HouseholdProvider'
import { startOfWeek, todayISO } from '../domain/dates'
import { HouseholdAvatar } from './HouseholdAvatar'
import { StoreListPanel } from './list/StoreListPanel'
import WeekPage from '../pages/WeekPage'
import { SettingsDrawer } from './SettingsDrawer'
import { WeekContext } from './weekContext'
import { SwipePager } from './SwipePager'
import { SyncBadge } from './SyncStatusDialog'

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

export default function AppShell() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()))
  const location = useLocation()
  const navigate = useNavigate()
  const weekValue = useMemo(() => ({ weekStart, setWeekStart }), [weekStart])
  const household = useCurrentHousehold()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const wide = useBreakpointValue({ base: false, lg: true }) ?? false
  const sideBySide = wide && location.pathname === '/'
  // Op de telefoon: Week en Lijst als twee pagina's waartussen je veegt.
  const pagerIndex = location.pathname === '/' ? 0 : location.pathname.startsWith('/lijst') ? 1 : null
  const paged = !wide && pagerIndex !== null

  return (
    <WeekContext.Provider value={weekValue}>
      <Flex
        direction="column"
        minH="100dvh"
        h={paged ? '100dvh' : undefined}
        overflow={paged ? 'hidden' : undefined}
        bg="bg.subtle"
      >
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

        {paged ? (
          <SwipePager
            index={pagerIndex}
            onIndexChange={(i) => navigate(i === 0 ? '/' : '/lijst')}
            panes={[<WeekPage key="week" />, <StoreListPanel key="lijst" />]}
          />
        ) : sideBySide ? (
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

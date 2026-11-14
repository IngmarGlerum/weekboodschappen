import { Button, Center, Spinner, Stack, Text } from '@chakra-ui/react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { useHousehold } from './auth/HouseholdProvider'
import AppShell from './components/AppShell'
import DishEditPage from './pages/DishEditPage'
import DishesPage from './pages/DishesPage'
import HouseholdPage from './pages/HouseholdPage'
import IngredientsPage from './pages/IngredientsPage'
import InvitePage from './pages/InvitePage'
import LoginPage from './pages/LoginPage'
import SetPasswordPage from './pages/SetPasswordPage'
import MorePage from './pages/MorePage'
import ShoppingPage from './pages/ShoppingPage'
import StartPage from './pages/StartPage'
import StorePage from './pages/StorePage'
import WeekPage from './pages/WeekPage'
import WeekmenuEditPage from './pages/WeekmenuEditPage'
import WeekmenusPage from './pages/WeekmenusPage'

function Loading() {
  return (
    <Center minH="100dvh">
      <Spinner size="lg" />
    </Center>
  )
}

/** Online moet je ingelogd zijn; in lokale modus (zonder Supabase) niet. */
function RequireAuth() {
  const { mode, loading, user, needsPassword } = useAuth()
  if (mode === 'local') return <Outlet />
  if (loading) return <Loading />
  if (!user) return <LoginPage />
  if (needsPassword) return <SetPasswordPage />
  return <Outlet />
}

/** Alles in de app hoort bij een planning. Zonder planning ga je naar /start. */
function RequireHousehold() {
  const { household, loading, error, refresh } = useHousehold()
  if (loading) return <Loading />
  if (!household && error) {
    return (
      <Center minH="100dvh" px="4">
        <Stack gap="3" align="center" textAlign="center">
          <Text>De planningen konden niet geladen worden: {error}</Text>
          <Button onClick={() => void refresh()}>Opnieuw proberen</Button>
        </Stack>
      </Center>
    )
  }
  if (!household) return <Navigate to="/start" replace />
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/uitnodiging/:id" element={<InvitePage />} />
      <Route element={<RequireAuth />}>
        <Route path="/start" element={<StartPage />} />
        <Route element={<RequireHousehold />}>
          <Route element={<AppShell />}>
            <Route index element={<WeekPage />} />
            <Route path="gerechten" element={<DishesPage />} />
            <Route path="gerechten/:id" element={<DishEditPage />} />
            <Route path="boodschappen" element={<ShoppingPage />} />
            <Route path="lijst" element={<StorePage />} />
            <Route path="winkel" element={<Navigate to="/lijst" replace />} />
            <Route path="meer" element={<MorePage />} />
            <Route path="ingredienten" element={<IngredientsPage />} />
            <Route path="weekmenus" element={<WeekmenusPage />} />
            <Route path="weekmenus/:id" element={<WeekmenuEditPage />} />
            <Route path="planning" element={<HouseholdPage />} />
            <Route path="huishouden" element={<Navigate to="/planning" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import { HouseholdProvider } from './auth/HouseholdProvider'
import { Toaster } from './components/toaster'
import { PowerSyncProvider } from './powersync/PowerSyncProvider'

// Requirement 11: de service worker zorgt dat de app ook zonder verbinding opent.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider value={defaultSystem}>
      <AuthProvider>
        <HouseholdProvider>
          <PowerSyncProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </PowerSyncProvider>
        </HouseholdProvider>
      </AuthProvider>
      <Toaster />
    </ChakraProvider>
  </StrictMode>,
)

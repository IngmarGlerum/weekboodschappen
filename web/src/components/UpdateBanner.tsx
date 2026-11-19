import { Button, Flex, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { APP_VERSION, fetchServerVersion, hardReload } from '../lib/appVersion'

const CHECK_EVERY_MS = 10 * 60_000

/**
 * Een balk bovenaan als er een nieuwere versie van de app online staat dan deze kopie.
 * "Herladen" gooit de opgeslagen kopie weg en haalt de nieuwe op.
 */
export function UpdateBanner() {
  const [newer, setNewer] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    async function check() {
      const server = await fetchServerVersion()
      if (active && server && server !== APP_VERSION) setNewer(server)
    }
    void check()
    const timer = window.setInterval(() => void check(), CHECK_EVERY_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // Na het herladen staat ?v= in de adresbalk; die mag weer weg.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.has('v')) {
      url.searchParams.delete('v')
      window.history.replaceState(window.history.state, '', url.toString())
    }
  }, [])

  if (!newer) return null
  return (
    <Flex
      role="status"
      position="fixed"
      top="max(8px, env(safe-area-inset-top))"
      left="50%"
      transform="translateX(-50%)"
      zIndex="toast"
      bg="green.solid"
      color="white"
      rounded="full"
      boxShadow="lg"
      pl="4"
      pr="1.5"
      py="1.5"
      gap="3"
      align="center"
      maxW="calc(100vw - 24px)"
    >
      <Text fontSize="sm" fontWeight="medium">
        Er is een nieuwe versie
      </Text>
      <Button
        size="xs"
        rounded="full"
        bg="white"
        color="green.700"
        _hover={{ bg: 'green.50' }}
        loading={busy}
        onClick={() => {
          setBusy(true)
          void hardReload()
        }}
      >
        Herladen
      </Button>
    </Flex>
  )
}

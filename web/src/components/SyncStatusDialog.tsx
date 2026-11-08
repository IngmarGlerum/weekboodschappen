import { Badge, Button, DataList, Stack, Text } from '@chakra-ui/react'
import { useStatus } from '@powersync/react'
import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { env } from '../lib/env'
import { supabase } from '../lib/supabase'
import { SupabaseConnector } from '../powersync/connector'
import { db } from '../powersync/db'
import { AppDialog } from './ConfirmDialog'

function hostOf(url: string | undefined) {
  try {
    return url ? new URL(url).host : '(niet ingesteld)'
  } catch {
    return `ongeldig adres: ${url}`
  }
}

/**
 * Het label rechtsboven (Gesynchroniseerd / Offline). Tik erop voor details:
 * waarom de verbinding met PowerSync niet lukt, en opnieuw verbinden.
 */
export function SyncBadge() {
  const { mode } = useAuth()
  const status = useStatus()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  if (mode === 'local') return <Badge colorPalette="gray">Alleen dit apparaat</Badge>

  const flow = status.dataFlowStatus
  const error = flow.downloadError ?? flow.uploadError
  const badge = flow.uploading ? (
    <Badge colorPalette="blue">Verzenden…</Badge>
  ) : status.connected ? (
    <Badge colorPalette="green">Gesynchroniseerd</Badge>
  ) : status.connecting ? (
    <Badge colorPalette="blue">Verbinden…</Badge>
  ) : (
    <Badge colorPalette={error ? 'red' : 'orange'}>{error ? 'Sync-fout' : 'Offline'}</Badge>
  )

  async function reconnect() {
    if (!supabase) return
    setBusy(true)
    try {
      await db.disconnect()
      await db.connect(new SupabaseConnector(supabase))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="plain" p="0" h="auto" minW="0" aria-label="Status van de synchronisatie" onClick={() => setOpen(true)}>
        {badge}
      </Button>
      <AppDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Synchronisatie"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Sluiten
            </Button>
            <Button colorPalette="green" loading={busy} onClick={() => void reconnect()}>
              Opnieuw verbinden
            </Button>
          </>
        }
      >
        <Stack gap="4">
          <DataList.Root orientation="horizontal" size="sm">
            <DataList.Item>
              <DataList.ItemLabel>Verbonden</DataList.ItemLabel>
              <DataList.ItemValue>{status.connected ? 'ja' : status.connecting ? 'bezig…' : 'nee'}</DataList.ItemValue>
            </DataList.Item>
            <DataList.Item>
              <DataList.ItemLabel>Laatst gesynchroniseerd</DataList.ItemLabel>
              <DataList.ItemValue>
                {status.lastSyncedAt ? status.lastSyncedAt.toLocaleString('nl-NL') : 'nog nooit'}
              </DataList.ItemValue>
            </DataList.Item>
            <DataList.Item>
              <DataList.ItemLabel>PowerSync</DataList.ItemLabel>
              <DataList.ItemValue wordBreak="break-all">{hostOf(env.powersyncUrl)}</DataList.ItemValue>
            </DataList.Item>
          </DataList.Root>
          {flow.downloadError && (
            <Stack gap="1">
              <Text fontWeight="semibold">Fout bij ophalen</Text>
              <Text fontSize="sm" fontFamily="mono" wordBreak="break-word" color="red.600">
                {flow.downloadError.message}
              </Text>
            </Stack>
          )}
          {flow.uploadError && (
            <Stack gap="1">
              <Text fontWeight="semibold">Fout bij verzenden</Text>
              <Text fontSize="sm" fontFamily="mono" wordBreak="break-word" color="red.600">
                {flow.uploadError.message}
              </Text>
            </Stack>
          )}
          {!error && !status.connected && (
            <Text color="fg.muted" fontSize="sm">
              Geen foutmelding. Ben je online? Dan probeert de app het vanzelf opnieuw.
            </Text>
          )}
        </Stack>
      </AppDialog>
    </>
  )
}

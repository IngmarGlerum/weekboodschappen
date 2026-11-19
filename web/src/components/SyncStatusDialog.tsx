import { Badge, Button, DataList, Stack, Text } from '@chakra-ui/react'
import { useStatus } from '@powersync/react'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { env } from '../lib/env'
import { supabase } from '../lib/supabase'
import { SupabaseConnector } from '../powersync/connector'
import { db } from '../powersync/db'
import { APP_VERSION, hardReload } from '../lib/appVersion'
import { AppDialog, ConfirmDialog } from './ConfirmDialog'

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
  const [confirmReset, setConfirmReset] = useState(false)
  const [pendingUploads, setPendingUploads] = useState<number | null>(null)
  // Sinds wanneer de app (zonder succes) probeert te verbinden.
  const [notConnectedSince, setNotConnectedSince] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (status.connected) setNotConnectedSince(null)
    else setNotConnectedSince((since) => since ?? Date.now())
  }, [status.connected])

  // Elke 5 seconden opnieuw kijken, zodat "vastgelopen" vanzelf verschijnt.
  useEffect(() => {
    if (!open) return
    const timer = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    void db
      .getUploadQueueStats()
      .then((stats) => setPendingUploads(stats.count))
      .catch(() => setPendingUploads(null))
  }, [open, status.dataFlowStatus.uploading])

  if (mode === 'local') return <Badge colorPalette="gray">Alleen dit apparaat</Badge>

  const flow = status.dataFlowStatus
  const error = flow.downloadError ?? flow.uploadError
  const online = typeof navigator === 'undefined' || navigator.onLine
  // Online, al 20 seconden niet verbonden: waarschijnlijk vastgelopen (oude kopie van de app).
  const stuck = online && notConnectedSince !== null && now - notConnectedSince > 20_000
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
          {!error && !status.connected && !stuck && (
            <Text color="fg.muted" fontSize="sm">
              Geen foutmelding. Ben je online? Dan probeert de app het vanzelf opnieuw.
            </Text>
          )}

          {(stuck || error) && (
            <Stack gap="2" borderTopWidth="1px" pt="3">
              <Text fontWeight="semibold">Lukt het niet?</Text>
              <Text fontSize="sm" color="fg.muted">
                Herlaad de app. Dat haalt de nieuwste versie op en start de synchronisatie opnieuw. Je gegevens
                blijven staan.
              </Text>
              <Button
                colorPalette="green"
                alignSelf="flex-start"
                loading={busy}
                onClick={() => {
                  setBusy(true)
                  void db.disconnect().finally(() => void hardReload())
                }}
              >
                App herladen
              </Button>
              <Text fontSize="sm" color="fg.muted">
                Helpt dat niet? Wis de gegevens op dit apparaat; de app haalt alles daarna opnieuw op.
              </Text>
              <Button
                variant="outline"
                colorPalette="red"
                size="sm"
                alignSelf="flex-start"
                onClick={() => setConfirmReset(true)}
              >
                Gegevens op dit apparaat wissen
              </Button>
            </Stack>
          )}

          <Text fontSize="xs" color="fg.subtle">
            Versie {APP_VERSION}
            {pendingUploads ? ` · ${pendingUploads} wijziging(en) nog niet verzonden` : ''}
          </Text>
        </Stack>
      </AppDialog>
      <ConfirmDialog
        open={confirmReset}
        title="Gegevens op dit apparaat wissen?"
        message={
          pendingUploads
            ? `Er ${pendingUploads === 1 ? 'is 1 wijziging' : `zijn ${pendingUploads} wijzigingen`} op dit apparaat nog niet verzonden. Die gaan verloren. De rest staat veilig online en komt terug.`
            : 'Alle gegevens staan online en worden daarna opnieuw opgehaald. Je blijft ingelogd.'
        }
        confirmLabel="Wissen en opnieuw ophalen"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false)
          setBusy(true)
          void db.disconnectAndClear().finally(() => void hardReload())
        }}
      />
    </>
  )
}

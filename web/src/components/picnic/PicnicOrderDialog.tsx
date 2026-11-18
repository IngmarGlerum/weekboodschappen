import { Box, Button, HStack, IconButton, Stack, Text } from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'
import { LuMinus, LuPlus } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { useCurrentHousehold } from '../../auth/HouseholdProvider'
import { usePicnicProducts } from '../../data/hooks'
import { useRepo } from '../../data/repo'
import { formatPrice, productRef, productRowId, suggestCount } from '../../domain/picnic'
import type { ListLine } from '../../domain/shoppingList'
import { picnicApi, PicnicApiError } from '../../lib/picnicApi'
import { tick } from '../../lib/haptics'
import { AppDialog } from '../ConfirmDialog'
import { notify } from '../toaster'
import { ProductThumb } from './ProductThumb'

interface Props {
  open: boolean
  onClose: () => void
  weekStart: string
  /** De open regels van de Picnic-lijst. */
  lines: ListLine[]
  onChooseProduct: (line: ListLine) => void
}

const lineKey = (l: ListLine) => `${l.refType}|${l.refKey}`

/**
 * "Naar Picnic": per regel het gekozen product en het aantal, dan in één keer
 * in het Picnic-mandje. Afrekenen en het bezorgmoment gaan in de Picnic-app.
 * Een herhaling (bijvoorbeeld na een verbroken verbinding) gebruikt hetzelfde
 * verzoek-id, zodat de server niets dubbel toevoegt.
 */
export function PicnicOrderDialog({ open, onClose, weekStart, lines, onChooseProduct }: Props) {
  const household = useCurrentHousehold()
  const repo = useRepo()
  const navigate = useNavigate()
  const products = usePicnicProducts()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [requestId, setRequestId] = useState<string>(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)

  const productById = useMemo(() => new Map(products.data.map((p) => [p.id, p])), [products.data])
  const rows = lines.map((line) => {
    const ref = productRef(line)
    const product = productById.get(productRowId(household.id, ref.refType, ref.refKey)) ?? null
    const suggested = product ? suggestCount(line.parts, product.unit_quantity) : 1
    return { line, product, count: counts[lineKey(line)] ?? suggested }
  })
  const ready = rows.filter((r) => r.product && r.count > 0)
  const missing = rows.filter((r) => !r.product)
  const total = ready.reduce((sum, r) => sum + (r.product?.price_cents ?? 0) * r.count, 0)

  // Elke keer dat het venster opengaat: een nieuw verzoek en de voorgestelde aantallen.
  useEffect(() => {
    if (!open) return
    setCounts({})
    setError(null)
    setRequestId(crypto.randomUUID())
  }, [open])

  function change(line: ListLine, current: number, delta: number) {
    setCounts((prev) => ({ ...prev, [lineKey(line)]: Math.max(0, Math.min(99, current + delta)) }))
    // Een ander aantal is een ander verzoek.
    setRequestId(crypto.randomUUID())
  }

  async function send() {
    if (ready.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const result = await picnicApi.addToCart(
        household.id,
        requestId,
        ready.map((r) => ({ productId: r.product!.product_id, count: r.count })),
      )
      // Wat in het mandje staat, is afgevinkt op de lijst.
      for (const r of ready) await repo.patchListState(weekStart, r.line.refType, r.line.refKey, { checked: true })
      tick('medium')
      const added = result.outcomes.reduce((sum, o) => sum + o.added + o.alreadyThere, 0)
      notify.success(`${added} ${added === 1 ? 'product' : 'producten'} in je Picnic-mandje`)
      onClose()
    } catch (e) {
      setError(e instanceof PicnicApiError ? { code: e.code, message: e.message } : { code: 'error', message: String(e) })
    } finally {
      setBusy(false)
    }
  }

  const notConnected = error?.code === 'picnic_not_connected' || error?.code === 'picnic_auth_expired'

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Naar Picnic"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuleren
          </Button>
          <Button colorPalette="green" loading={busy} disabled={ready.length === 0} onClick={() => void send()}>
            {error && !notConnected ? 'Opnieuw proberen' : `Zet ${ready.length} in mandje`}
          </Button>
        </>
      }
    >
      <Stack gap="3">
        {rows.length === 0 && <Text color="fg.muted">Er staat niets open op de Picnic-lijst.</Text>}

        {ready.length > 0 && (
          <Stack gap="1.5">
            {rows
              .filter((r) => r.product)
              .map(({ line, product, count }) => (
                <HStack key={lineKey(line)} gap="2" opacity={count === 0 ? 0.5 : 1}>
                  <ProductThumb url={product!.image_url} size={40} />
                  <Box flex="1" minW="0">
                    <Text truncate fontWeight="medium" fontSize="sm">
                      {product!.product_name}
                    </Text>
                    <Text truncate fontSize="xs" color="fg.muted">
                      {line.label}
                      {product!.unit_quantity ? ` · ${product!.unit_quantity}` : ''}
                    </Text>
                  </Box>
                  <HStack gap="0" flexShrink={0}>
                    <IconButton size="xs" variant="ghost" aria-label={`Minder ${line.name}`} onClick={() => change(line, count, -1)}>
                      <LuMinus />
                    </IconButton>
                    <Text minW="6" textAlign="center" fontWeight="semibold" aria-label={`Aantal ${line.name}`}>
                      {count}
                    </Text>
                    <IconButton size="xs" variant="ghost" aria-label={`Meer ${line.name}`} onClick={() => change(line, count, 1)}>
                      <LuPlus />
                    </IconButton>
                  </HStack>
                </HStack>
              ))}
            <Text fontSize="sm" color="fg.muted" textAlign="right">
              Ongeveer {formatPrice(total)}
            </Text>
          </Stack>
        )}

        {missing.length > 0 && (
          <Stack gap="1.5">
            <Text fontSize="sm" fontWeight="semibold">
              Nog geen product gekozen
            </Text>
            {missing.map(({ line }) => (
              <HStack key={lineKey(line)} justify="space-between" gap="2">
                <Text truncate fontSize="sm">
                  {line.label}
                </Text>
                <Button size="xs" variant="outline" flexShrink={0} onClick={() => onChooseProduct(line)}>
                  Kies product
                </Button>
              </HStack>
            ))}
            <Text fontSize="xs" color="fg.muted">
              Deze gaan niet mee. Kies een product, dan onthoudt de app het voor volgende keer.
            </Text>
          </Stack>
        )}

        {error && (
          <Stack gap="2">
            <Text color="red.600" fontSize="sm" role="alert">
              {error.message}
            </Text>
            {notConnected && (
              <Button
                size="sm"
                variant="outline"
                alignSelf="flex-start"
                onClick={() => {
                  onClose()
                  navigate('/picnic')
                }}
              >
                Picnic koppelen
              </Button>
            )}
          </Stack>
        )}

        <Text fontSize="xs" color="fg.muted">
          Bezorgmoment kiezen en afrekenen doe je daarna in de Picnic-app.
        </Text>
      </Stack>
    </AppDialog>
  )
}

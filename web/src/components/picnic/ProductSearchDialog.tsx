import { Box, Button, HStack, Input, InputGroup, Spinner, Stack, Text } from '@chakra-ui/react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { LuSearch } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { useCurrentHousehold } from '../../auth/HouseholdProvider'
import { formatPrice, searchTermFor } from '../../domain/picnic'
import { picnicApi, PicnicApiError, type PicnicProduct } from '../../lib/picnicApi'
import { AppDialog } from '../ConfirmDialog'
import { ProductThumb } from './ProductThumb'

interface Props {
  open: boolean
  /** Waar we een product voor zoeken, bijvoorbeeld "uien". Dit is ook de eerste zoekterm. */
  articleName: string | null
  onClose: () => void
  onChoose: (product: PicnicProduct) => void
}

/** Wachttijd na de laatste toetsaanslag voordat er gezocht wordt. */
const DEBOUNCE_MS = 350

/** Een Picnic-product zoeken en kiezen voor een artikel. De keuze wordt onthouden. */
export function ProductSearchDialog({ open, articleName, onClose, onChoose }: Props) {
  const household = useCurrentHousehold()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState('')
  const [results, setResults] = useState<PicnicProduct[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const seq = useRef(0)

  async function search(text: string) {
    const q = text.trim()
    if (!q) return
    const mine = ++seq.current
    setBusy(true)
    setError(null)
    try {
      const products = await picnicApi.search(household.id, q)
      if (mine === seq.current) {
        setResults(products)
        setSearched(q)
      }
    } catch (e) {
      if (mine === seq.current) {
        setResults(null)
        setError(e instanceof PicnicApiError ? { code: e.code, message: e.message } : { code: 'error', message: String(e) })
      }
    } finally {
      if (mine === seq.current) setBusy(false)
    }
  }

  // Bij openen meteen zoeken op de naam van het artikel (zonder hoeveelheden).
  useEffect(() => {
    if (!open || !articleName) return
    const term = searchTermFor(articleName)
    setQuery(term)
    setResults(null)
    setError(null)
    void search(term)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, articleName])

  // Live zoeken: kort na het typen, vanaf 2 tekens.
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2 || q === searched) return
    const timer = window.setTimeout(() => void search(q), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open])

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    // Geen formulier versturen: dit venster staat soms "in" het formulier van een gerecht,
    // en Enter mag dat gerecht niet opslaan. Enter zoekt alleen meteen.
    e.preventDefault()
    e.stopPropagation()
    void search(query)
  }

  const notConnected = error?.code === 'picnic_not_connected' || error?.code === 'picnic_auth_expired'

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={articleName ? `Picnic-product voor ${articleName}` : 'Picnic-product kiezen'}
      footer={
        <Button variant="outline" onClick={onClose}>
          Annuleren
        </Button>
      }
    >
      <Stack gap="3">
        <InputGroup startElement={busy ? <Spinner size="xs" /> : <LuSearch />}>
          <Input
            aria-label="Zoek bij Picnic"
            placeholder="Zoek bij Picnic"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            enterKeyHint="search"
            autoComplete="off"
          />
        </InputGroup>

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

        {busy && !results && <Spinner alignSelf="center" />}
        {results && results.length === 0 && !busy && (
          <Text color="fg.muted">Niets gevonden voor “{searched}”. Probeer een korter of ander woord.</Text>
        )}

        {results && results.length > 0 && (
          <Stack gap="1" role="listbox" aria-label="Producten van Picnic">
            {results.map((p) => (
              <Box key={p.id} asChild textAlign="left" rounded="md" px="2" py="1.5" _hover={{ bg: 'bg.muted' }} opacity={p.unavailable ? 0.5 : 1}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={(e) => {
                    e.stopPropagation()
                    onChoose(p)
                  }}
                >
                  <HStack gap="3">
                    <ProductThumb url={p.imageUrl} size={44} />
                    <Box flex="1" minW="0">
                      <Text truncate fontWeight="medium">
                        {p.name}
                      </Text>
                      <Text fontSize="sm" color="fg.muted" truncate>
                        {[p.brand, p.unitQuantity].filter(Boolean).join(' · ')}
                        {p.unavailable ? ' · nu niet leverbaar' : ''}
                      </Text>
                    </Box>
                    <Text fontSize="sm" fontWeight="medium" flexShrink={0}>
                      {formatPrice(p.priceCents)}
                    </Text>
                  </HStack>
                </button>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    </AppDialog>
  )
}

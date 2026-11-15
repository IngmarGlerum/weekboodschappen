import { Box, Input, Stack, Text } from '@chakra-ui/react'
import { forwardRef, useMemo, useState, type KeyboardEvent } from 'react'
import { LuPlus } from 'react-icons/lu'
import type { IngredientRow } from '../data/rows'
import { normalizeName } from '../domain/shoppingList'

interface Props {
  ingredients: IngredientRow[]
  /** Al gekozen in een andere regel van dit gerecht. */
  usedIds: Set<string>
  value: string
  onChoose: (ingredientId: string) => void
  onCreate: (name: string) => void
}

/**
 * Typ een ingrediënt: je ziet meteen de bestaande ingrediënten die passen, of
 * maakt met één tik een nieuw. Omdat het een gewoon tekstveld is, gaat het
 * toetsenbord op de telefoon meteen open (bij een keuzelijst kon dat niet).
 * Ingrediënten die al in het gerecht staan zijn grijs en niet te kiezen.
 */
export const IngredientPicker = forwardRef<HTMLInputElement, Props>(function IngredientPicker(
  { ingredients, usedIds, value, onChoose, onCreate },
  ref,
) {
  const current = ingredients.find((i) => i.id === value)
  const [text, setText] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const shown = text ?? current?.name ?? ''
  const query = normalizeName(shown)

  const matches = useMemo(() => {
    if (!open) return []
    const list = query ? ingredients.filter((i) => normalizeName(i.name).includes(query)) : ingredients
    // Wat met de getypte tekst begint eerst.
    return [...list]
      .sort((a, b) => Number(!normalizeName(a.name).startsWith(query)) - Number(!normalizeName(b.name).startsWith(query)))
      .slice(0, 8)
  }, [open, query, ingredients])
  const exact = ingredients.find((i) => normalizeName(i.name) === query)
  const canCreate = query !== '' && !exact

  function choose(id: string) {
    setText(null)
    setOpen(false)
    onChoose(id)
  }

  function create() {
    const name = shown.trim()
    if (!name) return
    setText(null)
    setOpen(false)
    onCreate(name)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!query) return
    if (exact && !usedIds.has(exact.id)) choose(exact.id)
    else if (!exact) create()
  }

  // Een tik op een keuze mag de focus niet van het veld afpakken (toetsenbord blijft).
  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault()

  return (
    <Box position="relative" flex="1" minW="0">
      <Input
        ref={ref}
        aria-label="Ingrediënt"
        placeholder="Typ een ingrediënt…"
        autoComplete="off"
        enterKeyHint="next"
        value={shown}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false)
          setText(null)
        }}
        onKeyDown={onKeyDown}
      />
      {open && (matches.length > 0 || canCreate) && (
        <Stack
          role="listbox"
          aria-label="Ingrediënten"
          gap="0"
          position="absolute"
          top="calc(100% + 4px)"
          left="0"
          right="0"
          zIndex="dropdown"
          bg="bg"
          borderWidth="1px"
          rounded="md"
          boxShadow="lg"
          maxH="260px"
          overflowY="auto"
          py="1"
        >
          {matches.map((i) => {
            const used = usedIds.has(i.id)
            return (
              <Box
                key={i.id}
                asChild
                textAlign="left"
                px="3"
                py="2"
                color={used ? 'fg.subtle' : undefined}
                cursor={used ? 'not-allowed' : 'pointer'}
                _hover={used ? undefined : { bg: 'bg.muted' }}
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  aria-disabled={used}
                  onPointerDown={keepFocus}
                  onMouseDown={keepFocus}
                  onClick={() => {
                    if (!used) choose(i.id)
                  }}
                >
                  <Text truncate>
                    {i.name}
                    {used ? ' (al toegevoegd)' : ''}
                  </Text>
                </button>
              </Box>
            )
          })}
          {canCreate && (
            <Box
              asChild
              textAlign="left"
              px="3"
              py="2"
              color="green.600"
              fontWeight="medium"
              display="flex"
              alignItems="center"
              gap="2"
              _hover={{ bg: 'bg.muted' }}
            >
              <button
                type="button"
                role="option"
                aria-selected={false}
                onPointerDown={keepFocus}
                onMouseDown={keepFocus}
                onClick={create}
              >
                <LuPlus />
                <Text truncate>“{shown.trim()}” toevoegen</Text>
              </button>
            </Box>
          )}
        </Stack>
      )}
    </Box>
  )
})

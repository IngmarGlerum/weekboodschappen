import { Box, Button, Field, Flex, Heading, HStack, IconButton, Input, Stack, Text } from '@chakra-ui/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { LuArrowLeft, LuTrash2 } from 'react-icons/lu'
import { useNavigate, useParams } from 'react-router-dom'
import { useCurrentHousehold } from '../auth/HouseholdProvider'
import { AppDialog, ConfirmDialog } from '../components/ConfirmDialog'
import { IngredientPicker } from '../components/IngredientPicker'
import { PicnicProductPicker } from '../components/picnic/PicnicProductPicker'
import { notify } from '../components/toaster'
import { useAllDishes, useDishIngredients, useIngredients, useStoreLabels } from '../data/hooks'
import { normalizeName } from '../domain/shoppingList'
import { LabelBadge } from '../components/list/LabelBadge'
import { useRepo, type DishUsage } from '../data/repo'
import { clearDishDraft, readDishDraft, writeDishDraft } from '../lib/dishDraft'
import { describeError } from '../lib/errors'

interface Line {
  key: string
  ingredientId: string
  quantity: string
  unit: string
}

const UNITS = ['g', 'kg', 'ml', 'l', 'el', 'tl', 'blik', 'pak', 'zakje', 'bosje', 'teentje', 'snufje']
const emptyLine = (): Line => ({ key: crypto.randomUUID(), ingredientId: '', quantity: '', unit: '' })

/** Er staat altijd één lege regel onderaan, klaar voor het volgende ingrediënt. */
function withEmptyLast(lines: Line[]): Line[] {
  const filled = lines.filter((l, i) => l.ingredientId || i === lines.length - 1 || l.quantity || l.unit)
  const last = filled[filled.length - 1]
  return !last || last.ingredientId ? [...filled, emptyLine()] : filled
}

function parseQuantity(text: string): number | null {
  const value = Number.parseFloat(text.replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

export default function DishEditPage() {
  const { id } = useParams()
  const dishId = id && id !== 'nieuw' ? id : undefined
  const repo = useRepo()
  const navigate = useNavigate()
  const ingredients = useIngredients()
  const labels = useStoreLabels()
  const allDishes = useAllDishes()
  const existingLines = useDishIngredients(dishId)

  const household = useCurrentHousehold()
  const draftKey = { householdId: household.id, dishId: dishId ?? 'nieuw' }
  // Een concept (nog niet opgeslagen) blijft bewaard als je van tab wisselt.
  const [initialDraft] = useState(() => readDishDraft(draftKey))

  const [name, setName] = useState(initialDraft?.name ?? '')
  const [lines, setLines] = useState<Line[]>(() => withEmptyLast(initialDraft?.lines ?? []))
  const [dirty, setDirty] = useState(initialDraft !== null)
  const [saving, setSaving] = useState(false)
  const [usage, setUsage] = useState<DishUsage | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const loaded = useRef(initialDraft !== null)
  const [reload, setReload] = useState(0)
  const pickers = useRef(new Map<string, HTMLInputElement>())
  const quantities = useRef(new Map<string, HTMLInputElement>())

  // Bij een bestaand gerecht: de velden één keer vullen zodra de gegevens er zijn
  // (behalve als er een concept was).
  const dish = allDishes.data.find((d) => d.id === dishId)
  useEffect(() => {
    if (!dishId || loaded.current || !dish || existingLines.isLoading) return
    loaded.current = true
    setName(dish.name)
    setLines(
      withEmptyLast(
        existingLines.data.map((l) => ({
          key: l.id,
          ingredientId: l.ingredient_id,
          quantity: l.quantity === null ? '' : String(l.quantity).replace('.', ','),
          unit: l.unit ?? '',
        })),
      ),
    )
  }, [dishId, dish, existingLines.data, existingLines.isLoading, reload])

  // Concept bewaren bij elke wijziging door de gebruiker.
  useEffect(() => {
    if (!dirty) return
    writeDishDraft(
      { householdId: household.id, dishId: dishId ?? 'nieuw' },
      { name, lines: lines.filter((l) => l.ingredientId || l.quantity || l.unit) },
    )
  }, [dirty, name, lines, household.id, dishId])

  /** Focus na de volgende weergave (het veld bestaat dan pas). */
  function focusQuantity(key: string) {
    requestAnimationFrame(() => quantities.current.get(key)?.focus())
  }

  const update = (key: string, patch: Partial<Line>) => {
    setDirty(true)
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function chooseIngredient(key: string, ingredientId: string, unitHint?: string) {
    const unit = unitHint ?? ingredients.data.find((i) => i.id === ingredientId)?.default_unit ?? ''
    setDirty(true)
    setLines((prev) => withEmptyLast(prev.map((l) => (l.key === key ? { ...l, ingredientId, unit: l.unit || unit } : l))))
    // Door naar de hoeveelheid; het toetsenbord blijft open.
    focusQuantity(key)
  }

  async function createIngredient(key: string, ingredientName: string) {
    try {
      const ingredientId = await repo.addIngredient({ name: ingredientName })
      chooseIngredient(key, ingredientId, '')
    } catch (error) {
      notify.error('Ingrediënt toevoegen mislukt', describeError(error))
    }
  }

  function removeLine(key: string) {
    setDirty(true)
    setLines((prev) => withEmptyLast(prev.filter((l) => l.key !== key)))
  }

  function discardDraft() {
    clearDishDraft(draftKey)
    setDirty(false)
    setName('')
    setLines([emptyLine()])
    if (dishId) {
      // Het effect hierboven vult de velden opnieuw uit de database.
      loaded.current = false
      setReload((n) => n + 1)
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const filled = lines.filter((l) => l.ingredientId)
    if (!name.trim() || filled.length === 0) return
    setSaving(true)
    try {
      await repo.saveDish({
        id: dishId,
        name,
        lines: filled.map((l) => ({ ingredientId: l.ingredientId, quantity: parseQuantity(l.quantity), unit: l.unit })),
      })
      clearDishDraft(draftKey)
      setDirty(false)
      notify.success('Gerecht opgeslagen')
      navigate('/gerechten')
    } catch (error) {
      notify.error('Opslaan mislukt', describeError(error))
    } finally {
      setSaving(false)
    }
  }

  async function askDelete() {
    if (!dishId) return
    const found = await repo.dishUsage(dishId)
    if (found.menuNames.length > 0 || found.plannedDays > 0) setUsage(found)
    else setConfirmDelete(true)
  }

  async function reallyDelete() {
    if (!dishId) return
    setUsage(null)
    setConfirmDelete(false)
    await repo.removeDish(dishId)
    clearDishDraft(draftKey)
    notify.success('Gerecht verwijderd')
    navigate('/gerechten')
  }

  const canSave = name.trim() !== '' && lines.some((l) => l.ingredientId)

  return (
    <Stack gap="4" as="form" onSubmit={save}>
      <HStack>
        <IconButton variant="ghost" aria-label="Terug" type="button" onClick={() => navigate('/gerechten')}>
          <LuArrowLeft />
        </IconButton>
        <Heading size="lg">{dishId ? 'Gerecht bewerken' : 'Nieuw gerecht'}</Heading>
      </HStack>

      <Field.Root required>
        <Field.Label>Naam</Field.Label>
        <Input
          value={name}
          onChange={(e) => {
            setDirty(true)
            setName(e.target.value)
          }}
          placeholder="Bijvoorbeeld stamppot"
        />
      </Field.Root>

      {dirty && (
        <HStack justify="space-between" bg="yellow.subtle" rounded="md" px="3" py="1.5" gap="2">
          <Text fontSize="sm">Concept, nog niet opgeslagen</Text>
          <Button type="button" size="xs" variant="ghost" onClick={discardDraft}>
            Weggooien
          </Button>
        </HStack>
      )}

      <Stack gap="3">
        <Heading size="md">Ingrediënten</Heading>
        {lines.map((line, index) => {
          const isLast = index === lines.length - 1
          // Al gekozen in een andere regel: grijs en niet te kiezen.
          const usedElsewhere = new Set(lines.filter((l) => l.key !== line.key && l.ingredientId).map((l) => l.ingredientId))
          return (
            <Box key={line.key} borderWidth="1px" borderStyle={isLast ? 'dashed' : 'solid'} rounded="md" p="3" bg="bg">
              <Stack gap="2">
                <Flex gap="2" align="center" minW="0">
                  <IngredientPicker
                    ref={(el) => {
                      if (el) pickers.current.set(line.key, el)
                      else pickers.current.delete(line.key)
                    }}
                    ingredients={ingredients.data}
                    usedIds={usedElsewhere}
                    value={line.ingredientId}
                    onChoose={(ingredientId) => chooseIngredient(line.key, ingredientId)}
                    onCreate={(ingredientName) => void createIngredient(line.key, ingredientName)}
                  />
                  {!isLast && (
                    <IconButton
                      variant="ghost"
                      colorPalette="red"
                      aria-label="Haal ingrediënt weg"
                      type="button"
                      onClick={() => removeLine(line.key)}
                    >
                      <LuTrash2 />
                    </IconButton>
                  )}
                </Flex>
                {line.ingredientId && (
                  <Flex gap="2">
                    <Input
                      ref={(el) => {
                        if (el) quantities.current.set(line.key, el)
                        else quantities.current.delete(line.key)
                      }}
                      aria-label="Hoeveelheid"
                      inputMode="decimal"
                      enterKeyHint="next"
                      placeholder="Hoeveelheid"
                      value={line.quantity}
                      onChange={(e) => update(line.key, { quantity: e.target.value })}
                    />
                    <Input
                      aria-label="Eenheid"
                      placeholder="Eenheid (leeg = stuks)"
                      list="units"
                      enterKeyHint="next"
                      value={line.unit}
                      onChange={(e) => update(line.key, { unit: e.target.value })}
                      onKeyDown={(e) => {
                        // Enter: door naar het volgende (lege) ingrediënt.
                        if (e.key !== 'Enter') return
                        e.preventDefault()
                        const next = lines[index + 1]
                        if (next) pickers.current.get(next.key)?.focus()
                      }}
                    />
                  </Flex>
                )}
                {line.ingredientId &&
                  (() => {
                    const ingredient = ingredients.data.find((i) => i.id === line.ingredientId)
                    if (!ingredient) return null
                    // Een ingrediënt van een andere winkel heeft geen Picnic-product; toon die winkel.
                    const store = ingredient.label_id ? labels.data.find((l) => l.id === ingredient.label_id) : undefined
                    if (store) return <Box><LabelBadge label={store} /></Box>
                    return (
                      <PicnicProductPicker
                        refType="ingredient"
                        refKey={normalizeName(ingredient.name)}
                        articleName={ingredient.name}
                      />
                    )
                  })()}
              </Stack>
            </Box>
          )
        })}
        <datalist id="units">
          {UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </Stack>

      <HStack justify="space-between" mt="2">
        <Button type="submit" colorPalette="green" disabled={!canSave} loading={saving}>
          Opslaan
        </Button>
        {dishId && (
          <Button type="button" variant="ghost" colorPalette="red" onClick={askDelete}>
            Verwijderen
          </Button>
        )}
      </HStack>

      {/* Requirement 12: een gerecht dat in een weekmenu zit, verwijder je niet zomaar. */}
      <AppDialog
        open={usage !== null}
        onClose={() => setUsage(null)}
        title="Dit gerecht is onderdeel van een weekmenu. Wat wil je doen?"
        footer={
          <>
            <Button variant="outline" onClick={() => setUsage(null)}>
              Niet verwijderen
            </Button>
            <Button colorPalette="red" onClick={reallyDelete}>
              Wel verwijderen
            </Button>
          </>
        }
      >
        <Stack gap="2">
          {usage && usage.menuNames.length > 0 && (
            <Text>Het zit in: {usage.menuNames.join(', ')}.</Text>
          )}
          {usage && usage.plannedDays > 0 && (
            <Text>Het staat ook nog op {usage.plannedDays} geplande {usage.plannedDays === 1 ? 'dag' : 'dagen'}.</Text>
          )}
          <Text color="fg.muted">
            Verwijder je het gerecht, dan blijft de naam grijs in het weekmenu staan, zodat je ziet dat het er
            vroeger in zat. Het levert dan geen boodschappen meer op.
          </Text>
        </Stack>
      </AppDialog>

      <ConfirmDialog
        open={confirmDelete}
        title="Gerecht verwijderen?"
        message={`"${name}" wordt verwijderd.`}
        confirmLabel="Verwijderen"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={reallyDelete}
      />
    </Stack>
  )
}

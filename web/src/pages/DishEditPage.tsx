import { Box, Button, Field, Flex, Heading, HStack, IconButton, Input, NativeSelect, Stack, Text } from '@chakra-ui/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { LuArrowLeft, LuPlus, LuTrash2 } from 'react-icons/lu'
import { useNavigate, useParams } from 'react-router-dom'
import { AppDialog, ConfirmDialog } from '../components/ConfirmDialog'
import { notify } from '../components/toaster'
import { useAllDishes, useDishIngredients, useIngredients } from '../data/hooks'
import { useRepo, type DishUsage } from '../data/repo'
import { describeError } from '../lib/errors'

interface Line {
  key: string
  ingredientId: string
  quantity: string
  unit: string
}

const UNITS = ['g', 'kg', 'ml', 'l', 'el', 'tl', 'blik', 'pak', 'zakje', 'bosje', 'teentje', 'snufje']
const emptyLine = (): Line => ({ key: crypto.randomUUID(), ingredientId: '', quantity: '', unit: '' })

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
  const allDishes = useAllDishes()
  const existingLines = useDishIngredients(dishId)

  const [name, setName] = useState('')
  const [lines, setLines] = useState<Line[]>([emptyLine()])
  const [newIngredient, setNewIngredient] = useState('')
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [usage, setUsage] = useState<DishUsage | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const loaded = useRef(false)

  // Bij een bestaand gerecht: de velden één keer vullen zodra de gegevens er zijn.
  const dish = allDishes.data.find((d) => d.id === dishId)
  useEffect(() => {
    if (!dishId || loaded.current || !dish || existingLines.isLoading) return
    loaded.current = true
    setName(dish.name)
    setLines(
      existingLines.data.length > 0
        ? existingLines.data.map((l) => ({
            key: l.id,
            ingredientId: l.ingredient_id,
            quantity: l.quantity === null ? '' : String(l.quantity).replace('.', ','),
            unit: l.unit ?? '',
          }))
        : [emptyLine()],
    )
  }, [dishId, dish, existingLines.data, existingLines.isLoading])

  const update = (key: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  function chooseIngredient(key: string, ingredientId: string) {
    const unit = ingredients.data.find((i) => i.id === ingredientId)?.default_unit ?? ''
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ingredientId, unit: l.unit || unit } : l)),
    )
  }

  async function addIngredient(key: string) {
    if (!newIngredient.trim()) return
    try {
      const ingredientId = await repo.addIngredient({ name: newIngredient })
      setNewIngredient('')
      setAddingFor(null)
      chooseIngredient(key, ingredientId)
    } catch (error) {
      notify.error('Ingrediënt toevoegen mislukt', describeError(error))
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
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijvoorbeeld stamppot" />
      </Field.Root>

      <Stack gap="3">
        <Heading size="md">Ingrediënten</Heading>
        {lines.map((line) => (
          <Box key={line.key} borderWidth="1px" rounded="md" p="3" bg="bg">
            <Stack gap="2">
              <Flex gap="2" align="center">
                <NativeSelect.Root flex="1">
                  <NativeSelect.Field
                    aria-label="Ingrediënt"
                    value={line.ingredientId}
                    onChange={(e) => {
                      if (e.target.value === '__new') setAddingFor(line.key)
                      else chooseIngredient(line.key, e.target.value)
                    }}
                  >
                    <option value="">Kies een ingrediënt…</option>
                    {ingredients.data.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                    <option value="__new">＋ Nieuw ingrediënt…</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <IconButton
                  variant="ghost"
                  colorPalette="red"
                  aria-label="Haal ingrediënt weg"
                  type="button"
                  disabled={lines.length === 1 && !line.ingredientId}
                  onClick={() => setLines((prev) => (prev.length === 1 ? [emptyLine()] : prev.filter((l) => l.key !== line.key)))}
                >
                  <LuTrash2 />
                </IconButton>
              </Flex>
              {addingFor === line.key && (
                <Flex gap="2">
                  <Input
                    autoFocus
                    size="sm"
                    placeholder="Naam van het nieuwe ingrediënt"
                    value={newIngredient}
                    onChange={(e) => setNewIngredient(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void addIngredient(line.key)
                      }
                    }}
                  />
                  <Button size="sm" type="button" colorPalette="green" onClick={() => addIngredient(line.key)}>
                    Toevoegen
                  </Button>
                  <Button size="sm" type="button" variant="ghost" onClick={() => setAddingFor(null)}>
                    Annuleren
                  </Button>
                </Flex>
              )}
              <Flex gap="2">
                <Input
                  aria-label="Hoeveelheid"
                  inputMode="decimal"
                  placeholder="Hoeveelheid"
                  value={line.quantity}
                  onChange={(e) => update(line.key, { quantity: e.target.value })}
                />
                <Input
                  aria-label="Eenheid"
                  placeholder="Eenheid (leeg = stuks)"
                  list="units"
                  value={line.unit}
                  onChange={(e) => update(line.key, { unit: e.target.value })}
                />
              </Flex>
            </Stack>
          </Box>
        ))}
        <datalist id="units">
          {UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <Button type="button" variant="outline" alignSelf="flex-start" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
          <LuPlus /> Ingrediënt toevoegen
        </Button>
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

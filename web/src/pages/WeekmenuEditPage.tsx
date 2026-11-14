import { Box, Button, Card, Field, Flex, HStack, Heading, IconButton, Input, Stack, Text } from '@chakra-ui/react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { LuArrowLeft, LuTrash2, LuX } from 'react-icons/lu'
import { useNavigate, useParams } from 'react-router-dom'
import { ApplyWeekmenuDialog } from '../components/ApplyWeekmenuDialog'
import { useWeek } from '../components/AppShell'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DishPickerDialog } from '../components/DishPickerDialog'
import { notify } from '../components/toaster'
import { useAllDishes, useWeekmenuDays, useWeekmenuStoreItems, useWeekmenus } from '../data/hooks'
import { useRepo } from '../data/repo'
import { weekdayName } from '../domain/dates'
import { describeError } from '../lib/errors'

export default function WeekmenuEditPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const repo = useRepo()
  const { weekStart } = useWeek()
  const menus = useWeekmenus()
  const allDays = useWeekmenuDays()
  const allStoreItems = useWeekmenuStoreItems()
  const dishes = useAllDishes()
  const menu = menus.data.find((m) => m.id === id)

  const [name, setName] = useState('')
  const [pickerDay, setPickerDay] = useState<number | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [applyOpen, setApplyOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (menu) setName((current) => (current === '' ? menu.name : current))
  }, [menu])

  const dishById = useMemo(() => new Map(dishes.data.map((d) => [d.id, d])), [dishes.data])
  const dishOfWeekday = useMemo(
    () => new Map(allDays.data.filter((d) => d.weekmenu_id === id).map((d) => [d.weekday, d.dish_id])),
    [allDays.data, id],
  )
  const storeItems = allStoreItems.data.filter((i) => i.weekmenu_id === id)

  if (!menu) {
    return (
      <Stack gap="4">
        <Button variant="ghost" alignSelf="flex-start" onClick={() => navigate('/weekmenus')}>
          <LuArrowLeft /> Terug
        </Button>
        <Text color="fg.muted">{menus.isLoading ? 'Laden…' : "Dit weekmenu bestaat niet (meer)."}</Text>
      </Stack>
    )
  }

  async function saveName(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || name.trim() === menu?.name) return
    try {
      await repo.renameWeekmenu(id, name)
      notify.success('Naam opgeslagen')
    } catch (error) {
      notify.error('Opslaan mislukt', describeError(error))
    }
  }

  async function addLabel(e: FormEvent) {
    e.preventDefault()
    if (!newLabel.trim()) return
    await repo.addWeekmenuStoreItem(id, newLabel)
    setNewLabel('')
  }

  return (
    <Stack gap="4">
      <HStack>
        <IconButton variant="ghost" aria-label="Terug" onClick={() => navigate('/weekmenus')}>
          <LuArrowLeft />
        </IconButton>
        <Heading size="lg">Weekmenu bewerken</Heading>
      </HStack>

      <form onSubmit={saveName}>
        <Field.Root>
          <Field.Label>Naam</Field.Label>
          <Flex gap="2" w="full">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" variant="outline" disabled={!name.trim() || name.trim() === menu.name}>
              Opslaan
            </Button>
          </Flex>
        </Field.Root>
      </form>

      <Stack gap="2">
        <Heading size="md">Avondeten per dag</Heading>
        {Array.from({ length: 7 }, (_, i) => i + 1).map((weekday) => {
          const dishId = dishOfWeekday.get(weekday) ?? null
          const dish = dishId ? dishById.get(dishId) : undefined
          const removed = !!dish && dish.deleted_at !== null
          return (
            <Card.Root key={weekday} variant="outline">
              <Card.Body p="3">
                <Flex align="center" justify="space-between" gap="3">
                  <Box minW="0" flex="1">
                    <Text fontWeight="semibold" textTransform="capitalize">
                      {weekdayName(weekday)}
                    </Text>
                    {dish ? (
                      <Text
                        truncate
                        color={removed ? 'fg.subtle' : undefined}
                        fontStyle={removed ? 'italic' : undefined}
                        title={removed ? 'Dit gerecht bestaat niet meer' : undefined}
                      >
                        {dish.name}
                        {removed && ' (verwijderd)'}
                      </Text>
                    ) : (
                      <Text color="fg.subtle">Nog niets gekozen</Text>
                    )}
                  </Box>
                  <HStack gap="1">
                    <Button size="sm" variant={dish ? 'outline' : 'solid'} colorPalette="green" onClick={() => setPickerDay(weekday)}>
                      {dish ? 'Wijzig' : 'Kies'}
                    </Button>
                    {dish && (
                      <IconButton
                        size="sm"
                        variant="ghost"
                        aria-label="Haal gerecht weg"
                        onClick={() => repo.setWeekmenuDay(id, weekday, null)}
                      >
                        <LuX />
                      </IconButton>
                    )}
                  </HStack>
                </Flex>
              </Card.Body>
            </Card.Root>
          )
        })}
      </Stack>

      <Stack gap="2">
        <Heading size="md">Items voor de lijst bij dit weekmenu</Heading>
        <Text color="fg.muted" fontSize="sm">
          Items voor de andere supermarkt die je mee wilt nemen wanneer je dit weekmenu gebruikt.
        </Text>
        {storeItems.map((item) => (
          <Flex key={item.id} align="center" justify="space-between" borderWidth="1px" rounded="md" bg="bg" px="3" py="2">
            <Text>{item.label}</Text>
            <IconButton
              size="sm"
              variant="ghost"
              colorPalette="red"
              aria-label={`Verwijder ${item.label}`}
              onClick={() => repo.removeWeekmenuStoreItem(item.id)}
            >
              <LuTrash2 />
            </IconButton>
          </Flex>
        ))}
        <form onSubmit={addLabel}>
          <Flex gap="2">
            <Input
              aria-label="Nieuw item voor de lijst"
              placeholder="Nieuw item"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <Button type="submit" variant="outline" disabled={!newLabel.trim()}>
              Toevoegen
            </Button>
          </Flex>
        </form>
      </Stack>

      <HStack justify="space-between" mt="2">
        <Button colorPalette="green" onClick={() => setApplyOpen(true)}>
          Gebruik in week
        </Button>
        <Button variant="ghost" colorPalette="red" onClick={() => setDeleteOpen(true)}>
          Verwijderen
        </Button>
      </HStack>

      <DishPickerDialog
        open={pickerDay !== null}
        title={pickerDay ? `Avondeten ${weekdayName(pickerDay)}` : ''}
        currentDishId={pickerDay ? (dishOfWeekday.get(pickerDay) ?? null) : null}
        onPick={async (dishId) => {
          const day = pickerDay
          setPickerDay(null)
          if (day) await repo.setWeekmenuDay(id, day, dishId)
        }}
        onClose={() => setPickerDay(null)}
      />
      <ApplyWeekmenuDialog open={applyOpen} menu={menu} weekStart={weekStart} onClose={() => setApplyOpen(false)} />
      <ConfirmDialog
        open={deleteOpen}
        title="Weekmenu verwijderen?"
        message={`"${menu.name}" wordt verwijderd. De gerechten zelf blijven bestaan.`}
        confirmLabel="Verwijderen"
        destructive
        onCancel={() => setDeleteOpen(false)}
        onConfirm={async () => {
          setDeleteOpen(false)
          await repo.removeWeekmenu(id)
          navigate('/weekmenus')
        }}
      />
    </Stack>
  )
}

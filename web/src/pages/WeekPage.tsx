import { Badge, Box, Button, Card, Checkbox, Field, Flex, HStack, Heading, IconButton, Input, Stack, Text } from '@chakra-ui/react'
import { useMemo, useState, type FormEvent } from 'react'
import { LuChevronLeft, LuChevronRight, LuPlus, LuX } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { AppDialog, ConfirmDialog } from '../components/ConfirmDialog'
import { useWeek } from '../components/AppShell'
import { DishPickerDialog } from '../components/DishPickerDialog'
import { NewWeekmenuDialog } from '../components/NewWeekmenuDialog'
import { notify } from '../components/toaster'
import { useAllDishes, useStoreItems, useWeekDays } from '../data/hooks'
import { isOn } from '../data/rows'
import { useRepo } from '../data/repo'
import {
  addDays,
  formatDayMonth,
  isoWeekNumber,
  startOfWeek,
  todayISO,
  weekDates,
  weekdayName,
  weekdayNumber,
} from '../domain/dates'
import { hasPlannedDishes } from '../domain/weekmenu'
import { describeError } from '../lib/errors'

export default function WeekPage() {
  const { weekStart, setWeekStart } = useWeek()
  const repo = useRepo()
  const navigate = useNavigate()
  const days = useWeekDays(weekStart)
  const dishes = useAllDishes()
  const [pickerDay, setPickerDay] = useState<string | null>(null)
  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)

  const dishById = useMemo(() => new Map(dishes.data.map((d) => [d.id, d])), [dishes.data])
  const dishOfDay = useMemo(() => new Map(days.data.map((d) => [d.day, d.dish_id])), [days.data])
  const dates = weekDates(weekStart)
  const today = todayISO()
  const planned = hasPlannedDishes(dates.map((day) => ({ day, dishId: dishOfDay.get(day) ?? null })))
  const isCurrentWeek = weekStart === startOfWeek(today)

  async function pick(day: string, dishId: string | null) {
    setPickerDay(null)
    try {
      await repo.setWeekDay(day, dishId)
    } catch (error) {
      notify.error('Opslaan mislukt', describeError(error))
    }
  }

  return (
    <Stack gap="4">
      <Flex align="center" justify="space-between" gap="2">
        <IconButton variant="outline" aria-label="Vorige week" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <LuChevronLeft />
        </IconButton>
        <Box textAlign="center">
          <Heading size="lg">Week {isoWeekNumber(weekStart)}</Heading>
          <Text color="fg.muted" fontSize="sm">
            {formatDayMonth(weekStart)} – {formatDayMonth(addDays(weekStart, 6))}
          </Text>
          {!isCurrentWeek && (
            <Button size="xs" variant="plain" colorPalette="green" onClick={() => setWeekStart(startOfWeek(today))}>
              Naar deze week
            </Button>
          )}
        </Box>
        <IconButton variant="outline" aria-label="Volgende week" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <LuChevronRight />
        </IconButton>
      </Flex>

      <HStack gap="2" flexWrap="wrap">
        <Button colorPalette="green" onClick={() => setNewMenuOpen(true)}>
          <LuPlus /> Maak nieuw weekmenu
        </Button>
        <Button variant="outline" onClick={() => navigate('/weekmenus')}>
          Blader door weekmenu's
        </Button>
      </HStack>

      <Stack gap="2" as="ul" listStyleType="none" m="0" p="0">
        {dates.map((day) => {
          const dishId = dishOfDay.get(day) ?? null
          const dish = dishId ? dishById.get(dishId) : undefined
          const removed = !!dish && dish.deleted_at !== null
          const isToday = day === today
          return (
            <Card.Root as="li" key={day} variant="outline" borderColor={isToday ? 'green.500' : undefined}>
              <Card.Body p="3">
                <Flex align="center" justify="space-between" gap="3">
                  <Box minW="0" flex="1">
                    <HStack gap="2">
                      <Text fontWeight="semibold" textTransform="capitalize">
                        {weekdayName(weekdayNumber(day))}
                      </Text>
                      <Text color="fg.muted" fontSize="sm">
                        {formatDayMonth(day)}
                      </Text>
                      {isToday && <Badge colorPalette="green">vandaag</Badge>}
                    </HStack>
                    {dish ? (
                      <Text
                        mt="1"
                        truncate
                        color={removed ? 'fg.subtle' : undefined}
                        fontStyle={removed ? 'italic' : undefined}
                        title={removed ? 'Dit gerecht bestaat niet meer' : undefined}
                      >
                        {dish.name}
                        {removed && ' (verwijderd)'}
                      </Text>
                    ) : (
                      <Text mt="1" color="fg.subtle">
                        Nog niets gekozen
                      </Text>
                    )}
                  </Box>
                  <HStack gap="1">
                    <Button size="sm" variant={dish ? 'outline' : 'solid'} colorPalette="green" onClick={() => setPickerDay(day)}>
                      {dish ? 'Wijzig' : 'Kies'}
                    </Button>
                    {dish && (
                      <IconButton size="sm" variant="ghost" aria-label="Haal gerecht weg" onClick={() => pick(day, null)}>
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

      <HStack gap="2" flexWrap="wrap">
        <Button variant="outline" disabled={!planned} onClick={() => setSaveOpen(true)}>
          Opslaan als weekmenu
        </Button>
        <Button variant="ghost" colorPalette="red" disabled={!planned} onClick={() => setClearOpen(true)}>
          Week leegmaken
        </Button>
      </HStack>

      <DishPickerDialog
        open={pickerDay !== null}
        title={pickerDay ? `Avondeten ${weekdayName(weekdayNumber(pickerDay))} ${formatDayMonth(pickerDay)}` : ''}
        currentDishId={pickerDay ? (dishOfDay.get(pickerDay) ?? null) : null}
        onPick={(id) => pickerDay && pick(pickerDay, id)}
        onClose={() => setPickerDay(null)}
      />

      <NewWeekmenuDialog open={newMenuOpen} onClose={() => setNewMenuOpen(false)} />

      <SaveWeekmenuDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        days={dates.map((day) => ({ day, dishId: dishOfDay.get(day) ?? null }))}
      />

      <ConfirmDialog
        open={clearOpen}
        title="Week leegmaken?"
        message="Alle gerechten van deze week worden weggehaald. Opgeslagen weekmenu's blijven bestaan."
        confirmLabel="Leegmaken"
        destructive
        onCancel={() => setClearOpen(false)}
        onConfirm={async () => {
          setClearOpen(false)
          await repo.clearWeek(dates)
        }}
      />
    </Stack>
  )
}

function SaveWeekmenuDialog({
  open,
  onClose,
  days,
}: {
  open: boolean
  onClose: () => void
  days: Array<{ day: string; dishId: string | null }>
}) {
  const repo = useRepo()
  const navigate = useNavigate()
  const storeItems = useStoreItems()
  const [name, setName] = useState('')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const open_ = storeItems.data.filter((i) => !isOn(i.done))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      await repo.saveWeekAsMenu({
        name,
        days,
        storeLabels: open_.filter((i) => !excluded.has(i.id)).map((i) => i.label),
      })
      notify.success(`Weekmenu "${name.trim()}" opgeslagen`)
      setName('')
      setExcluded(new Set())
      onClose()
      navigate('/weekmenus')
    } catch (error) {
      notify.error('Opslaan mislukt', describeError(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Opslaan als weekmenu"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuleren
          </Button>
          <Button type="submit" form="save-weekmenu" colorPalette="green" disabled={!name.trim()} loading={busy}>
            Opslaan
          </Button>
        </>
      }
    >
      <form id="save-weekmenu" onSubmit={submit}>
        <Stack gap="4">
          <Field.Root>
            <Field.Label>Naam</Field.Label>
            <Input autoFocus placeholder="Bijvoorbeeld Weekmenu 1" value={name} onChange={(e) => setName(e.target.value)} />
          </Field.Root>
          {open_.length > 0 && (
            <Stack gap="2">
              <Text fontWeight="medium">Winkellijst voor de andere supermarkt meenemen</Text>
              {open_.map((item) => (
                <Checkbox.Root
                  key={item.id}
                  checked={!excluded.has(item.id)}
                  onCheckedChange={(e) =>
                    setExcluded((prev) => {
                      const next = new Set(prev)
                      if (e.checked) next.delete(item.id)
                      else next.add(item.id)
                      return next
                    })
                  }
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label>{item.label}</Checkbox.Label>
                </Checkbox.Root>
              ))}
            </Stack>
          )}
        </Stack>
      </form>
    </AppDialog>
  )
}

import { Button, Checkbox, Stack, Text } from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWeekDays, useWeekmenuDays, useWeekmenuStoreItems } from '../data/hooks'
import { useRepo } from '../data/repo'
import { addDays, formatDayMonth, isoWeekNumber } from '../domain/dates'
import { needsOverwriteConfirmation } from '../domain/weekmenu'
import { describeError } from '../lib/errors'
import { AppDialog } from './ConfirmDialog'
import { notify } from './toaster'

interface Props {
  open: boolean
  menu: { id: string; name: string } | null
  weekStart: string
  onClose: () => void
}

/**
 * Een weekmenu toepassen op de week waar je mee bezig bent (requirement 12):
 * de week en de boodschappenlijst worden gevuld, en je kiest welke items van
 * de winkellijst mee mogen. Is de week al ingevuld, dan staat er een waarschuwing.
 */
export function ApplyWeekmenuDialog({ open, menu, weekStart, onClose }: Props) {
  const repo = useRepo()
  const navigate = useNavigate()
  const allDays = useWeekmenuDays()
  const allStoreItems = useWeekmenuStoreItems()
  const currentWeek = useWeekDays(weekStart)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const menuDays = useMemo(
    () =>
      allDays.data
        .filter((d) => d.weekmenu_id === menu?.id)
        .map((d) => ({ weekday: d.weekday, dishId: d.dish_id })),
    [allDays.data, menu?.id],
  )
  const storeItems = useMemo(
    () => allStoreItems.data.filter((i) => i.weekmenu_id === menu?.id),
    [allStoreItems.data, menu?.id],
  )
  const overwrite = needsOverwriteConfirmation(
    currentWeek.data.map((d) => ({ day: d.day, dishId: d.dish_id })),
  )

  useEffect(() => {
    if (open) setExcluded(new Set())
  }, [open, menu?.id])

  async function apply() {
    if (!menu) return
    setBusy(true)
    try {
      await repo.applyWeekmenu({
        menuDays,
        weekStart,
        storeLabels: storeItems.filter((i) => !excluded.has(i.id)).map((i) => i.label),
      })
      notify.success(`"${menu.name}" staat nu in week ${isoWeekNumber(weekStart)}`)
      onClose()
      navigate('/')
    } catch (error) {
      notify.error('Toepassen mislukt', describeError(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={menu ? `"${menu.name}" gebruiken` : 'Weekmenu gebruiken'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuleren
          </Button>
          <Button colorPalette={overwrite ? 'orange' : 'green'} loading={busy} onClick={apply}>
            {overwrite ? 'Week overschrijven' : 'Vul de week'}
          </Button>
        </>
      }
    >
      <Stack gap="4">
        <Text>
          Week {isoWeekNumber(weekStart)} ({formatDayMonth(weekStart)} – {formatDayMonth(addDays(weekStart, 6))}) wordt
          gevuld. De boodschappenlijst volgt vanzelf.
        </Text>
        {overwrite && (
          <Text color="orange.600" fontWeight="medium">
            Deze week is al ingevuld. Als je doorgaat, worden de gerechten van deze week vervangen.
          </Text>
        )}
        {storeItems.length > 0 && (
          <Stack gap="2">
            <Text fontWeight="medium">Items voor de winkellijst</Text>
            {storeItems.map((item) => (
              <Checkbox.Root
                key={item.id}
                colorPalette="green"
                checked={!excluded.has(item.id)}
                onCheckedChange={(e) =>
                  setExcluded((prev) => {
                    const next = new Set(prev)
                    if (e.checked === true) next.delete(item.id)
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
    </AppDialog>
  )
}

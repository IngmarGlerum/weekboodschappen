import {
  Box,
  Button,
  Checkbox,
  Collapsible,
  Field,
  Flex,
  HStack,
  Heading,
  IconButton,
  Input,
  Separator,
  Stack,
  Switch,
  Text,
} from '@chakra-ui/react'
import { useState, type FormEvent } from 'react'
import { LuArrowRight, LuChevronDown, LuChevronLeft, LuChevronRight, LuCopy, LuTrash2, LuX } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { AppDialog } from '../components/ConfirmDialog'
import { useWeek } from '../components/weekContext'
import { notify } from '../components/toaster'
import { useGeneralItems, useShoppingList, useStoreLabels } from '../data/hooks'
import { LabelBadge, PicnicBadge } from '../components/list/LabelBadge'
import { LabelSelect } from '../components/list/LabelSelect'
import { isOn, type StoreLabelRow } from '../data/rows'

const labelById = (labels: StoreLabelRow[], id: string) => labels.find((l) => l.id === id)
import { useRepo } from '../data/repo'
import { addDays, formatDayMonth, isoWeekNumber } from '../domain/dates'
import { formatLabel, shoppingListToText, type ListLine } from '../domain/shoppingList'
import { describeError } from '../lib/errors'

export default function ShoppingPage() {
  const { weekStart, setWeekStart } = useWeek()
  const repo = useRepo()
  const { list, isLoading } = useShoppingList(weekStart)
  const general = useGeneralItems()
  const labels = useStoreLabels()
  const navigate = useNavigate()
  const [newItem, setNewItem] = useState('')
  const [everyWeek, setEveryWeek] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)

  // Dit scherm is de Picnic-lijst; artikelen met een andere winkel staan op de Lijst.
  const open = list.picnic.filter((l) => !l.checked)
  const done = list.picnic.filter((l) => l.checked)
  const elsewhereOpen = list.elsewhere.filter((l) => !l.checked).length

  async function addItem(e: FormEvent) {
    e.preventDefault()
    if (!newItem.trim()) return
    try {
      if (everyWeek) await repo.addGeneralItem(newItem)
      else await repo.addWeekExtra(weekStart, newItem)
      setNewItem('')
    } catch (error) {
      notify.error('Toevoegen mislukt', describeError(error))
    }
  }

  async function copyOrShare() {
    const text = shoppingListToText(list.picnic)
    if (!text) return
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `Boodschappen week ${isoWeekNumber(weekStart)}`, text })
      } else {
        await navigator.clipboard.writeText(text)
        notify.success('Lijst gekopieerd')
      }
    } catch (error) {
      // Annuleren van het deelmenu is geen fout.
      if (error instanceof DOMException && error.name === 'AbortError') return
      notify.error('Kopiëren mislukt', describeError(error))
    }
  }

  return (
    <Stack gap="4">
      <Flex align="center" justify="space-between" gap="2">
        <IconButton variant="outline" aria-label="Vorige week" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <LuChevronLeft />
        </IconButton>
        <Box textAlign="center">
          <HStack gap="2" justify="center">
            <Heading size="lg">Boodschappen</Heading>
            <PicnicBadge />
          </HStack>
          <Text color="fg.muted" fontSize="sm">
            Week {isoWeekNumber(weekStart)} · {formatDayMonth(weekStart)} – {formatDayMonth(addDays(weekStart, 6))}
          </Text>
        </Box>
        <IconButton variant="outline" aria-label="Volgende week" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <LuChevronRight />
        </IconButton>
      </Flex>

      <form onSubmit={addItem}>
        <Field.Root>
          <Field.Label>Boodschap toevoegen</Field.Label>
          <Flex gap="2" w="full">
            <Input
              placeholder={everyWeek ? 'Bijvoorbeeld wc-papier' : 'Bijvoorbeeld een taart'}
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
            />
            <Button type="submit" colorPalette="green" disabled={!newItem.trim()}>
              Toevoegen
            </Button>
          </Flex>
        </Field.Root>
        {/* Buiten Field.Root: anders koppelt het veld zijn id aan deze schakelaar en doet een tik niets. */}
        <Switch.Root size="sm" colorPalette="green" checked={everyWeek} onCheckedChange={(e) => setEveryWeek(e.checked)} mt="2">
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label>Elke week (vaste boodschap)</Switch.Label>
        </Switch.Root>
        <Text color="fg.muted" fontSize="xs" mt="1">
          {everyWeek
            ? 'Staat elke week op de lijst, tot je het weghaalt of als huisvoorraad markeert.'
            : 'Alleen voor deze week. Iets voor een andere winkel? Zet het op de Lijst.'}
        </Text>
      </form>

      {list.picnic.length === 0 && !isLoading && (
        <Text color="fg.muted">
          Er staat niets op de Picnic-lijst. Plan gerechten in de week, of voeg hierboven een boodschap toe.
        </Text>
      )}

      <Stack gap="1" as="ul" listStyleType="none" m="0" p="0">
        {open.map((line) => (
          <ListItem key={`${line.refType}|${line.refKey}`} line={line} weekStart={weekStart} />
        ))}
      </Stack>

      {done.length > 0 && (
        <Stack gap="1">
          <Text color="fg.muted" fontSize="sm" fontWeight="medium">
            Afgevinkt ({done.length})
          </Text>
          <Stack gap="1" as="ul" listStyleType="none" m="0" p="0">
            {done.map((line) => (
              <ListItem key={`${line.refType}|${line.refKey}`} line={line} weekStart={weekStart} />
            ))}
          </Stack>
        </Stack>
      )}

      {elsewhereOpen > 0 && (
        <Button variant="subtle" justifyContent="space-between" onClick={() => navigate('/lijst')}>
          {elsewhereOpen === 1 ? '1 artikel voor een andere winkel staat' : `${elsewhereOpen} artikelen voor andere winkels staan`} op de
          Lijst
          <LuArrowRight />
        </Button>
      )}

      <HStack gap="2" flexWrap="wrap">
        <Button colorPalette="green" onClick={() => setFinishOpen(true)}>
          Afronden
        </Button>
        <Button variant="outline" disabled={open.length === 0} onClick={copyOrShare}>
          <LuCopy /> Kopieer of deel lijst
        </Button>
      </HStack>

      <Collapsible.Root>
        <Collapsible.Trigger asChild>
          <Button variant="ghost" size="sm" alignSelf="flex-start">
            Vaste boodschappen beheren <LuChevronDown />
          </Button>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <Stack gap="2" pt="2">
            {general.data.length === 0 && <Text color="fg.muted">Nog geen vaste boodschappen.</Text>}
            {general.data.map((item) => (
              <Flex
                key={item.id}
                align="center"
                justify="space-between"
                gap="2"
                flexWrap="wrap"
                borderWidth="1px"
                rounded="md"
                p="2"
                bg="bg"
              >
                <Text truncate flex="1" minW="100px">
                  {item.name}
                </Text>
                <HStack gap="2">
                  <LabelSelect
                    labels={labels.data}
                    value={item.label_id}
                    empty="picnic"
                    onChange={(labelId) => void repo.setGeneralLabel(item.id, labelId)}
                  />
                  <Switch.Root
                    size="sm"
                    colorPalette="green"
                    checked={isOn(item.is_pantry)}
                    onCheckedChange={(e) => repo.setGeneralPantry(item.id, e.checked)}
                  >
                    <Switch.HiddenInput />
                    <Switch.Control />
                    <Switch.Label>Huisvoorraad</Switch.Label>
                  </Switch.Root>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    colorPalette="red"
                    aria-label={`Verwijder ${item.name}`}
                    onClick={() => repo.removeGeneralItem(item.id)}
                  >
                    <LuTrash2 />
                  </IconButton>
                </HStack>
              </Flex>
            ))}
          </Stack>
        </Collapsible.Content>
      </Collapsible.Root>

      <FinishDialog open={finishOpen} onClose={() => setFinishOpen(false)} weekStart={weekStart} />
    </Stack>
  )
}

function ListItem({ line, weekStart }: { line: ListLine; weekStart: string }) {
  const repo = useRepo()
  return (
    <Flex as="li" align="center" gap="2" borderWidth="1px" rounded="md" bg="bg" px="3" py="2">
      <Checkbox.Root
        colorPalette="green"
        flex="1"
        minW="0"
        checked={line.checked}
        onCheckedChange={(e) =>
          repo.patchListState(weekStart, line.refType, line.refKey, { checked: e.checked === true })
        }
      >
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label
          flex="1"
          textDecoration={line.checked ? 'line-through' : undefined}
          color={line.checked ? 'fg.subtle' : undefined}
        >
          {line.label}
          {line.refType === 'extra' && (
            <Text as="span" color="fg.muted" fontSize="xs">
              {' '}
              · deze week
            </Text>
          )}
        </Checkbox.Label>
      </Checkbox.Root>
      {line.refType === 'extra' && (
        <IconButton size="xs" variant="ghost" aria-label={`Haal ${line.name} weg`} onClick={() => void repo.removeWeekExtra(line.refKey)}>
          <LuX />
        </IconButton>
      )}
    </Flex>
  )
}

/** Requirement 6: "Ben je nog iets vergeten?" met twee blokken huisvoorraad. */
function FinishDialog({ open, onClose, weekStart }: { open: boolean; onClose: () => void; weekStart: string }) {
  const repo = useRepo()
  const { list } = useShoppingList(weekStart)
  const labels = useStoreLabels()
  const { forMenu, other } = list.prompt
  const empty = forMenu.length === 0 && other.length === 0

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Ben je nog iets vergeten?"
      footer={
        <Button colorPalette="green" onClick={onClose}>
          Klaar
        </Button>
      }
    >
      <Stack gap="4">
        {empty && (
          <Text color="fg.muted">
            Er is geen huisvoorraad om te controleren. Markeer een ingrediënt of algemene boodschap als huisvoorraad
            om hier te kunnen aangeven of het nog in huis is.
          </Text>
        )}
        {!empty && (
          <Text color="fg.muted" fontSize="sm">
            Vink aan wat je niet in huis hebt. Dat komt dan op de Picnic-lijst, of op de Lijst als het van een andere
            winkel komt.
          </Text>
        )}

        {forMenu.length > 0 && (
          <PromptBlock
            title="Huisvoorraad voor het weekmenu"
            lines={forMenu}
            weekStart={weekStart}
            repo={repo}
            labels={labels.data}
            showDishes
          />
        )}
        {forMenu.length > 0 && other.length > 0 && <Separator />}
        {other.length > 0 && (
          <PromptBlock title="Andere huisvoorraad" lines={other} weekStart={weekStart} repo={repo} labels={labels.data} />
        )}
      </Stack>
    </AppDialog>
  )
}

function PromptBlock({
  title,
  lines,
  weekStart,
  repo,
  labels,
  showDishes,
}: {
  title: string
  lines: ListLine[]
  weekStart: string
  repo: ReturnType<typeof useRepo>
  labels: StoreLabelRow[]
  showDishes?: boolean
}) {
  return (
    <Stack gap="2">
      <Heading size="sm">{title}</Heading>
      {lines.map((line) => (
        <Checkbox.Root
          key={`${line.refType}|${line.refKey}`}
          colorPalette="green"
          checked={line.missing}
          onCheckedChange={(e) =>
            repo.patchListState(weekStart, line.refType, line.refKey, { missing: e.checked === true })
          }
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control />
          <Checkbox.Label>
            <Text as="span">{formatLabel(line.name, line.parts, [])}</Text>
            {showDishes && line.dishes.length > 0 && (
              <Text as="span" color="fg.muted" fontSize="sm">
                {' '}
                – voor {line.dishes.map((d) => d.name).join(', ')}
              </Text>
            )}
            <Text as="span" color="fg.muted" fontSize="sm">
              {' '}
              · niet in huis
            </Text>
            {line.storeLabelId && labelById(labels, line.storeLabelId) && (
              <Box as="span" display="inline-flex" ml="1.5" verticalAlign="middle">
                <LabelBadge label={labelById(labels, line.storeLabelId) as StoreLabelRow} />
              </Box>
            )}
          </Checkbox.Label>
        </Checkbox.Root>
      ))}
    </Stack>
  )
}

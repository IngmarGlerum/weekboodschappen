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
import { LuChevronDown, LuChevronLeft, LuChevronRight, LuCopy, LuTrash2 } from 'react-icons/lu'
import { AppDialog } from '../components/ConfirmDialog'
import { useWeek } from '../components/AppShell'
import { notify } from '../components/toaster'
import { useGeneralItems, useShoppingList } from '../data/hooks'
import { isOn } from '../data/rows'
import { useRepo } from '../data/repo'
import { addDays, formatDayMonth, isoWeekNumber } from '../domain/dates'
import { formatLabel, shoppingListToText, type ListLine } from '../domain/shoppingList'
import { describeError } from '../lib/errors'

export default function ShoppingPage() {
  const { weekStart, setWeekStart } = useWeek()
  const repo = useRepo()
  const { list, isLoading } = useShoppingList(weekStart)
  const general = useGeneralItems()
  const [newItem, setNewItem] = useState('')
  const [finishOpen, setFinishOpen] = useState(false)

  const open = list.lines.filter((l) => !l.checked)
  const done = list.lines.filter((l) => l.checked)

  async function addGeneral(e: FormEvent) {
    e.preventDefault()
    if (!newItem.trim()) return
    try {
      await repo.addGeneralItem(newItem)
      setNewItem('')
    } catch (error) {
      notify.error('Toevoegen mislukt', describeError(error))
    }
  }

  async function copyOrShare() {
    const text = shoppingListToText(list.lines)
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
          <Heading size="lg">Boodschappen</Heading>
          <Text color="fg.muted" fontSize="sm">
            Week {isoWeekNumber(weekStart)} · {formatDayMonth(weekStart)} – {formatDayMonth(addDays(weekStart, 6))}
          </Text>
        </Box>
        <IconButton variant="outline" aria-label="Volgende week" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <LuChevronRight />
        </IconButton>
      </Flex>

      <form onSubmit={addGeneral}>
        <Field.Root>
          <Field.Label>Algemene boodschap toevoegen</Field.Label>
          <Flex gap="2" w="full">
            <Input
              placeholder="Bijvoorbeeld wc-papier"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
            />
            <Button type="submit" colorPalette="green" disabled={!newItem.trim()}>
              Toevoegen
            </Button>
          </Flex>
          <Field.HelperText>Staat elke week op de lijst, tot je het weghaalt of als huisvoorraad markeert.</Field.HelperText>
        </Field.Root>
      </form>

      {list.lines.length === 0 && !isLoading && (
        <Text color="fg.muted">
          Er staat niets op de lijst. Plan gerechten in de week, of voeg hierboven een algemene boodschap toe.
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
            Algemene boodschappen beheren <LuChevronDown />
          </Button>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <Stack gap="2" pt="2">
            {general.data.length === 0 && <Text color="fg.muted">Nog geen algemene boodschappen.</Text>}
            {general.data.map((item) => (
              <Flex key={item.id} align="center" justify="space-between" gap="3" borderWidth="1px" rounded="md" p="2" bg="bg">
                <Text truncate>{item.name}</Text>
                <HStack gap="2">
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
    <Box as="li" borderWidth="1px" rounded="md" bg="bg" px="3" py="2">
      <Checkbox.Root
        colorPalette="green"
        w="full"
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
        </Checkbox.Label>
      </Checkbox.Root>
    </Box>
  )
}

/** Requirement 6: "Ben je nog iets vergeten?" met twee blokken huisvoorraad. */
function FinishDialog({ open, onClose, weekStart }: { open: boolean; onClose: () => void; weekStart: string }) {
  const repo = useRepo()
  const { list } = useShoppingList(weekStart)
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
            Vink aan wat je niet in huis hebt. Dat komt dan op de boodschappenlijst.
          </Text>
        )}

        {forMenu.length > 0 && (
          <PromptBlock title="Huisvoorraad voor het weekmenu" lines={forMenu} weekStart={weekStart} repo={repo} showDishes />
        )}
        {forMenu.length > 0 && other.length > 0 && <Separator />}
        {other.length > 0 && <PromptBlock title="Andere huisvoorraad" lines={other} weekStart={weekStart} repo={repo} />}
      </Stack>
    </AppDialog>
  )
}

function PromptBlock({
  title,
  lines,
  weekStart,
  repo,
  showDishes,
}: {
  title: string
  lines: ListLine[]
  weekStart: string
  repo: ReturnType<typeof useRepo>
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
          </Checkbox.Label>
        </Checkbox.Root>
      ))}
    </Stack>
  )
}

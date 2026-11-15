import { Box, Button, Collapsible, HStack, IconButton, Stack, Text } from '@chakra-ui/react'
import { useMemo } from 'react'
import { LuCheck, LuChevronDown } from 'react-icons/lu'
import { useShoppingList } from '../../data/hooks'
import { useRepo } from '../../data/repo'
import type { StoreLabelRow } from '../../data/rows'
import { isoWeekNumber } from '../../domain/dates'
import type { ListLine } from '../../domain/shoppingList'
import { tick } from '../../lib/haptics'
import { useWeek } from '../weekContext'
import { LabelBadge } from './LabelBadge'

interface Props {
  labels: StoreLabelRow[]
  /** Alleen dit label tonen (filter van de Lijst). */
  filterLabelId: string | null
}

/**
 * "Uit de week": ingrediënten en vaste boodschappen met een andere winkel dan
 * Picnic, uitgerekend uit de geplande week. Niets wordt gekopieerd: haal je een
 * gerecht uit de week, dan verdwijnt het hier ook. Afvinken geldt per week.
 */
export function FromWeekBlock({ labels, filterLabelId }: Props) {
  const { weekStart } = useWeek()
  const repo = useRepo()
  const { list } = useShoppingList(weekStart)
  const labelById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels])

  const lines = list.elsewhere.filter((l) => !filterLabelId || l.storeLabelId === filterLabelId)
  const open = lines.filter((l) => !l.checked)
  const done = lines.filter((l) => l.checked)
  if (lines.length === 0) return null

  // Per winkel, in de volgorde van de labels.
  const groups = labels
    .map((label) => ({ label, lines: open.filter((l) => l.storeLabelId === label.id) }))
    .filter((g) => g.lines.length > 0)

  function toggle(line: ListLine) {
    tick()
    void repo.patchListState(weekStart, line.refType, line.refKey, { checked: !line.checked })
  }

  return (
    <Stack gap="2" borderWidth="1px" borderStyle="dashed" rounded="md" p="2.5" bg="bg.subtle">
      <HStack justify="space-between">
        <Text fontSize="sm" fontWeight="semibold">
          Uit week {isoWeekNumber(weekStart)}
        </Text>
        <Text fontSize="xs" color="fg.muted">
          {open.length} te halen
        </Text>
      </HStack>
      {groups.map(({ label, lines: groupLines }) => (
        <Stack key={label.id} gap="1">
          <Box>
            <LabelBadge label={label} />
          </Box>
          {groupLines.map((line) => (
            <Line key={`${line.refType}|${line.refKey}`} line={line} onToggle={() => toggle(line)} />
          ))}
        </Stack>
      ))}
      {open.length === 0 && (
        <Text fontSize="sm" color="fg.muted">
          Alles uit de week is gehaald.
        </Text>
      )}
      {done.length > 0 && (
        <Collapsible.Root>
          <Collapsible.Trigger asChild>
            <Button variant="ghost" size="xs" px="1">
              <LuChevronDown /> Gehaald ({done.length})
            </Button>
          </Collapsible.Trigger>
          <Collapsible.Content>
            <Stack gap="1" pt="1">
              {done.map((line) => (
                <Line
                  key={`${line.refType}|${line.refKey}`}
                  line={line}
                  label={line.storeLabelId ? labelById.get(line.storeLabelId) : undefined}
                  onToggle={() => toggle(line)}
                />
              ))}
            </Stack>
          </Collapsible.Content>
        </Collapsible.Root>
      )}
    </Stack>
  )
}

function Line({ line, label, onToggle }: { line: ListLine; label?: StoreLabelRow; onToggle: () => void }) {
  return (
    <HStack gap="2" bg="bg" borderWidth="1px" rounded="md" px="2" py="1" minH="44px">
      <IconButton
        size="sm"
        variant="ghost"
        rounded="full"
        aria-label={line.checked ? `${line.name} weer openzetten` : `${line.name} afvinken`}
        aria-pressed={line.checked}
        onClick={onToggle}
      >
        <Box
          boxSize="20px"
          rounded="full"
          borderWidth="2px"
          borderColor={line.checked ? 'green.solid' : 'border.emphasized'}
          bg={line.checked ? 'green.solid' : undefined}
          color="white"
          display="grid"
          placeItems="center"
        >
          {line.checked && <LuCheck size={12} strokeWidth={3} />}
        </Box>
      </IconButton>
      <Text
        flex="1"
        minW="0"
        truncate
        textDecoration={line.checked ? 'line-through' : undefined}
        color={line.checked ? 'fg.subtle' : undefined}
      >
        {line.label}
      </Text>
      {label && <LabelBadge label={label} />}
    </HStack>
  )
}

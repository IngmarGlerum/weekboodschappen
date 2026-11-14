import { Box, Button, Collapsible, Flex, HStack, Heading, IconButton, Input, Menu, Portal, Stack, Text } from '@chakra-ui/react'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Global } from '@emotion/react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { LuArrowUpDown, LuCheck, LuChevronDown, LuNotebookPen, LuPlus, LuStar, LuTags } from 'react-icons/lu'
import { useStoreItems, useStoreLabels } from '../../data/hooks'
import { useRepo } from '../../data/repo'
import { isOn, type StoreItemRow, type StoreLabelRow } from '../../data/rows'
import { arrangeList, positionAt, SORT_LABELS, type ListItem, type SortMode } from '../../domain/storeList'
import { describeError } from '../../lib/errors'
import { prefersReducedMotion, tick } from '../../lib/haptics'
import { notify } from '../toaster'
import { ItemDetail } from './ItemDetail'
import { LabelBadge, LabelIcon } from './LabelBadge'
import { LabelSelect } from './LabelSelect'
import { LabelsDialog } from './LabelsDialog'

const SORT_KEY = 'weekplanner.list.sort'
const FILTER_KEY = 'weekplanner.list.filter'

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writePref(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Zonder opslag vergeet het apparaat alleen de keuze.
  }
}

const toListItem = (r: StoreItemRow): ListItem => ({
  id: r.id,
  title: r.label,
  done: isOn(r.done),
  important: isOn(r.important),
  labelId: r.label_id,
  position: r.position,
  createdAt: r.created_at,
  completedAt: r.completed_at,
})

/**
 * De lijst, in de stijl van een to-do-app (requirement 7): één vaste lijst,
 * los van de week, met labels per winkel. Wordt gebruikt als eigen scherm en,
 * op een breed scherm, naast de week.
 */
export function StoreListPanel({ compact = false }: { compact?: boolean }) {
  const repo = useRepo()
  const items = useStoreItems()
  const labels = useStoreLabels()
  const [title, setTitle] = useState('')
  const [newLabel, setNewLabel] = useState<string | null>(null)
  const [sort, setSortState] = useState<SortMode>(() => (readPref(SORT_KEY) as SortMode) || 'manual')
  const [filter, setFilterState] = useState<string | null>(() => readPref(FILTER_KEY))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [labelsOpen, setLabelsOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const labelById = useMemo(() => new Map(labels.data.map((l) => [l.id, l])), [labels.data])
  const rowById = useMemo(() => new Map(items.data.map((r) => [r.id, r])), [items.data])
  // Een filter op een label dat niet meer bestaat telt niet.
  const activeFilter = filter && labelById.has(filter) ? filter : null
  const { open, done } = useMemo(
    () => arrangeList(items.data.map(toListItem), sort, labels.data, activeFilter),
    [items.data, sort, labels.data, activeFilter],
  )
  const canDrag = sort === 'manual'
  const selected = selectedId ? (rowById.get(selectedId) ?? null) : null

  function setSort(mode: SortMode) {
    setSortState(mode)
    writePref(SORT_KEY, mode)
  }
  function setFilter(labelId: string | null) {
    setFilterState(labelId)
    writePref(FILTER_KEY, labelId)
    setNewLabel(labelId)
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    const text = title.trim()
    if (!text) return
    // Meteen leegmaken, zodat je direct het volgende item kunt typen.
    tick()
    setTitle('')
    input.current?.focus()
    try {
      await repo.addStoreItem(text, newLabel ?? activeFilter)
    } catch (error) {
      setTitle((current) => current || text)
      notify.error('Toevoegen mislukt', describeError(error))
    }
  }

  async function toggle(item: ListItem) {
    await repo.setStoreItemDone(item.id, !item.done)
    if (!item.done) notify.undo(`${item.title} afgevinkt`, () => void repo.setStoreItemDone(item.id, false))
  }

  async function remove(item: ListItem) {
    if (selectedId === item.id) setSelectedId(null)
    await repo.removeStoreItem(item.id)
    notify.undo(`${item.title} verwijderd`, () => void repo.restoreStoreItems([item.id]))
  }

  async function clearDone() {
    const ids = await repo.clearDoneStoreItems()
    if (ids.length) notify.undo(`${ids.length} afgevinkte items gewist`, () => void repo.restoreStoreItems(ids))
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Op de telefoon: even vasthouden, dan slepen. Zo blijven scrollen en vegen werken.
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = open.findIndex((i) => i.id === active.id)
    const to = open.findIndex((i) => i.id === over.id)
    if (from < 0 || to < 0) return
    const rest = open.filter((i) => i.id !== active.id)
    void repo.moveStoreItem(String(active.id), positionAt(rest, to))
  }

  const empty = !items.isLoading && open.length === 0 && done.length === 0

  return (
    <Stack gap="3">
      <ListAnimations />
      <HStack justify="space-between" gap="2">
        <Heading size={compact ? 'md' : 'lg'}>Lijst</Heading>
        <HStack gap="1">
          <Menu.Root positioning={{ placement: 'bottom-end' }}>
            <Menu.Trigger asChild>
              <IconButton size="sm" variant="ghost" aria-label={`Sorteren: ${SORT_LABELS[sort]}`}>
                <LuArrowUpDown />
              </IconButton>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content>
                  <Menu.ItemGroup>
                    <Menu.ItemGroupLabel>Sorteren</Menu.ItemGroupLabel>
                    {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                      <Menu.Item key={mode} value={mode} onClick={() => setSort(mode)}>
                        <HStack flex="1" justify="space-between" gap="4">
                          <Text>{SORT_LABELS[mode]}</Text>
                          {sort === mode && <LuCheck />}
                        </HStack>
                      </Menu.Item>
                    ))}
                  </Menu.ItemGroup>
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
          <IconButton size="sm" variant="ghost" aria-label="Labels beheren" onClick={() => setLabelsOpen(true)}>
            <LuTags />
          </IconButton>
        </HStack>
      </HStack>

      {labels.data.length > 0 && (
        <HStack gap="1.5" overflowX="auto" pb="1" role="group" aria-label="Filter op label">
          <Button
            size="xs"
            rounded="full"
            variant={activeFilter === null ? 'solid' : 'outline'}
            colorPalette={activeFilter === null ? 'green' : undefined}
            aria-pressed={activeFilter === null}
            onClick={() => setFilter(null)}
          >
            Alles
          </Button>
          {labels.data.map((label) => {
            const on = activeFilter === label.id
            return (
              <Button
                key={label.id}
                size="xs"
                rounded="full"
                variant={on ? 'solid' : 'outline'}
                colorPalette={on ? label.color || 'gray' : undefined}
                aria-pressed={on}
                flexShrink={0}
                onClick={() => setFilter(on ? null : label.id)}
              >
                <LabelIcon label={label} size={14} /> {label.name}
              </Button>
            )
          })}
        </HStack>
      )}

      <form onSubmit={add}>
        <Flex gap="2">
          <Input
            ref={input}
            placeholder="Item toevoegen"
            aria-label="Item toevoegen"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            enterKeyHint="enter"
          />
          {labels.data.length > 0 && (
            <LabelSelect
              compact
              labels={labels.data}
              value={newLabel ?? activeFilter}
              onChange={setNewLabel}
              onManage={() => setLabelsOpen(true)}
            />
          )}
          <IconButton type="submit" colorPalette="green" aria-label="Toevoegen" disabled={!title.trim()}>
            <LuPlus />
          </IconButton>
        </Flex>
      </form>

      {empty && (
        <Text color="fg.muted" fontSize="sm">
          {activeFilter ? 'Geen items met dit label.' : 'De lijst is leeg. Typ hierboven wat je nodig hebt.'}
        </Text>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={open.map((i) => i.id)} strategy={verticalListSortingStrategy} disabled={!canDrag}>
          <Stack gap="1" as="ul" listStyleType="none" m="0" p="0">
            {open.map((item) => (
              <Row
                key={item.id}
                item={item}
                row={rowById.get(item.id)}
                label={item.labelId ? labelById.get(item.labelId) : undefined}
                draggable={canDrag}
                onToggle={() => void toggle(item)}
                onStar={() => void repo.updateStoreItem(item.id, { important: !item.important })}
                onOpen={() => setSelectedId(item.id)}
                onRemove={() => void remove(item)}
              />
            ))}
          </Stack>
        </SortableContext>
      </DndContext>

      {done.length > 0 && (
        <Collapsible.Root>
          <HStack justify="space-between">
            <Collapsible.Trigger asChild>
              <Button variant="ghost" size="sm" px="1">
                <LuChevronDown /> Voltooid ({done.length})
              </Button>
            </Collapsible.Trigger>
            <Button size="sm" variant="ghost" colorPalette="red" onClick={() => void clearDone()}>
              Alles wissen
            </Button>
          </HStack>
          <Collapsible.Content>
            <Stack gap="1" as="ul" listStyleType="none" m="0" p="0" pt="1">
              {done.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  row={rowById.get(item.id)}
                  label={item.labelId ? labelById.get(item.labelId) : undefined}
                  draggable={false}
                  onToggle={() => void toggle(item)}
                  onStar={() => void repo.updateStoreItem(item.id, { important: !item.important })}
                  onOpen={() => setSelectedId(item.id)}
                  onRemove={() => void remove(item)}
                />
              ))}
            </Stack>
          </Collapsible.Content>
        </Collapsible.Root>
      )}

      {selected && (
        <ItemDetail
          item={selected}
          labels={labels.data}
          onClose={() => setSelectedId(null)}
          onManageLabels={() => setLabelsOpen(true)}
        />
      )}
      <LabelsDialog open={labelsOpen} onClose={() => setLabelsOpen(false)} />
    </Stack>
  )
}

interface RowProps {
  item: ListItem
  row: StoreItemRow | undefined
  label: StoreLabelRow | undefined
  draggable: boolean
  onToggle: () => void
  onStar: () => void
  onOpen: () => void
  onRemove: () => void
}

const SWIPE_DELETE = 96

// Afvinken gaat in stappen, zoals in een to-do-app:
// 1. de cirkel vult zich met een groene spetter (tik),
// 2. de tekst wordt doorgestreept (tik),
// 3. het item verdwijnt naar Voltooid.
const T_STRIKE = 280
const T_LEAVE = 650
const T_DONE = 920

type Phase = 'idle' | 'burst' | 'strike' | 'leaving'

// Keyframes als gewone CSS (zie <ListAnimations />), op naam te gebruiken.
const pop = 'wp-list-pop'
const splash = 'wp-list-splash'
const draw = 'wp-list-draw'
const ANIMATION_CSS = `
  @keyframes ${pop} { 0% { transform: scale(0.6); } 55% { transform: scale(1.2); } 100% { transform: scale(1); } }
  @keyframes ${splash} {
    0% { transform: rotate(var(--a)) translateX(4px) scale(1); opacity: 1; }
    100% { transform: rotate(var(--a)) translateX(28px) scale(0.3); opacity: 0; }
  }
  @keyframes ${draw} { from { transform: scaleX(0); } to { transform: scaleX(1); } }
`
function ListAnimations() {
  return <Global styles={ANIMATION_CSS} />
}
const SPLASH_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

/** Eén regel: afvinkcirkel, naam met label en notitie-icoon, ster. Naar links vegen = verwijderen. */
function Row({ item, row, label, draggable, onToggle, onStar, onOpen, onRemove }: RowProps) {
  const sortable = useSortable({ id: item.id, disabled: !draggable })
  const [dx, setDx] = useState(0)
  const swipe = useRef<{ x: number; y: number; active: boolean } | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const timers = useRef<number[]>([])
  const [height, setHeight] = useState<number | null>(null)
  const node = useRef<HTMLElement | null>(null)

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  function cancelAnimation() {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setPhase('idle')
    setHeight(null)
  }

  function pressCircle() {
    // Weer openzetten, of nogmaals tikken tijdens de animatie: meteen, zonder show.
    if (item.done) {
      tick()
      onToggle()
      return
    }
    if (phase !== 'idle') {
      cancelAnimation()
      return
    }
    tick()
    if (prefersReducedMotion()) {
      onToggle()
      return
    }
    setPhase('burst')
    timers.current = [
      window.setTimeout(() => {
        setPhase('strike')
        tick()
      }, T_STRIKE),
      window.setTimeout(() => {
        setHeight(node.current?.offsetHeight ?? null)
        setPhase('leaving')
      }, T_LEAVE),
      window.setTimeout(() => {
        timers.current = []
        onToggle()
      }, T_DONE),
    ]
  }

  const checked = item.done || phase !== 'idle'
  const struck = item.done || phase === 'strike' || phase === 'leaving'

  function onPointerDown(e: ReactPointerEvent) {
    if (e.pointerType !== 'touch') return
    swipe.current = { x: e.clientX, y: e.clientY, active: false }
  }
  function onPointerMove(e: ReactPointerEvent) {
    const s = swipe.current
    if (!s || sortable.isDragging) return
    const mx = e.clientX - s.x
    const my = e.clientY - s.y
    if (!s.active) {
      if (Math.abs(my) > 10) {
        swipe.current = null
        return
      }
      if (mx < -12) s.active = true
    }
    if (s.active) setDx(Math.min(0, mx))
  }
  function onPointerEnd() {
    const wasActive = swipe.current?.active
    swipe.current = null
    if (wasActive && dx <= -SWIPE_DELETE) onRemove()
    setDx(0)
  }

  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  }

  return (
    <Box
      as="li"
      ref={(el: HTMLElement | null) => {
        sortable.setNodeRef(el)
        node.current = el
      }}
      style={style}
      position="relative"
      zIndex={sortable.isDragging ? 2 : undefined}
      rounded="md"
      overflow={phase === 'burst' || phase === 'strike' ? 'visible' : 'hidden'}
      // Laatste stap: het item klapt dicht en verdwijnt.
      maxH={phase === 'leaving' ? '0px' : height !== null ? `${height}px` : undefined}
      opacity={phase === 'leaving' ? 0 : 1}
      mt={phase === 'leaving' ? '-1' : undefined}
      transitionProperty="max-height, opacity, margin"
      transitionDuration="0.26s"
      transitionTimingFunction="ease-in"
      // Rood alleen tijdens het vegen, anders schemert het langs de randen.
      bg={dx ? 'red.solid' : undefined}
    >
      <Flex
        hidden={!dx}
        align="center"
        justify="flex-end"
        position="absolute"
        inset="0"
        pr="4"
        color="white"
        fontSize="sm"
        fontWeight="semibold"
        aria-hidden
      >
        Verwijderen
      </Flex>
      <Flex
        align="center"
        gap="2"
        bg="bg"
        borderWidth="1px"
        rounded="md"
        px="2"
        py="1.5"
        minH="48px"
        position="relative"
        transform={dx ? `translateX(${dx}px)` : undefined}
        transition={dx ? undefined : 'transform 0.2s'}
        boxShadow={sortable.isDragging ? 'lg' : undefined}
        cursor={draggable ? 'grab' : undefined}
        touchAction="pan-y"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        {...sortable.attributes}
        {...sortable.listeners}
        role={undefined}
        tabIndex={-1}
      >
        <IconButton
          size="sm"
          variant="ghost"
          rounded="full"
          aria-label={item.done ? `${item.title} weer openzetten` : `${item.title} afvinken`}
          aria-pressed={checked}
          overflow="visible"
          onClick={pressCircle}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Box position="relative" boxSize="20px">
            {phase !== 'idle' &&
              SPLASH_ANGLES.map((angle) => (
                <Box
                  key={angle}
                  aria-hidden
                  position="absolute"
                  top="50%"
                  left="50%"
                  boxSize="6px"
                  mt="-3px"
                  ml="-3px"
                  rounded="full"
                  bg="green.solid"
                  pointerEvents="none"
                  style={{ ['--a' as string]: `${angle}deg` }}
                  css={{ animation: `${splash} 0.5s ease-out forwards`, transformOrigin: 'center' }}
                />
              ))}
            <Box
              boxSize="20px"
              rounded="full"
              borderWidth="2px"
              borderColor={checked ? 'green.solid' : 'border.emphasized'}
              bg={checked ? 'green.solid' : undefined}
              color="white"
              display="grid"
              placeItems="center"
              transition="background-color 0.15s, border-color 0.15s"
              css={phase === 'burst' ? { animation: `${pop} 0.28s ease-out` } : undefined}
            >
              {checked && <LuCheck size={12} strokeWidth={3} />}
            </Box>
          </Box>
        </IconButton>

        <Box
          as="button"
          flex="1"
          minW="0"
          textAlign="left"
          py="1"
          onClick={onOpen}
          aria-label={`Details van ${item.title}`}
        >
          {/* De doorhaling wordt getekend, van links naar rechts. */}
          <Box position="relative" display="inline-block" maxW="full" verticalAlign="top">
            <Text truncate color={struck ? 'fg.subtle' : undefined} transition="color 0.2s">
              {item.title}
            </Text>
            {struck && (
              <Box
                aria-hidden
                position="absolute"
                left="0"
                right="0"
                top="52%"
                h="1.5px"
                bg="fg.subtle"
                transformOrigin="left"
                pointerEvents="none"
                css={phase === 'strike' ? { animation: `${draw} 0.25s ease-out forwards` } : undefined}
              />
            )}
          </Box>
          {(label || row?.note) && (
            <HStack gap="1.5" mt="0.5" minW="0">
              {label && <LabelBadge label={label} />}
              {row?.note && (
                <HStack gap="1" color="fg.muted" minW="0">
                  <LuNotebookPen size={12} />
                  <Text fontSize="xs" truncate>
                    {row.note}
                  </Text>
                </HStack>
              )}
            </HStack>
          )}
        </Box>

        <IconButton
          size="sm"
          variant="ghost"
          aria-label={item.important ? `${item.title}: niet meer belangrijk` : `${item.title}: markeer als belangrijk`}
          aria-pressed={item.important}
          color={item.important ? 'yellow.500' : 'fg.subtle'}
          onClick={onStar}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <LuStar fill={item.important ? 'currentColor' : 'none'} />
        </IconButton>
      </Flex>
    </Box>
  )
}

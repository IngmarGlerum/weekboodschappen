import { Button, CloseButton, Drawer, Field, HStack, IconButton, Input, Portal, Stack, Text, Textarea, useBreakpointValue } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { LuStar, LuTrash2 } from 'react-icons/lu'
import { useRepo } from '../../data/repo'
import { isOn, type StoreItemRow, type StoreLabelRow } from '../../data/rows'
import { notify } from '../toaster'
import { LabelSelect } from './LabelSelect'

interface Props {
  item: StoreItemRow | null
  labels: StoreLabelRow[]
  onClose: () => void
  onManageLabels: () => void
}

function formatAdded(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
}

/**
 * Details van één item: naam, label, notitie, ster en verwijderen.
 * Op een breed scherm rechts, op de telefoon van onderaf. Wijzigingen worden
 * meteen opgeslagen (bij het verlaten van een veld).
 */
export function ItemDetail({ item, labels, onClose, onManageLabels }: Props) {
  const repo = useRepo()
  const placement = useBreakpointValue<'bottom' | 'end'>({ base: 'bottom', md: 'end' }) ?? 'bottom'
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    setTitle(item?.label ?? '')
    setNote(item?.note ?? '')
  }, [item?.id, item?.label, item?.note])

  if (!item) return null
  const important = isOn(item.important)

  function saveTitle() {
    if (!item) return
    const next = title.trim()
    if (next && next !== item.label) void repo.updateStoreItem(item.id, { label: next })
    else setTitle(item.label)
  }

  function saveNote() {
    if (!item) return
    if ((note.trim() || null) !== (item.note || null)) void repo.updateStoreItem(item.id, { note })
  }

  async function remove() {
    if (!item) return
    const { id, label } = item
    onClose()
    await repo.removeStoreItem(id)
    notify.undo(`${label} verwijderd`, () => void repo.restoreStoreItems([id]))
  }

  return (
    <Drawer.Root
      open
      placement={placement}
      size={placement === 'end' ? 'sm' : undefined}
      onOpenChange={(e) => {
        if (!e.open) {
          saveTitle()
          saveNote()
          onClose()
        }
      }}
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content roundedTop={placement === 'bottom' ? 'l3' : undefined} pb="env(safe-area-inset-bottom)">
            <Drawer.Header>
              <Drawer.Title>Item</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>
              <Stack gap="4">
                <HStack gap="2" align="flex-end">
                  <Field.Root flex="1">
                    <Field.Label>Naam</Field.Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={saveTitle}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      }}
                    />
                  </Field.Root>
                  <IconButton
                    variant="ghost"
                    aria-label={important ? 'Niet meer belangrijk' : 'Markeer als belangrijk'}
                    aria-pressed={important}
                    color={important ? 'yellow.500' : 'fg.muted'}
                    onClick={() => void repo.updateStoreItem(item.id, { important: !important })}
                  >
                    <LuStar fill={important ? 'currentColor' : 'none'} />
                  </IconButton>
                </HStack>

                <Field.Root>
                  <Field.Label>Label</Field.Label>
                  <LabelSelect
                    labels={labels}
                    value={item.label_id}
                    onChange={(labelId) => void repo.updateStoreItem(item.id, { labelId })}
                    onManage={onManageLabels}
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label>Notitie</Field.Label>
                  <Textarea
                    placeholder="Bijvoorbeeld: de grote verpakking"
                    rows={3}
                    maxLength={2000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onBlur={saveNote}
                  />
                </Field.Root>

                {item.created_at && (
                  <Text color="fg.muted" fontSize="sm">
                    Toegevoegd op {formatAdded(item.created_at)}
                  </Text>
                )}
              </Stack>
            </Drawer.Body>
            <Drawer.Footer justifyContent="space-between">
              <Button variant="ghost" colorPalette="red" onClick={() => void remove()}>
                <LuTrash2 /> Verwijderen
              </Button>
              <Drawer.ActionTrigger asChild>
                <Button variant="outline">Klaar</Button>
              </Drawer.ActionTrigger>
            </Drawer.Footer>
            <Drawer.CloseTrigger asChild>
              <CloseButton size="sm" aria-label="Sluiten" />
            </Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}

import { Box, Button, Field, HStack, IconButton, Input, Stack, Text } from '@chakra-ui/react'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { LuImage, LuPencil, LuTrash2, LuX } from 'react-icons/lu'
import { useStoreLabels } from '../../data/hooks'
import { useRepo } from '../../data/repo'
import type { StoreLabelRow } from '../../data/rows'
import { fileToAvatar } from '../../lib/avatar'
import { describeError } from '../../lib/errors'
import { AppDialog } from '../ConfirmDialog'
import { notify } from '../toaster'
import { LABEL_COLORS, LabelBadge, LabelIcon } from './LabelBadge'

const SUGGESTED = ['🛒', '🧴', '💊', '🥖', '🥩', '🐟', '🧀', '🍷', '🌿', '🏠', '🐾', '👶']

interface Draft {
  id: string | null
  name: string
  icon: string | null
  color: string
}

const empty: Draft = { id: null, name: '', icon: '🛒', color: 'green' }

/** Labels maken, wijzigen en verwijderen: een naam, een icoon (emoji of plaatje) en een kleur. */
export function LabelsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const repo = useRepo()
  const labels = useStoreLabels()
  const [draft, setDraft] = useState<Draft>(empty)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  function edit(label: StoreLabelRow) {
    setDraft({ id: label.id, name: label.name, icon: label.icon, color: label.color || 'gray' })
  }

  async function pickImage(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const icon = await fileToAvatar(f, 64)
      setDraft((d) => ({ ...d, icon }))
    } catch (error) {
      notify.error('Plaatje gebruiken mislukt', describeError(error))
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!draft.name.trim()) return
    setBusy(true)
    try {
      const input = { name: draft.name, icon: draft.icon?.trim() || null, color: draft.color }
      if (draft.id) await repo.updateStoreLabel(draft.id, input)
      else await repo.addStoreLabel(input)
      setDraft(empty)
    } catch (error) {
      notify.error('Opslaan mislukt', describeError(error))
    } finally {
      setBusy(false)
    }
  }

  async function remove(label: StoreLabelRow) {
    await repo.removeStoreLabel(label.id)
    if (draft.id === label.id) setDraft(empty)
    notify.success(`Label ${label.name} verwijderd; de items staan er nog`)
  }

  const isImage = draft.icon?.startsWith('data:image/')

  return (
    <AppDialog
      open={open}
      onClose={() => {
        setDraft(empty)
        onClose()
      }}
      title="Labels"
      footer={
        <Button variant="outline" onClick={onClose}>
          Klaar
        </Button>
      }
    >
      <Stack gap="5">
        {labels.data.length > 0 && (
          <Stack gap="1">
            {labels.data.map((label) => (
              <HStack key={label.id} justify="space-between" gap="2">
                <LabelBadge label={label} size="md" />
                <HStack gap="0">
                  <IconButton size="sm" variant="ghost" aria-label={`Wijzig ${label.name}`} onClick={() => edit(label)}>
                    <LuPencil />
                  </IconButton>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    colorPalette="red"
                    aria-label={`Verwijder ${label.name}`}
                    onClick={() => void remove(label)}
                  >
                    <LuTrash2 />
                  </IconButton>
                </HStack>
              </HStack>
            ))}
          </Stack>
        )}

        <Stack gap="3" as="form" onSubmit={save} borderTopWidth={labels.data.length ? '1px' : '0'} pt="3">
          <Text fontWeight="semibold">{draft.id ? 'Label wijzigen' : 'Nieuw label'}</Text>
          <Field.Root required>
            <Field.Label>Naam</Field.Label>
            <Input
              placeholder="Bijvoorbeeld Jumbo"
              maxLength={40}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </Field.Root>

          <Field.Root>
            <Field.Label>Icoon</Field.Label>
            <HStack gap="2" w="full">
              <Box boxSize="40px" borderWidth="1px" rounded="md" display="grid" placeItems="center" flexShrink={0}>
                <LabelIcon label={{ icon: draft.icon, name: draft.name }} size={24} />
              </Box>
              {isImage ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => setDraft((d) => ({ ...d, icon: '🛒' }))}>
                  <LuX /> Plaatje weghalen
                </Button>
              ) : (
                <Input
                  aria-label="Emoji"
                  placeholder="Emoji"
                  maxLength={8}
                  w="88px"
                  value={draft.icon ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
                />
              )}
              <input ref={file} type="file" accept="image/*" hidden onChange={pickImage} />
              <Button type="button" size="sm" variant="outline" onClick={() => file.current?.click()}>
                <LuImage /> Plaatje
              </Button>
            </HStack>
            <HStack gap="1" flexWrap="wrap" pt="1">
              {SUGGESTED.map((emoji) => (
                <Button
                  key={emoji}
                  type="button"
                  size="xs"
                  variant={draft.icon === emoji ? 'subtle' : 'ghost'}
                  aria-label={`Icoon ${emoji}`}
                  onClick={() => setDraft((d) => ({ ...d, icon: emoji }))}
                >
                  {emoji}
                </Button>
              ))}
            </HStack>
            <Field.HelperText>Een emoji, of een plaatje zoals het logo van de winkel.</Field.HelperText>
          </Field.Root>

          <Field.Root>
            <Field.Label>Kleur</Field.Label>
            <HStack gap="1.5" flexWrap="wrap" role="radiogroup" aria-label="Kleur">
              {LABEL_COLORS.map((color) => (
                <Box
                  key={color}
                  asChild
                  boxSize="28px"
                  rounded="full"
                  bg={`${color}.solid`}
                  outline={draft.color === color ? '3px solid' : 'none'}
                  outlineColor="fg"
                  outlineOffset="2px"
                  cursor="pointer"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={draft.color === color}
                    aria-label={color}
                    onClick={() => setDraft((d) => ({ ...d, color }))}
                  />
                </Box>
              ))}
            </HStack>
          </Field.Root>

          <HStack>
            <Button type="submit" colorPalette="green" loading={busy} disabled={!draft.name.trim()}>
              {draft.id ? 'Opslaan' : 'Label maken'}
            </Button>
            {draft.id && (
              <Button type="button" variant="ghost" onClick={() => setDraft(empty)}>
                Annuleren
              </Button>
            )}
          </HStack>
        </Stack>
      </Stack>
    </AppDialog>
  )
}

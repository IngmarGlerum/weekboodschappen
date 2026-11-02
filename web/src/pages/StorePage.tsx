import { Box, Button, Checkbox, Collapsible, Field, Flex, HStack, Heading, IconButton, Input, Stack, Text } from '@chakra-ui/react'
import { useState, type FormEvent } from 'react'
import { LuChevronDown, LuTrash2 } from 'react-icons/lu'
import { notify } from '../components/toaster'
import { useStoreItems } from '../data/hooks'
import { isOn, type StoreItemRow } from '../data/rows'
import { useRepo } from '../data/repo'
import { describeError } from '../lib/errors'

/** Requirement 7: een eigen lijst voor de andere supermarkt (vervangt Microsoft To Do). */
export default function StorePage() {
  const repo = useRepo()
  const items = useStoreItems()
  const [label, setLabel] = useState('')

  const open = items.data.filter((i) => !isOn(i.done))
  const done = items.data.filter((i) => isOn(i.done))

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    try {
      await repo.addStoreItem(label)
      setLabel('')
    } catch (error) {
      notify.error('Toevoegen mislukt', describeError(error))
    }
  }

  return (
    <Stack gap="4">
      <Box>
        <Heading size="lg">Winkellijst</Heading>
        <Text color="fg.muted" fontSize="sm">
          Voor boodschappen bij een andere supermarkt dan Picnic.
        </Text>
      </Box>

      <form onSubmit={add}>
        <Field.Root>
          <Field.Label>Nieuw item</Field.Label>
          <Flex gap="2" w="full">
            <Input placeholder="Bijvoorbeeld verse kruiden" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Button type="submit" colorPalette="green" disabled={!label.trim()}>
              Toevoegen
            </Button>
          </Flex>
        </Field.Root>
      </form>

      {items.data.length === 0 && !items.isLoading && <Text color="fg.muted">De lijst is leeg.</Text>}

      <Stack gap="1" as="ul" listStyleType="none" m="0" p="0">
        {open.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </Stack>

      {done.length > 0 && (
        <Collapsible.Root>
          <HStack justify="space-between">
            <Collapsible.Trigger asChild>
              <Button variant="ghost" size="sm">
                Afgevinkt ({done.length}) <LuChevronDown />
              </Button>
            </Collapsible.Trigger>
            <Button size="sm" variant="ghost" colorPalette="red" onClick={() => repo.clearDoneStoreItems()}>
              Ruim afgevinkte items op
            </Button>
          </HStack>
          <Collapsible.Content>
            <Stack gap="1" as="ul" listStyleType="none" m="0" p="0" pt="2">
              {done.map((item) => (
                <Row key={item.id} item={item} />
              ))}
            </Stack>
          </Collapsible.Content>
        </Collapsible.Root>
      )}
    </Stack>
  )
}

function Row({ item }: { item: StoreItemRow }) {
  const repo = useRepo()
  const done = isOn(item.done)
  return (
    <Flex as="li" align="center" justify="space-between" gap="2" borderWidth="1px" rounded="md" bg="bg" px="3" py="2">
      <Checkbox.Root
        colorPalette="green"
        flex="1"
        checked={done}
        onCheckedChange={(e) => repo.setStoreItemDone(item.id, e.checked === true)}
      >
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label textDecoration={done ? 'line-through' : undefined} color={done ? 'fg.subtle' : undefined}>
          {item.label}
        </Checkbox.Label>
      </Checkbox.Root>
      <IconButton
        size="sm"
        variant="ghost"
        colorPalette="red"
        aria-label={`Verwijder ${item.label}`}
        onClick={() => repo.removeStoreItem(item.id)}
      >
        <LuTrash2 />
      </IconButton>
    </Flex>
  )
}

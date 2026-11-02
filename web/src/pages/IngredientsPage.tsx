import { Button, Card, Field, Flex, HStack, Heading, IconButton, Input, Stack, Switch, Text } from '@chakra-ui/react'
import { useState, type FormEvent } from 'react'
import { LuArrowLeft, LuTrash2 } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { notify } from '../components/toaster'
import { useIngredients } from '../data/hooks'
import { isOn, type IngredientRow } from '../data/rows'
import { useRepo } from '../data/repo'
import { describeError } from '../lib/errors'

export default function IngredientsPage() {
  const repo = useRepo()
  const navigate = useNavigate()
  const ingredients = useIngredients()
  const [name, setName] = useState('')
  const [toDelete, setToDelete] = useState<IngredientRow | null>(null)

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await repo.addIngredient({ name })
      setName('')
    } catch (error) {
      notify.error('Toevoegen mislukt', describeError(error))
    }
  }

  async function askDelete(ingredient: IngredientRow) {
    const used = await repo.ingredientUsage(ingredient.id)
    if (used > 0) {
      notify.error(`"${ingredient.name}" wordt nog gebruikt`, `Het zit in ${used} ${used === 1 ? 'gerecht' : 'gerechten'}. Haal het daar eerst weg.`)
      return
    }
    setToDelete(ingredient)
  }

  return (
    <Stack gap="4">
      <HStack>
        <IconButton variant="ghost" aria-label="Terug" onClick={() => navigate('/meer')}>
          <LuArrowLeft />
        </IconButton>
        <Heading size="lg">Ingrediënten</Heading>
      </HStack>

      <Text color="fg.muted">
        Dit is jullie eigen lijst. Kies hieruit bij het maken van een gerecht, zodat "ui" en "uien" nooit
        twee verschillende dingen worden. Huisvoorraad komt niet automatisch op de boodschappenlijst.
      </Text>

      <form onSubmit={add}>
        <Field.Root>
          <Field.Label>Nieuw ingrediënt</Field.Label>
          <Flex gap="2" w="full">
            <Input placeholder="Bijvoorbeeld uien" value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" colorPalette="green" disabled={!name.trim()}>
              Toevoegen
            </Button>
          </Flex>
        </Field.Root>
      </form>

      <Stack gap="2">
        {ingredients.data.map((ingredient) => (
          <Card.Root key={ingredient.id} variant="outline">
            <Card.Body p="3">
              <Flex align="center" justify="space-between" gap="3">
                <Text fontWeight="medium" truncate>
                  {ingredient.name}
                </Text>
                <HStack gap="3">
                  <Switch.Root
                    size="sm"
                    colorPalette="green"
                    checked={isOn(ingredient.is_pantry)}
                    onCheckedChange={(e) => repo.setIngredientPantry(ingredient.id, e.checked)}
                  >
                    <Switch.HiddenInput />
                    <Switch.Control />
                    <Switch.Label>Huisvoorraad</Switch.Label>
                  </Switch.Root>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    colorPalette="red"
                    aria-label={`Verwijder ${ingredient.name}`}
                    onClick={() => askDelete(ingredient)}
                  >
                    <LuTrash2 />
                  </IconButton>
                </HStack>
              </Flex>
            </Card.Body>
          </Card.Root>
        ))}
        {ingredients.data.length === 0 && !ingredients.isLoading && (
          <Text color="fg.muted">Nog geen ingrediënten.</Text>
        )}
      </Stack>

      <ConfirmDialog
        open={toDelete !== null}
        title="Ingrediënt verwijderen?"
        message={toDelete ? `"${toDelete.name}" wordt uit de lijst gehaald.` : ''}
        confirmLabel="Verwijderen"
        destructive
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          const target = toDelete
          setToDelete(null)
          if (target) await repo.removeIngredient(target.id)
        }}
      />
    </Stack>
  )
}

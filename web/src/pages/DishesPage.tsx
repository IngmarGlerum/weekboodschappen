import { Button, Card, Flex, Heading, Input, Stack, Text } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { LuPlus } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { useDishes, useDishIngredients, useIngredients } from '../data/hooks'
import { normalizeName } from '../domain/shoppingList'

export default function DishesPage() {
  const navigate = useNavigate()
  const dishes = useDishes()
  const lines = useDishIngredients()
  const ingredients = useIngredients()
  const [search, setSearch] = useState('')

  const summary = useMemo(() => {
    const nameOf = new Map(ingredients.data.map((i) => [i.id, i.name]))
    const byDish = new Map<string, string[]>()
    for (const line of lines.data) {
      const list = byDish.get(line.dish_id) ?? []
      list.push(nameOf.get(line.ingredient_id) ?? '?')
      byDish.set(line.dish_id, list)
    }
    return byDish
  }, [lines.data, ingredients.data])

  const shown = dishes.data.filter((d) => normalizeName(d.name).includes(normalizeName(search)))

  return (
    <Stack gap="4">
      <Flex justify="space-between" align="center">
        <Heading size="lg">Gerechten</Heading>
        <Button colorPalette="green" onClick={() => navigate('/gerechten/nieuw')}>
          <LuPlus /> Nieuw gerecht
        </Button>
      </Flex>

      {dishes.data.length > 0 && (
        <Input placeholder="Zoek een gerecht" aria-label="Zoek een gerecht" value={search} onChange={(e) => setSearch(e.target.value)} />
      )}

      {dishes.data.length === 0 && !dishes.isLoading && (
        <Text color="fg.muted">
          Nog geen gerechten. Een gerecht is een vaste set ingrediënten die je elke week opnieuw kunt gebruiken.
        </Text>
      )}

      <Stack gap="2">
        {shown.map((dish) => (
          <Card.Root key={dish.id} variant="outline" asChild>
            <button type="button" onClick={() => navigate(`/gerechten/${dish.id}`)} style={{ textAlign: 'left' }}>
              <Card.Body p="3">
                <Text fontWeight="semibold">{dish.name}</Text>
                <Text color="fg.muted" fontSize="sm" truncate>
                  {(summary.get(dish.id) ?? []).join(', ') || 'Geen ingrediënten'}
                </Text>
              </Card.Body>
            </button>
          </Card.Root>
        ))}
      </Stack>
    </Stack>
  )
}

import { Button, Input, Stack, Text } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDishes } from '../data/hooks'
import { normalizeName } from '../domain/shoppingList'
import { AppDialog } from './ConfirmDialog'

interface Props {
  open: boolean
  title: string
  /** Het gerecht dat nu gekozen is, om te tonen en te kunnen leegmaken. */
  currentDishId?: string | null
  onPick: (dishId: string | null) => void
  onClose: () => void
}

/** Kies een gerecht uit de lijst, of maak de plek leeg. */
export function DishPickerDialog({ open, title, currentDishId, onPick, onClose }: Props) {
  const dishes = useDishes()
  const [search, setSearch] = useState('')

  const shown = useMemo(() => {
    const needle = normalizeName(search)
    return dishes.data.filter((d) => normalizeName(d.name).includes(needle))
  }, [dishes.data, search])

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        currentDishId ? (
          <Button variant="outline" colorPalette="red" onClick={() => onPick(null)}>
            Geen gerecht
          </Button>
        ) : undefined
      }
    >
      <Stack gap="3">
        {dishes.data.length === 0 ? (
          <Text color="fg.muted">
            Er zijn nog geen gerechten.{' '}
            <Link to="/gerechten/nieuw" style={{ textDecoration: 'underline' }}>
              Maak je eerste gerecht
            </Link>
            .
          </Text>
        ) : (
          <>
            <Input
              placeholder="Zoek een gerecht"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Zoek een gerecht"
            />
            <Stack gap="1">
              {shown.map((dish) => (
                <Button
                  key={dish.id}
                  justifyContent="flex-start"
                  variant={dish.id === currentDishId ? 'subtle' : 'ghost'}
                  colorPalette={dish.id === currentDishId ? 'green' : 'gray'}
                  onClick={() => onPick(dish.id)}
                >
                  {dish.name}
                </Button>
              ))}
              {shown.length === 0 && <Text color="fg.muted">Geen gerecht gevonden.</Text>}
            </Stack>
          </>
        )}
      </Stack>
    </AppDialog>
  )
}

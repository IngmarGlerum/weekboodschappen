import { Button, Card, Flex, HStack, Heading, IconButton, Stack, Text } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { LuArrowLeft, LuPlus } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { ApplyWeekmenuDialog } from '../components/ApplyWeekmenuDialog'
import { useWeek } from '../components/AppShell'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NewWeekmenuDialog } from '../components/NewWeekmenuDialog'
import { useAllDishes, useWeekmenuDays, useWeekmenus } from '../data/hooks'
import { useRepo } from '../data/repo'

/** Bladeren door eerder opgeslagen weekmenu's (requirement 12). */
export default function WeekmenusPage() {
  const navigate = useNavigate()
  const repo = useRepo()
  const { weekStart } = useWeek()
  const menus = useWeekmenus()
  const days = useWeekmenuDays()
  const dishes = useAllDishes()
  const [newOpen, setNewOpen] = useState(false)
  const [applying, setApplying] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null)

  const preview = useMemo(() => {
    const dishName = new Map(dishes.data.map((d) => [d.id, d]))
    const byMenu = new Map<string, string[]>()
    for (const day of days.data) {
      if (!day.dish_id) continue
      const dish = dishName.get(day.dish_id)
      if (!dish || dish.deleted_at) continue
      byMenu.set(day.weekmenu_id, [...(byMenu.get(day.weekmenu_id) ?? []), dish.name])
    }
    return byMenu
  }, [days.data, dishes.data])

  return (
    <Stack gap="4">
      <HStack justify="space-between">
        <HStack>
          <IconButton variant="ghost" aria-label="Terug" onClick={() => navigate('/meer')}>
            <LuArrowLeft />
          </IconButton>
          <Heading size="lg">Weekmenu's</Heading>
        </HStack>
        <Button colorPalette="green" onClick={() => setNewOpen(true)}>
          <LuPlus /> Nieuw
        </Button>
      </HStack>

      {menus.data.length === 0 && !menus.isLoading && (
        <Text color="fg.muted">
          Nog geen weekmenu's. Vul een week in en kies "Opslaan als weekmenu", of maak hierboven een nieuw weekmenu.
        </Text>
      )}

      <Stack gap="2">
        {menus.data.map((menu) => {
          const names = preview.get(menu.id) ?? []
          return (
            <Card.Root key={menu.id} variant="outline">
              <Card.Body p="3">
                <Flex justify="space-between" align="center" gap="3" wrap="wrap">
                  <Stack gap="0" minW="0" flex="1">
                    <Text fontWeight="semibold">{menu.name}</Text>
                    <Text color="fg.muted" fontSize="sm" truncate>
                      {names.length > 0 ? names.join(', ') : 'Nog geen gerechten'}
                    </Text>
                  </Stack>
                  <HStack gap="1">
                    <Button size="sm" colorPalette="green" onClick={() => setApplying(menu)}>
                      Gebruik in week
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/weekmenus/${menu.id}`)}>
                      Bewerk
                    </Button>
                    <Button size="sm" variant="ghost" colorPalette="red" onClick={() => setDeleting(menu)}>
                      Verwijder
                    </Button>
                  </HStack>
                </Flex>
              </Card.Body>
            </Card.Root>
          )
        })}
      </Stack>

      <NewWeekmenuDialog open={newOpen} onClose={() => setNewOpen(false)} />
      <ApplyWeekmenuDialog open={applying !== null} menu={applying} weekStart={weekStart} onClose={() => setApplying(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title="Weekmenu verwijderen?"
        message={deleting ? `"${deleting.name}" wordt verwijderd. De gerechten zelf blijven bestaan.` : ''}
        confirmLabel="Verwijderen"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          const target = deleting
          setDeleting(null)
          if (target) await repo.removeWeekmenu(target.id)
        }}
      />
    </Stack>
  )
}

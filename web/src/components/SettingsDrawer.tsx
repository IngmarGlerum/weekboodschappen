import { Box, Button, CloseButton, Collapsible, Drawer, HStack, Portal, Separator, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuApple, LuBookmark, LuCheck, LuChevronDown, LuLogOut, LuPlus, LuSettings } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useHousehold } from '../auth/HouseholdProvider'
import { HouseholdAvatar } from './HouseholdAvatar'
import { NewHouseholdDialog } from './NewHouseholdDialog'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * De zijbalk met instellingen. Bovenaan kies je de planning waar je mee werkt;
 * de gekozen planning staat ook bovenaan elk scherm.
 */
export function SettingsDrawer({ open, onClose }: Props) {
  const { mode, user, signOut } = useAuth()
  const { household, households, selectHousehold } = useHousehold()
  const navigate = useNavigate()
  const [listOpen, setListOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const online = mode === 'online'

  function go(to: string) {
    onClose()
    navigate(to)
  }

  function pick(id: string) {
    selectHousehold(id)
    setListOpen(false)
    onClose()
    navigate('/')
  }

  return (
    <>
      <Drawer.Root
        open={open}
        placement="start"
        size="xs"
        onOpenChange={(e) => {
          if (!e.open) {
            setListOpen(false)
            onClose()
          }
        }}
      >
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content pt="env(safe-area-inset-top)" pb="env(safe-area-inset-bottom)">
              <Drawer.Header>
                <Drawer.Title>Instellingen</Drawer.Title>
              </Drawer.Header>
              <Drawer.Body px="3">
                <Stack gap="5">
                  <Stack gap="2">
                    <Text px="1" fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase">
                      Planningen
                    </Text>
                    <Collapsible.Root open={listOpen} onOpenChange={(e) => setListOpen(e.open)} disabled={!online}>
                      <Collapsible.Trigger asChild>
                        <Button variant="outline" w="full" h="auto" py="2" px="2" justifyContent="flex-start" gap="3">
                          {household && <HouseholdAvatar household={household} />}
                          <Text flex="1" textAlign="left" truncate fontWeight="semibold">
                            {household?.name ?? 'Geen planning'}
                          </Text>
                          {online && (
                            <Box transform={listOpen ? 'rotate(180deg)' : undefined} transition="transform 0.2s">
                              <LuChevronDown />
                            </Box>
                          )}
                        </Button>
                      </Collapsible.Trigger>
                      <Collapsible.Content>
                        <Stack gap="1" pt="2" role="listbox" aria-label="Kies een planning">
                          {households.map((h) => {
                            const active = h.id === household?.id
                            return (
                              <Button
                                key={h.id}
                                role="option"
                                aria-selected={active}
                                variant={active ? 'subtle' : 'ghost'}
                                colorPalette={active ? 'green' : undefined}
                                w="full"
                                h="auto"
                                py="2"
                                px="2"
                                justifyContent="flex-start"
                                gap="3"
                                onClick={() => pick(h.id)}
                              >
                                <HouseholdAvatar household={h} size="xs" />
                                <Text flex="1" textAlign="left" truncate>
                                  {h.name}
                                </Text>
                                {active && <LuCheck />}
                              </Button>
                            )
                          })}
                          <Button
                            variant="ghost"
                            w="full"
                            justifyContent="flex-start"
                            gap="3"
                            px="2"
                            color="green.600"
                            onClick={() => setNewOpen(true)}
                          >
                            <LuPlus /> Nieuwe planning
                          </Button>
                        </Stack>
                      </Collapsible.Content>
                    </Collapsible.Root>
                    {online && (
                      <Button variant="ghost" justifyContent="flex-start" gap="3" px="2" onClick={() => go('/planning')}>
                        <LuSettings /> Naam, foto en leden
                      </Button>
                    )}
                  </Stack>

                  <Separator />

                  <Stack gap="1">
                    <Button variant="ghost" justifyContent="flex-start" gap="3" px="2" onClick={() => go('/weekmenus')}>
                      <LuBookmark /> Weekmenu's
                    </Button>
                    <Button variant="ghost" justifyContent="flex-start" gap="3" px="2" onClick={() => go('/ingredienten')}>
                      <LuApple /> Ingrediënten
                    </Button>
                  </Stack>
                </Stack>
              </Drawer.Body>
              <Drawer.Footer flexDirection="column" alignItems="stretch" gap="2">
                <Text color="fg.muted" fontSize="sm" truncate>
                  {online ? `Ingelogd als ${user?.email ?? ''}` : 'Alleen op dit apparaat'}
                </Text>
                {online && (
                  <HStack>
                    <Button variant="outline" size="sm" onClick={() => void signOut()}>
                      <LuLogOut /> Uitloggen
                    </Button>
                  </HStack>
                )}
              </Drawer.Footer>
              <Drawer.CloseTrigger asChild>
                <CloseButton size="sm" aria-label="Sluiten" />
              </Drawer.CloseTrigger>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
      <NewHouseholdDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={() => {
          setListOpen(false)
          onClose()
        }}
      />
    </>
  )
}

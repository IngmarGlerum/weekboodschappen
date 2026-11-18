import { Button, HStack, Menu, Portal, Text } from '@chakra-ui/react'
import { LuCheck, LuTag } from 'react-icons/lu'
import { LIST_WITHOUT_LABEL } from '../../data/repo'
import type { StoreLabelRow } from '../../data/rows'
import { LabelBadge, LabelIcon, PicnicBadge } from './LabelBadge'

interface Props {
  labels: StoreLabelRow[]
  value: string | null
  onChange: (labelId: string | null) => void
  onManage?: () => void
  /** Alleen het icoon tonen (naast het invoerveld). */
  compact?: boolean
  /**
   * Wat "geen label" betekent op deze plek:
   * - 'none': gewoon geen label (op de Lijst);
   * - 'picnic': Picnic (ingrediënten, vaste boodschappen, weekmenu-items).
   */
  empty?: 'none' | 'picnic'
  /** Ook de keuze "Lijst, zonder winkel" tonen (bij weekmenu-items). */
  withListOption?: boolean
}

/** Een label (winkel) kiezen. */
export function LabelSelect({ labels, value, onChange, onManage, compact, empty = 'none', withListOption }: Props) {
  const current = labels.find((l) => l.id === value) ?? null
  const isList = value === LIST_WITHOUT_LABEL
  const isEmpty = !current && !isList

  let shown
  if (current) shown = compact ? <LabelIcon label={current} size={20} /> : <LabelBadge label={current} />
  else if (isList) shown = <Text as="span">Lijst</Text>
  else if (empty === 'picnic') shown = <PicnicBadge />
  else
    shown = (
      <>
        <LuTag />
        {!compact && 'Label'}
      </>
    )

  return (
    <Menu.Root positioning={{ placement: 'bottom-end' }}>
      <Menu.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          size={compact ? 'md' : 'sm'}
          px={compact ? '2.5' : undefined}
          aria-label="Winkel kiezen"
          flexShrink={0}
        >
          {shown}
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="210px">
            <Menu.Item value="" onClick={() => onChange(null)}>
              <HStack flex="1" justify="space-between">
                {empty === 'picnic' ? <PicnicBadge /> : <Text>Geen label</Text>}
                {isEmpty && <LuCheck />}
              </HStack>
            </Menu.Item>
            {withListOption && (
              <Menu.Item value={LIST_WITHOUT_LABEL} onClick={() => onChange(LIST_WITHOUT_LABEL)}>
                <HStack flex="1" justify="space-between">
                  <Text>Lijst, zonder winkel</Text>
                  {isList && <LuCheck />}
                </HStack>
              </Menu.Item>
            )}
            {labels.map((label) => (
              <Menu.Item key={label.id} value={label.id} onClick={() => onChange(label.id)}>
                <HStack flex="1" justify="space-between">
                  <LabelBadge label={label} />
                  {value === label.id && <LuCheck />}
                </HStack>
              </Menu.Item>
            ))}
            {onManage && (
              <>
                <Menu.Separator />
                <Menu.Item value="__manage" onClick={onManage}>
                  Labels beheren…
                </Menu.Item>
              </>
            )}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}

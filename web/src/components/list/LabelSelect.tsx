import { Button, HStack, Menu, Portal, Text } from '@chakra-ui/react'
import { LuCheck, LuTag } from 'react-icons/lu'
import type { StoreLabelRow } from '../../data/rows'
import { LabelBadge, LabelIcon } from './LabelBadge'

interface Props {
  labels: StoreLabelRow[]
  value: string | null
  onChange: (labelId: string | null) => void
  onManage?: () => void
  /** Alleen het icoon tonen (naast het invoerveld). */
  compact?: boolean
}

/** Een label kiezen (of geen label). */
export function LabelSelect({ labels, value, onChange, onManage, compact }: Props) {
  const current = labels.find((l) => l.id === value) ?? null
  return (
    <Menu.Root positioning={{ placement: 'bottom-end' }}>
      <Menu.Trigger asChild>
        <Button type="button" variant="outline" size={compact ? 'md' : 'sm'} px={compact ? '2.5' : undefined} aria-label="Label kiezen">
          {current ? (
            compact ? (
              <LabelIcon label={current} size={20} />
            ) : (
              <LabelBadge label={current} />
            )
          ) : (
            <>
              <LuTag />
              {!compact && 'Label'}
            </>
          )}
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="200px">
            <Menu.Item value="" onClick={() => onChange(null)}>
              <HStack flex="1" justify="space-between">
                <Text>Geen label</Text>
                {value === null && <LuCheck />}
              </HStack>
            </Menu.Item>
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

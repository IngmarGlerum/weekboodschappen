import { Box, HStack, Image, Text } from '@chakra-ui/react'
import { LIST_WITHOUT_LABEL } from '../../data/repo'
import type { StoreLabelRow } from '../../data/rows'

export const LABEL_COLORS = ['gray', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'cyan', 'purple', 'pink'] as const

/** Het icoon van een label: een plaatje (data-URL) of een emoji. */
export function LabelIcon({ label, size = 16 }: { label: Pick<StoreLabelRow, 'icon' | 'name'>; size?: number }) {
  if (label.icon?.startsWith('data:image/')) {
    return <Image src={label.icon} alt="" boxSize={`${size}px`} rounded="sm" objectFit="cover" flexShrink={0} />
  }
  return (
    <Box as="span" fontSize={`${Math.round(size * 0.9)}px`} lineHeight="1" flexShrink={0} aria-hidden>
      {label.icon || '🏷️'}
    </Box>
  )
}

/** Een klein label naast een item, bijvoorbeeld [🛒 Jumbo]. */
export function LabelBadge({ label, size = 'sm' }: { label: StoreLabelRow; size?: 'sm' | 'md' }) {
  const color = label.color || 'gray'
  return (
    <HStack
      as="span"
      display="inline-flex"
      gap="1"
      px="1.5"
      py="0.5"
      rounded="full"
      bg={`${color}.subtle`}
      color={`${color}.fg`}
      maxW="full"
      minW="0"
      flexShrink={1}
    >
      <LabelIcon label={label} size={size === 'sm' ? 14 : 18} />
      <Text as="span" fontSize={size === 'sm' ? 'xs' : 'sm'} fontWeight="medium" truncate>
        {label.name}
      </Text>
    </HStack>
  )
}

/** Picnic is geen label dat je zelf maakt: het is wat een artikel zonder label krijgt. */
export function PicnicBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <HStack as="span" gap="1" px="1.5" py="0.5" rounded="full" bg="red.subtle" color="red.fg" flexShrink={0}>
      <Box as="span" fontSize={size === 'sm' ? '12px' : '16px'} lineHeight="1" aria-hidden>
        🚚
      </Box>
      <Text as="span" fontSize={size === 'sm' ? 'xs' : 'sm'} fontWeight="medium">
        Picnic
      </Text>
    </HStack>
  )
}

/** De winkel van een artikel: het label, of Picnic als er geen (bestaand) label is. */
export function StoreBadge({ labels, labelId }: { labels: StoreLabelRow[]; labelId: string | null }) {
  if (labelId === LIST_WITHOUT_LABEL) {
    return (
      <Text as="span" fontSize="xs" color="fg.muted" flexShrink={0}>
        Lijst
      </Text>
    )
  }
  const label = labels.find((l) => l.id === labelId)
  return label ? <LabelBadge label={label} /> : <PicnicBadge />
}

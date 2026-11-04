import { Avatar } from '@chakra-ui/react'
import type { Household } from '../auth/HouseholdProvider'
import { initials } from '../lib/avatar'

const PALETTES = ['green', 'teal', 'blue', 'purple', 'pink', 'orange'] as const

/** Vaste kleur per planning, zodat je ze zonder foto ook uit elkaar houdt. */
function paletteFor(id: string) {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTES[hash % PALETTES.length]
}

interface Props {
  household: Pick<Household, 'id' | 'name' | 'avatar'>
  size?: '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

/** Foto van de planning, of de beginletters als er (nog) geen foto is. */
export function HouseholdAvatar({ household, size = 'sm' }: Props) {
  return (
    <Avatar.Root size={size} colorPalette={paletteFor(household.id)} shape="rounded" flexShrink={0}>
      <Avatar.Fallback>{initials(household.name)}</Avatar.Fallback>
      {household.avatar && <Avatar.Image src={household.avatar} alt="" />}
    </Avatar.Root>
  )
}

import { Box, Image } from '@chakra-ui/react'

/** Kleine productfoto van Picnic, of een leeg vakje. */
export function ProductThumb({ url, size = 40 }: { url: string | null | undefined; size?: number }) {
  return (
    <Box boxSize={`${size}px`} rounded="md" bg="bg.muted" flexShrink={0} overflow="hidden">
      {url && <Image src={url} alt="" boxSize="full" objectFit="contain" loading="lazy" />}
    </Box>
  )
}

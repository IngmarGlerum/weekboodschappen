import { Box, Button, HStack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { useCurrentHousehold } from '../../auth/HouseholdProvider'
import { usePicnicProducts } from '../../data/hooks'
import { useRepo } from '../../data/repo'
import { productRowId } from '../../domain/picnic'
import type { RefType } from '../../domain/shoppingList'
import { picnicConfigured } from '../../lib/picnicApi'
import { notify } from '../toaster'
import { ProductSearchDialog } from './ProductSearchDialog'
import { ProductThumb } from './ProductThumb'

interface Props {
  refType: RefType
  refKey: string
  /** De naam van het artikel; ook de eerste zoekterm bij Picnic. */
  articleName: string
}

/**
 * Het gekozen Picnic-product van één artikel, met een knop om het te kiezen of te
 * wijzigen. Dezelfde koppeling als op het scherm Boodschappen: kies je hier "Picnic
 * uien 1 kg" voor uien, dan geldt dat ook in elk ander gerecht en op de lijst.
 */
export function PicnicProductPicker({ refType, refKey, articleName }: Props) {
  const household = useCurrentHousehold()
  const repo = useRepo()
  const products = usePicnicProducts()
  const [open, setOpen] = useState(false)
  if (!picnicConfigured()) return null

  const product = products.data.find((p) => p.id === productRowId(household.id, refType, refKey))

  return (
    <>
      {product ? (
        <Box
          asChild
          display="flex"
          alignItems="center"
          gap="2"
          textAlign="left"
          w="full"
          minW="0"
          rounded="md"
          px="1"
          py="0.5"
          _hover={{ bg: 'bg.muted' }}
        >
          <button type="button" aria-label={`Ander Picnic-product voor ${articleName}`} onClick={() => setOpen(true)}>
            <ProductThumb url={product.image_url} size={28} />
            <Text fontSize="xs" color="fg.muted" truncate>
              🚚 {product.product_name}
              {product.unit_quantity ? ` · ${product.unit_quantity}` : ''}
            </Text>
          </button>
        </Box>
      ) : (
        <HStack>
          <Button type="button" size="xs" variant="ghost" colorPalette="green" px="1" onClick={() => setOpen(true)}>
            🚚 Kies Picnic-product
          </Button>
        </HStack>
      )}
      <ProductSearchDialog
        open={open}
        articleName={open ? articleName : null}
        onClose={() => setOpen(false)}
        onChoose={(p) => {
          setOpen(false)
          void repo
            .setPicnicProduct(
              { refType, refKey },
              { id: p.id, name: p.name, unitQuantity: p.unitQuantity || null, imageUrl: p.imageUrl, priceCents: p.priceCents },
            )
            .then(() => notify.success(`${articleName}: ${p.name}`))
        }}
      />
    </>
  )
}

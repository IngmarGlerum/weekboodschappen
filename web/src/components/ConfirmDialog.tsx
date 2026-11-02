import { Button, CloseButton, Dialog, Portal, Stack, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'

interface AppDialogProps {
  open: boolean
  onClose: () => void
  title: string
  children?: ReactNode
  footer?: ReactNode
}

/** Een gewone dialoog met titel, inhoud en knoppen onderaan. */
export function AppDialog({ open, onClose, title, children, footer }: AppDialogProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => {
        if (!e.open) onClose()
      }}
      placement="center"
      scrollBehavior="inside"
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content mx="4">
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>{children}</Dialog.Body>
            {footer && <Dialog.Footer gap="2" flexWrap="wrap">{footer}</Dialog.Footer>}
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" aria-label="Sluiten" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Een vraag met twee keuzes. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Annuleren',
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button colorPalette={destructive ? 'red' : 'green'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Stack gap="2">{typeof message === 'string' ? <Text>{message}</Text> : message}</Stack>
    </AppDialog>
  )
}

import { Button, Field, Input } from '@chakra-ui/react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHousehold } from '../auth/HouseholdProvider'
import { describeError } from '../lib/errors'
import { AppDialog } from './ConfirmDialog'
import { notify } from './toaster'

interface Props {
  open: boolean
  onClose: () => void
  /** Na het aanmaken, bijvoorbeeld om de zijbalk te sluiten. */
  onCreated?: () => void
}

/** Een nieuwe planning maken; je wisselt er meteen naartoe. */
export function NewHouseholdDialog({ open, onClose, onCreated }: Props) {
  const { createHousehold } = useHousehold()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      await createHousehold(name.trim())
      setName('')
      onClose()
      onCreated?.()
      navigate('/')
      notify.success('Planning gemaakt')
    } catch (error) {
      notify.error('Aanmaken mislukt', describeError(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Nieuwe planning"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuleren
          </Button>
          <Button type="submit" form="new-household" colorPalette="green" disabled={!name.trim()} loading={busy}>
            Maak planning
          </Button>
        </>
      }
    >
      <form id="new-household" onSubmit={submit}>
        <Field.Root>
          <Field.Label>Naam</Field.Label>
          <Input
            autoFocus
            placeholder="Bijvoorbeeld Henk's weekmenu"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Field.HelperText>Daarna kun je een foto kiezen en anderen uitnodigen.</Field.HelperText>
        </Field.Root>
      </form>
    </AppDialog>
  )
}

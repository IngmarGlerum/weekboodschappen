import { Button, Field, Input } from '@chakra-ui/react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRepo } from '../data/repo'
import { describeError } from '../lib/errors'
import { AppDialog } from './ConfirmDialog'
import { notify } from './toaster'

interface Props {
  open: boolean
  onClose: () => void
}

/** "Maak nieuw weekmenu": een naam kiezen, daarna de dagen invullen. */
export function NewWeekmenuDialog({ open, onClose }: Props) {
  const repo = useRepo()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      const id = await repo.createWeekmenu(name)
      setName('')
      onClose()
      navigate(`/weekmenus/${id}`)
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
      title="Nieuw weekmenu"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuleren
          </Button>
          <Button type="submit" form="new-weekmenu" colorPalette="green" disabled={!name.trim()} loading={busy}>
            Maak weekmenu
          </Button>
        </>
      }
    >
      <form id="new-weekmenu" onSubmit={submit}>
        <Field.Root>
          <Field.Label>Naam</Field.Label>
          <Input
            autoFocus
            placeholder="Bijvoorbeeld Weekmenu 1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field.Root>
      </form>
    </AppDialog>
  )
}

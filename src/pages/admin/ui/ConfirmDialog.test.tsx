import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './ConfirmDialog'

function setup(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn(async () => {})
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      open
      title="Remove entry"
      confirmLabel="Remove"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    >
      Remove Jim Lee from this raffle?
    </ConfirmDialog>,
  )
  return { onConfirm: (props.onConfirm as typeof onConfirm) ?? onConfirm, onCancel, user: userEvent.setup() }
}

describe('ConfirmDialog', () => {
  it('confirms without a reason when none is required', async () => {
    const { onConfirm, user } = setup()
    expect(screen.getByRole('dialog', { name: 'Remove entry' })).toHaveTextContent('Remove Jim Lee')
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onConfirm).toHaveBeenCalledWith('')
  })

  it('requires a reason of at least 3 characters and passes it trimmed', async () => {
    const { onConfirm, user } = setup({ requireReason: true })
    const confirm = screen.getByRole('button', { name: 'Remove' })
    expect(confirm).toBeDisabled()
    await user.type(screen.getByLabelText('Reason'), '  ab ')
    expect(confirm).toBeDisabled()
    await user.type(screen.getByLabelText('Reason'), 'c')
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith('ab c')
  })

  it('cancels with the Cancel button and with Escape', async () => {
    const { onCancel, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('shows the error inline and stays open when the action fails', async () => {
    const { user } = setup({
      onConfirm: vi.fn(async () => {
        throw new Error('entry_already_removed')
      }),
    })
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('entry_already_removed')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog open={false} title="X" confirmLabel="Go" onConfirm={async () => {}} onCancel={() => {}} />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('Chat MVP', () => {
  it('starts in demo login mode and opens the chat list', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Chat MVP' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Use demo account' }))

    expect(await screen.findByRole('heading', { name: 'Chats' })).toBeInTheDocument()
    expect(screen.getByText('Mira Stone')).toBeInTheDocument()
  })

  it('sends a demo text message inside a conversation', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Use demo account' }))
    fireEvent.click(await screen.findByText('Mira Stone'))
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Shipping the first mobile MVP.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(screen.getByText('Shipping the first mobile MVP.')).toBeInTheDocument()
  })
})

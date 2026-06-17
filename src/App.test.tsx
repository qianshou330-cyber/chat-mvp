import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('Chat MVP', () => {
  it('starts in demo login mode and opens the chat list', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Chat MVP' })).toBeInTheDocument()
    expect(screen.queryByText('Beta 测试版')).not.toBeInTheDocument()
    expect(screen.queryByText(/请暂时不要发送敏感信息/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))

    expect(await screen.findByRole('heading', { name: '聊天' })).toBeInTheDocument()
    expect(screen.getByText('Mira Stone')).toBeInTheDocument()
  })

  it('sends a demo text message inside a conversation', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.click(await screen.findByText('Mira Stone'))
    fireEvent.change(screen.getByLabelText('消息'), {
      target: { value: 'Shipping the first mobile MVP.' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }))

    expect(screen.getByText('Shipping the first mobile MVP.')).toBeInTheDocument()
  })

  it('adds a demo contact and opens a direct chat', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.click(await screen.findByRole('button', { name: '添加联系人' }))
    fireEvent.change(screen.getByLabelText('联系人邮箱'), {
      target: { value: 'nora@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: '开始聊天' }))

    expect(await screen.findByLabelText('消息')).toBeInTheDocument()
    expect(screen.getByText('Nora Lee')).toBeInTheDocument()
  })

  it('shows a demo attachment link after upload', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.click(await screen.findByText('Mira Stone'))

    const attachment = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    fireEvent.change(screen.getByLabelText('文件附件'), {
      target: { files: [attachment] },
    })

    expect(await screen.findByRole('link', { name: 'notes.txt' })).toHaveAttribute(
      'href',
      'blob:test-attachment',
    )
  })
})

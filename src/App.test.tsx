import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('聊天 MVP', () => {
  it('starts in demo login mode and opens the chat list', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '聊天 MVP' })).toBeInTheDocument()
    expect(screen.queryByText('Beta 测试版')).not.toBeInTheDocument()
    expect(screen.queryByText(/请暂时不要发送敏感信息/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))

    expect(await screen.findByRole('heading', { name: '聊天' })).toBeInTheDocument()
    expect(screen.getByText('林小米')).toBeInTheDocument()
  })

  it('sends a demo text message inside a conversation', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.click(await screen.findByText('林小米'))
    fireEvent.change(screen.getByLabelText('消息'), {
      target: { value: '第一版移动聊天 MVP 可以发出去了。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }))

    expect(screen.getByText('第一版移动聊天 MVP 可以发出去了。')).toBeInTheDocument()
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
    expect(screen.getByText('李诺拉')).toBeInTheDocument()
  })

  it('shows a demo attachment link after upload', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.click(await screen.findByText('林小米'))

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

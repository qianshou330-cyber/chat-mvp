import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('聊天 MVP', () => {
  it('starts in demo login mode and opens the chat list', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '聊天 MVP' })).toBeInTheDocument()
    expect(screen.queryByText('Beta 测试版')).not.toBeInTheDocument()
    expect(screen.queryByText(/请暂时不要发送敏感信息/)).not.toBeInTheDocument()
    expect(screen.queryByText('9:41')).not.toBeInTheDocument()
    expect(screen.queryByText('5G')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))

    expect(await screen.findByRole('heading', { name: '聊天' })).toBeInTheDocument()
    expect(screen.getByText('林小米')).toBeInTheDocument()
    expect(screen.getByText('文件：rls-checklist.md')).toBeInTheDocument()
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

  it('sends a demo contact request without opening a direct chat', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.click(await screen.findByRole('button', { name: '打开操作菜单' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '发送好友申请' }))
    fireEvent.change(screen.getByLabelText('对方邮箱'), {
      target: { value: 'zoe@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送申请' }))

    expect(await screen.findByText('宋知夏')).toBeInTheDocument()
    expect(screen.getByText('已发送，等待对方同意')).toBeInTheDocument()
    expect(screen.queryByLabelText('消息')).not.toBeInTheDocument()
  })

  it('keeps list actions inside the top-left menu', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    expect(await screen.findByRole('heading', { name: '聊天' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: '新建群聊' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '发送好友申请' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '打开操作菜单' }))

    expect(screen.getByRole('menu', { name: '聊天操作' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '新建群聊' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '发送好友申请' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: '工作区管理' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '退出登录' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu', { name: '聊天操作' })).not.toBeInTheDocument()
  })

  it('creates a demo group from the top-left menu', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.click(await screen.findByRole('button', { name: '打开操作菜单' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '新建群聊' }))

    expect(await screen.findByLabelText('消息')).toBeInTheDocument()
  })

  it('accepts a demo contact request before opening a direct chat', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    expect(await screen.findByText('想添加你为好友')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '同意' }))

    expect(await screen.findByLabelText('消息')).toBeInTheDocument()
    expect(screen.getByText('李诺拉')).toBeInTheDocument()
  })

  it('searches conversations and opens a matching result', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.change(await screen.findByLabelText('搜索聊天'), {
      target: { value: '上线准备群' },
    })

    expect(await screen.findByText('搜索结果')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '打开搜索结果：上线准备群' }))

    expect(await screen.findByLabelText('消息')).toBeInTheDocument()
    expect(screen.getByText('上线准备群')).toBeInTheDocument()
  })

  it('searches loaded message content with Chinese keywords', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.change(await screen.findByLabelText('搜索聊天'), {
      target: { value: 'RLS 需要' },
    })

    expect(await screen.findByText('搜索结果')).toBeInTheDocument()
    expect(
      screen.getAllByText((_, element) =>
        Boolean(element?.textContent?.includes('RLS 需要按会话成员关系限制每一条消息。')),
      ).length,
    ).toBeGreaterThan(0)
  })

  it('searches only the current conversation from the chat window', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.click(await screen.findByText('林小米'))
    fireEvent.click(screen.getByRole('button', { name: '搜索当前会话' }))
    fireEvent.change(screen.getByLabelText('搜索当前会话消息'), {
      target: { value: '移动端' },
    })

    expect(screen.getByText('1 条结果')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: '当前会话搜索结果：移动端布局已经可以开始评审了。',
      }),
    ).toBeInTheDocument()
  })

  it('updates the demo profile avatar from the camera button', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.click(await screen.findByRole('button', { name: '打开个人资料' }))

    expect(screen.getByRole('button', { name: '上传图片头像' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '上传视频头像' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '移除视频头像' })).not.toBeInTheDocument()

    const avatar = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('头像文件'), {
      target: { files: [avatar] },
    })

    expect(await screen.findByText('头像已更新。')).toBeInTheDocument()
  })

  it('shows notification settings in the profile screen', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.click(await screen.findByRole('button', { name: '打开个人资料' }))

    expect(screen.getByRole('region', { name: '消息通知' })).toBeInTheDocument()
    expect(screen.getByText('当前浏览器不支持推送通知。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开启通知' })).toBeDisabled()
  })

  it('keeps management out of profile and opens it from group info', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.click(await screen.findByRole('button', { name: '打开个人资料' }))

    expect(screen.getByRole('heading', { name: '个人资料' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '工作区管理' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '管理员记录' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '群管理记录' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '返回聊天列表' }))
    fireEvent.click(await screen.findByText('上线准备群'))
    fireEvent.click(screen.getByRole('button', { name: /上线准备群/ }))

    expect(await screen.findByLabelText('添加群成员邮箱')).toBeInTheDocument()
    expect(screen.getByText('对方需要先注册；添加后会进入当前群。')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '工作区管理' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '更多管理' }))

    expect(screen.getByRole('region', { name: '群管理记录' })).toBeInTheDocument()
    expect(screen.getByText('调整角色')).toBeInTheDocument()
    expect(screen.getByText('附件错误')).toBeInTheDocument()
  })

  it('shows and manages login devices in the profile screen', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.click(await screen.findByRole('button', { name: '打开个人资料' }))

    expect(screen.getByRole('region', { name: '登录设备' })).toBeInTheDocument()
    expect(screen.getByText('当前浏览器')).toBeInTheDocument()
    expect(screen.getByText('当前设备')).toBeInTheDocument()
    expect(screen.getByText('备用设备')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '移除设备 备用设备' }))

    expect(await screen.findByText('设备已移除。')).toBeInTheDocument()
    expect(screen.queryByText('备用设备')).not.toBeInTheDocument()
  })

  it('adds a demo group member by email from group info', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.click(await screen.findByText('上线准备群'))
    fireEvent.click(screen.getByRole('button', { name: /上线准备群/ }))
    fireEvent.change(await screen.findByLabelText('添加群成员邮箱'), {
      target: { value: 'zoe@example.com' },
    })
    const addMemberButtons = screen.getAllByRole('button', { name: '添加成员' })
    fireEvent.click(addMemberButtons[addMemberButtons.length - 1])

    expect(await screen.findByText('宋知夏')).toBeInTheDocument()
    expect(screen.getByText('已将 宋知夏 加入群聊。')).toBeInTheDocument()
  })

  it('manages demo group members and group title', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.click(await screen.findByText('上线准备群'))
    fireEvent.click(screen.getByRole('button', { name: /上线准备群/ }))

    expect(await screen.findByRole('button', { name: '编辑群名' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '编辑群名' }))
    fireEvent.change(screen.getByLabelText('群名称'), {
      target: { value: '试用管理群' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存群名' }))

    expect((await screen.findAllByText('试用管理群')).length).toBeGreaterThan(0)

    fireEvent.change(screen.getByLabelText('周一凡 的群角色'), {
      target: { value: 'admin' },
    })

    expect(screen.getByDisplayValue('群管理员')).toBeInTheDocument()

    const removeNoraButton = screen.getByRole('button', { name: '移出群聊 李诺拉' })
    await waitFor(() => {
      expect(removeNoraButton).not.toBeDisabled()
    })
    fireEvent.click(removeNoraButton)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '移出群聊 李诺拉' })).not.toBeInTheDocument()
    })
    expect(screen.getByText('群成员已移除。')).toBeInTheDocument()
  })

  it('manages demo group announcements, pinned messages, and deleted messages', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.click(await screen.findByText('上线准备群'))
    fireEvent.click(screen.getByRole('button', { name: /上线准备群/ }))

    fireEvent.change(await screen.findByLabelText('群公告'), {
      target: { value: '明天 10 点同步上线风险。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存公告' }))
    fireEvent.click(screen.getByRole('button', { name: '返回聊天' }))

    expect(await screen.findByText('明天 10 点同步上线风险。')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: '置顶' })[0])
    expect(await screen.findByText('置顶消息')).toBeInTheDocument()
    expect(screen.getAllByText(/RLS 需要按会话成员关系/).length).toBeGreaterThan(1)

    fireEvent.click(screen.getAllByRole('button', { name: '取消置顶' })[0])
    await waitFor(() => {
      expect(screen.queryByText('置顶消息')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: '删除' })[0])
    expect(await screen.findByText('此消息已删除')).toBeInTheDocument()
    expect(screen.queryByText('RLS 需要按会话成员关系限制每一条消息。')).not.toBeInTheDocument()
  })

  it('shows and hides demo group files', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.click(await screen.findByText('上线准备群'))
    fireEvent.click(screen.getByRole('button', { name: /上线准备群/ }))

    expect((await screen.findAllByText('群文件')).length).toBeGreaterThan(0)
    expect(screen.getByText('rls-checklist.md')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '打开' })).toHaveAttribute('href', '#')

    fireEvent.click(screen.getByRole('button', { name: '隐藏' }))
    expect(await screen.findByText('文件已隐藏')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '打开' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '返回聊天' }))
    expect(await screen.findByText('此附件已被管理员隐藏')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'rls-checklist.md' })).not.toBeInTheDocument()
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

  it('shows a demo image attachment as a thumbnail after upload', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '使用 Demo 账号' }))
    fireEvent.click(await screen.findByText('林小米'))

    const attachment = new File(['image'], 'photo.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('文件附件'), {
      target: { files: [attachment] },
    })

    expect(await screen.findByRole('img', { name: 'photo.png' })).toHaveAttribute(
      'src',
      'blob:test-attachment',
    )
  })
})

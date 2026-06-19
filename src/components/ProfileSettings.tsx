import { useRef, useState } from 'react'
import {
  ArrowLeft,
  Bell,
  Image as ImageIcon,
  LogOut,
  Monitor,
  Trash2,
  Video,
} from 'lucide-react'
import Avatar from './Avatar'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { formatDeviceLastSeen, formatDeviceStatus } from '../lib/uiFormat'
import type { DeviceSession, Profile, Workspace } from '../types'

export default function ProfileSettings({
  activeWorkspace,
  authNotice,
  currentDeviceId,
  deviceSessions,
  email,
  onAvatarUpload,
  onAvatarVideoUpload,
  onBack,
  onRefreshDeviceSessions,
  onRemoveVideoAvatar,
  onRevokeDeviceSession,
  onRevokeOtherDevices,
  onSave,
  onSignOut,
  profile,
  uploadProgress,
}: {
  activeWorkspace: Workspace | null
  authNotice: string
  currentDeviceId: string
  deviceSessions: DeviceSession[]
  email: string
  onAvatarUpload: (file: File) => Promise<void>
  onAvatarVideoUpload: (file: File) => Promise<void>
  onBack: () => void
  onRefreshDeviceSessions: () => Promise<void>
  onRemoveVideoAvatar: () => Promise<void>
  onRevokeDeviceSession: (deviceId: string) => Promise<boolean>
  onRevokeOtherDevices: () => Promise<boolean>
  onSave: (profile: Pick<Profile, 'displayName' | 'bio'>) => void
  onSignOut: () => void
  profile: Profile
  uploadProgress: { label: string; percent: number } | null
}) {
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [bio, setBio] = useState(profile.bio)
  const [editingField, setEditingField] = useState<'displayName' | 'bio' | null>(null)
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false)
  const [isDeviceBusy, setIsDeviceBusy] = useState(false)
  const [isDeviceSectionOpen, setIsDeviceSectionOpen] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const avatarVideoInputRef = useRef<HTMLInputElement | null>(null)
  const pushNotifications = usePushNotifications(profile.id, activeWorkspace?.id)
  const hasProfileChanges = displayName !== profile.displayName || bio !== profile.bio

  async function handleRevokeOtherDevices() {
    setIsDeviceBusy(true)
    await onRevokeOtherDevices()
    setIsDeviceBusy(false)
  }

  async function handleRevokeDevice(deviceId: string) {
    setIsDeviceBusy(true)
    await onRevokeDeviceSession(deviceId)
    setIsDeviceBusy(false)
  }

  return (
    <section className="screen detail-screen profile-detail-screen">
      <header className="topbar">
        <button aria-label="返回聊天列表" className="icon-button" onClick={onBack} type="button">
          <ArrowLeft size={22} />
        </button>
        <div>
          <p className="eyebrow">设置</p>
          <h1>个人资料</h1>
        </div>
      </header>

      <section className="profile-hero">
        <div className="detail-avatar-wrap">
          <button
            aria-expanded={isAvatarMenuOpen}
            aria-haspopup="menu"
            aria-label="头像操作"
            className="profile-avatar-trigger"
            onClick={() => setIsAvatarMenuOpen((current) => !current)}
            type="button"
          >
            <Avatar allowMotion profile={profile} size="large" />
          </button>
        </div>
        <div className="profile-identity-summary">
          <strong>{profile.displayName}</strong>
          <small>{email}</small>
          <em>点击头像更换图片或视频头像</em>
        </div>
        <input
          ref={avatarInputRef}
          accept="image/png,image/jpeg,image/webp"
          aria-label="头像文件"
          className="file-input"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void onAvatarUpload(file)
            event.target.value = ''
          }}
          type="file"
        />
        <input
          ref={avatarVideoInputRef}
          accept="video/mp4,video/webm"
          aria-label="视频头像文件"
          className="file-input"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void onAvatarVideoUpload(file)
            event.target.value = ''
          }}
          type="file"
        />
        {isAvatarMenuOpen && (
          <div className="profile-avatar-menu" role="menu" aria-label="头像操作菜单">
          <button
            onClick={() => {
              setIsAvatarMenuOpen(false)
              avatarInputRef.current?.click()
            }}
            role="menuitem"
            type="button"
          >
            <ImageIcon size={16} />
            更换图片头像
          </button>
          <button
            onClick={() => {
              setIsAvatarMenuOpen(false)
              avatarVideoInputRef.current?.click()
            }}
            role="menuitem"
            type="button"
          >
            <Video size={16} />
            更换视频头像
          </button>
          {profile.avatarMediaType === 'video' && (
            <button
              className="danger-menu-item"
              onClick={() => {
                setIsAvatarMenuOpen(false)
                void onRemoveVideoAvatar()
              }}
              role="menuitem"
              type="button"
            >
              移除视频头像
            </button>
          )}
          <button onClick={() => setIsAvatarMenuOpen(false)} role="menuitem" type="button">
            取消
          </button>
        </div>
        )}
        {uploadProgress && (
          <div className="profile-upload-progress" aria-label="头像上传进度">
            <strong>{uploadProgress.label}</strong>
            <div className="upload-progress">
              <span style={{ width: `${uploadProgress.percent}%` }} />
              <small>{uploadProgress.percent}%</small>
            </div>
          </div>
        )}
      </section>

      <form
        className="profile-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSave({ displayName, bio })
          setEditingField(null)
        }}
      >
        <section className="profile-settings-section" aria-label="个人信息">
          <button
            className="profile-setting-row"
            onClick={() => setEditingField(editingField === 'displayName' ? null : 'displayName')}
            type="button"
          >
            <span>
              <small>昵称</small>
              <strong>{displayName || '未设置'}</strong>
            </span>
            <em>{editingField === 'displayName' ? '收起' : '编辑'}</em>
          </button>
          {editingField === 'displayName' && (
            <input
              aria-label="昵称"
              id="displayName"
              onChange={(event) => setDisplayName(event.target.value)}
              value={displayName}
            />
          )}

          <button
            className="profile-setting-row"
            onClick={() => setEditingField(editingField === 'bio' ? null : 'bio')}
            type="button"
          >
            <span>
              <small>简介</small>
              <strong>{bio || '未填写'}</strong>
            </span>
            <em>{editingField === 'bio' ? '收起' : '编辑'}</em>
          </button>
          {editingField === 'bio' && (
            <textarea aria-label="简介" id="bio" onChange={(event) => setBio(event.target.value)} value={bio} />
          )}

          <div className="profile-setting-row readonly-row">
            <span>
              <small>邮箱</small>
              <strong>{email}</strong>
            </span>
          </div>
        </section>

        {hasProfileChanges && (
          <button className="primary-button" type="submit">
            保存资料
          </button>
        )}

        <section className="profile-settings-section device-card" aria-label="登录设备">
          <button
            aria-controls="device-session-panel"
            aria-expanded={isDeviceSectionOpen}
            className="profile-disclosure-row"
            onClick={() => setIsDeviceSectionOpen((current) => !current)}
            type="button"
          >
            <Monitor size={20} />
            <span>
              <strong>登录设备</strong>
              <small>{deviceSessions.length} 台设备正在使用这个账号</small>
            </span>
            <em>{isDeviceSectionOpen ? '收起' : '查看'}</em>
          </button>

          {isDeviceSectionOpen && (
            <div className="device-session-panel" id="device-session-panel">
              <button
                className="secondary-button compact-button"
                disabled={isDeviceBusy}
                onClick={() => {
                  void onRefreshDeviceSessions()
                }}
                type="button"
              >
                刷新设备
              </button>
              <div className="device-session-list">
                {deviceSessions.length === 0 ? (
                  <p className="device-note">当前还没有设备记录，刷新后会自动登记。</p>
                ) : (
                  deviceSessions.map((device) => {
                    const isCurrentDevice =
                      device.deviceId === currentDeviceId || device.deviceId === 'demo-current-device'

                    return (
                      <div className="device-session-row" key={device.id}>
                        <Monitor size={18} />
                        <span>
                          <strong>{device.deviceName}</strong>
                          <small>
                            {device.browserName} · {device.platform} ·{' '}
                            {formatDeviceLastSeen(device.lastSeenAt)}
                          </small>
                        </span>
                        <div className="device-row-actions">
                          <span className="role-badge">{formatDeviceStatus(device.lastSeenAt)}</span>
                          {isCurrentDevice ? (
                            <span className="current-device-badge">当前设备</span>
                          ) : (
                            <button
                              className="icon-button danger-icon-button"
                              disabled={isDeviceBusy}
                              aria-label={`移除设备 ${device.deviceName}`}
                              onClick={() => {
                                void handleRevokeDevice(device.deviceId)
                              }}
                              type="button"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <button
                className="secondary-button danger-secondary-button"
                disabled={isDeviceBusy || deviceSessions.length <= 1}
                onClick={() => {
                  void handleRevokeOtherDevices()
                }}
                type="button"
              >
                {isDeviceBusy ? '处理中' : '退出其他设备'}
              </button>
              <p className="device-note">移除单台设备后，该设备下次刷新或心跳时会退出。</p>
            </div>
          )}
        </section>
        <section className="notification-card" aria-label="消息通知">
          <span className="notification-icon">
            <Bell size={20} />
          </span>
          <div>
            <strong>消息通知</strong>
            <p>{pushNotifications.statusMessage}</p>
          </div>
          <button
            className={pushNotifications.isSubscribed ? 'secondary-button' : 'primary-button'}
            disabled={
              pushNotifications.isBusy ||
              pushNotifications.status === 'unsupported' ||
              pushNotifications.status === 'demo' ||
              pushNotifications.status === 'missing-config' ||
              pushNotifications.status === 'denied'
            }
            onClick={() => {
              if (pushNotifications.isSubscribed) {
                void pushNotifications.disableNotifications()
              } else {
                void pushNotifications.enableNotifications()
              }
            }}
            type="button"
          >
            {pushNotifications.isBusy
              ? '处理中'
              : pushNotifications.isSubscribed
                ? '关闭通知'
                : '开启通知'}
          </button>
        </section>
        <button className="profile-sign-out-row" onClick={onSignOut} type="button">
          <LogOut size={20} />
          <span>
            <strong>退出登录</strong>
            <small>退出当前账号并回到登录页</small>
          </span>
        </button>
        {authNotice && <p className="notice">{authNotice}</p>}
      </form>
    </section>
  )
}

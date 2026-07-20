import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { changePassword, login } from '../api/auth'
import { ApiError } from '../api/client'
import AuthHero from '../components/AuthHero'
import ChangelogModal from '../components/ChangelogModal'
import { CHANGELOG } from '../data/changelog'
import './AuthPages.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'change'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }
    setLoading(true)
    try {
      await changePassword(username, password, newPassword)
      setMode('login')
      setPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setNotice('密码已修改，请使用新密码登录')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '修改失败')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (next: 'login' | 'change') => {
    setMode(next)
    setError('')
    setNotice('')
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <AuthHero title="观运势 · 知五行" subtitle="每日记录，测算大师为你解读生活与命理" />
        <div className="auth-card">
          {mode === 'login' ? (
            <>
              <h2 className="auth-card-title">账号登录</h2>
              <form onSubmit={onLogin}>
                <label>
                  账号
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入账号"
                    autoComplete="username"
                    required
                  />
                </label>
                <label>
                  密码
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    required
                  />
                </label>
                {error && <p className="error">{error}</p>}
                {notice && <p className="notice">{notice}</p>}
                <button type="submit" className="auth-submit" disabled={loading}>
                  {loading ? '登录中...' : '进入运势空间'}
                </button>
              </form>
              <p className="hint">
                还没有账号？<Link to="/register">立即注册</Link>
                <button type="button" className="link-btn-inline" onClick={() => switchMode('change')}>
                  修改密码
                </button>
              </p>
            </>
          ) : (
            <>
              <h2 className="auth-card-title">修改密码</h2>
              <form onSubmit={onChangePassword}>
                <label>
                  账号
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入账号"
                    autoComplete="username"
                    required
                  />
                </label>
                <label>
                  旧密码
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入旧密码"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <label>
                  新密码
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="至少 6 位"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </label>
                <label>
                  确认新密码
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再输入一次新密码"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </label>
                {error && <p className="error">{error}</p>}
                <button type="submit" className="auth-submit" disabled={loading}>
                  {loading ? '提交中...' : '确认修改'}
                </button>
              </form>
              <p className="hint">
                <button type="button" className="link-btn-inline" onClick={() => switchMode('login')}>
                  返回登录
                </button>
              </p>
            </>
          )}
        </div>
        <button type="button" className="changelog-entry-btn" onClick={() => setChangelogOpen(true)}>
          更新说明
          <span className="changelog-current">{CHANGELOG[0].version}</span>
        </button>
        <p className="auth-footer">金木水火土，顺应天时 · 记录当下</p>
        <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />
      </div>
    </div>
  )
}

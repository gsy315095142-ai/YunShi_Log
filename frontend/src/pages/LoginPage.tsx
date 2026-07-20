import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { ApiError } from '../api/client'
import AuthHero from '../components/AuthHero'
import ChangelogModal from '../components/ChangelogModal'
import { CHANGELOG } from '../data/changelog'
import './AuthPages.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/daily', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <AuthHero title="观运势 · 知五行" subtitle="每日记录，测算大师为你解读生活与命理" />
        <div className="auth-card">
          <h2 className="auth-card-title">账号登录</h2>
          <form onSubmit={onSubmit}>
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
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? '登录中...' : '进入运势空间'}
            </button>
          </form>
          <p className="hint">
            还没有账号？<Link to="/register">立即注册</Link>
          </p>
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

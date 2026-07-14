import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import { ApiError } from '../api/client'
import AuthHero from '../components/AuthHero'
import './AuthPages.css'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(username, password)
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <AuthHero title="开启运势之旅" subtitle="注册账号，记录每日，探索属于你的五行命理" />
        <div className="auth-card">
          <h2 className="auth-card-title">创建账号</h2>
          <form onSubmit={onSubmit}>
            <label>
              账号
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="2–32 个字符"
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
                placeholder="至少 6 位"
                minLength={6}
                autoComplete="new-password"
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? '注册中...' : '完成注册'}
            </button>
          </form>
          <p className="hint">
            已有账号？<Link to="/login">去登录</Link>
          </p>
        </div>
        <p className="auth-footer">金木水火土，顺应天时 · 记录当下</p>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { clearToken } from '../utils/token'
import { fetchMe } from '../api/auth'
import './Layout.css'

interface LayoutProps {
  children: React.ReactNode
}

const PAGE_TITLES: Record<string, string> = {
  '/profile': '个人信息',
  '/daily': '每日记录',
  '/ai': 'AI 测算',
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const pageTitle = PAGE_TITLES[location.pathname] ?? ''

  useEffect(() => {
    fetchMe()
      .then((user) => setUsername(user.username))
      .catch(() => {})
  }, [])

  const logout = () => {
    clearToken()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-title">
          <h1>运势Log</h1>
          {pageTitle && <span className="page-title">{pageTitle}</span>}
        </div>
        <div className="header-right">
          {username && <span className="welcome">你好，{username}</span>}
          <button type="button" className="link-btn" onClick={logout}>
            退出
          </button>
        </div>
      </header>
      <main className="app-main">{children}</main>
      <nav className="tab-bar">
        <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
          <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></svg>
          <span>个人信息</span>
        </NavLink>
        <NavLink to="/daily" className={({ isActive }) => (isActive ? 'active' : '')}>
          <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
          <span>每日记录</span>
        </NavLink>
        <NavLink to="/ai" className={({ isActive }) => (isActive ? 'active' : '')}>
          <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="11" r="7" /><path d="M8 21h8M8.5 18s1.5 1 3.5 1 3.5-1 3.5-1" /><path d="M9.5 11l1.5-2 1 2.5 1.5-2" /></svg>
          <span>AI测算</span>
        </NavLink>
      </nav>
    </div>
  )
}

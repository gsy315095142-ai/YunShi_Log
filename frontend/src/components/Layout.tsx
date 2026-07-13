import { NavLink, useNavigate } from 'react-router-dom'
import { clearToken } from '../utils/token'
import './Layout.css'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()

  const logout = () => {
    clearToken()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>苏运势 Log</h1>
        <button type="button" className="link-btn" onClick={logout}>
          退出
        </button>
      </header>
      <main className="app-main">{children}</main>
      <nav className="tab-bar">
        <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
          个人信息
        </NavLink>
        <NavLink to="/daily" className={({ isActive }) => (isActive ? 'active' : '')}>
          每日记录
        </NavLink>
        <NavLink to="/ai" className={({ isActive }) => (isActive ? 'active' : '')}>
          AI测算
        </NavLink>
      </nav>
    </div>
  )
}

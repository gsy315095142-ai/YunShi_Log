import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProfilePage from './pages/ProfilePage'
import DailyPage from './pages/DailyPage'
import AIPage from './pages/AIPage'
import { fetchProfile } from './api/profile'
import { getToken } from './utils/token'
import './App.css'

/**
 * 首页智能跳转：必填个人信息（姓名+公历生日）未填 → 个人信息页；已填 → AI 测算页。
 * 查询失败时兜底去每日记录页。
 */
function HomeRedirect() {
  const [to, setTo] = useState<string | null>(null)

  useEffect(() => {
    fetchProfile()
      .then((p) => setTo(p.display_name && p.birth_date ? '/ai' : '/profile'))
      .catch(() => setTo('/daily'))
  }, [])

  if (!to) return <p className="loading">加载中...</p>
  return <Navigate to={to} replace />
}

export default function App() {
  // 订阅路由变化，确保每次跳转都重新读取 token（否则退出登录后 authed 是旧值，
  // /login 会被误判为已登录而跳回首页，形成无限重定向白屏）
  useLocation()
  const authed = !!getToken()

  return (
    <Routes>
      <Route path="/login" element={authed ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register" element={authed ? <Navigate to="/" replace /> : <RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/daily" element={<DailyPage />} />
        <Route path="/ai" element={<AIPage />} />
      </Route>
      <Route path="*" element={<Navigate to={authed ? '/' : '/login'} replace />} />
    </Routes>
  )
}

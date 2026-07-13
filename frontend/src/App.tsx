import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProfilePage from './pages/ProfilePage'
import DailyPage from './pages/DailyPage'
import AIPage from './pages/AIPage'
import { getToken } from './utils/token'
import './App.css'

export default function App() {
  const authed = !!getToken()

  return (
    <Routes>
      <Route path="/login" element={authed ? <Navigate to="/daily" replace /> : <LoginPage />} />
      <Route path="/register" element={authed ? <Navigate to="/daily" replace /> : <RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/daily" replace />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/daily" element={<DailyPage />} />
        <Route path="/ai" element={<AIPage />} />
      </Route>
      <Route path="*" element={<Navigate to={authed ? '/daily' : '/login'} replace />} />
    </Routes>
  )
}

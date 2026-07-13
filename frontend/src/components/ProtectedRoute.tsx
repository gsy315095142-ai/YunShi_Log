import { Navigate, Outlet } from 'react-router-dom'
import { getToken } from '../utils/token'
import Layout from './Layout'

export default function ProtectedRoute() {
  if (!getToken()) {
    return <Navigate to="/login" replace />
  }
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

import { Navigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/context/AuthContext.jsx'

export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, userRole, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg"></div>
        <p>Memuat...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!allowedRoles.includes(userRole)) return <Navigate to="/login" replace />

  return children
}

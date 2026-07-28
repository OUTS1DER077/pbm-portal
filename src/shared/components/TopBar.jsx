import { useAuth } from '../../features/auth/context/AuthContext.jsx'
import { Menu, User, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import './TopBar.css'

const roleLabels = {
  master: 'Master',
  mentor: 'Mentor',
  mahasiswa: 'Mahasiswa'
}

export default function TopBar({ onMenuClick }) {
  const { userData, userRole, logout } = useAuth()
  const name = userData?.name || userData?.email || 'User'
  const firstName = name.split(' ')[0]
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="topbar-menu-btn" onClick={onMenuClick}>
          <Menu size={22} />
        </button>
        <div className="topbar-greeting">
          <span className="topbar-salam">Assalamu'alaikum,</span>
          <span className="topbar-name">{firstName} 👋</span>
        </div>
      </div>
      <div className="topbar-right">
        <span className="badge badge-accent">{roleLabels[userRole]}</span>
        <div className="topbar-avatar">
          <User size={18} />
        </div>
        <button onClick={handleLogout} className="topbar-logout-btn" title="Keluar">
          <LogOut size={20} />
        </button>
      </div>
    </header>
  )
}

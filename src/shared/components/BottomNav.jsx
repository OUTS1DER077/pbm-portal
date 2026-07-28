import { NavLink } from 'react-router-dom'
import { useAuth } from '../../features/auth/context/AuthContext.jsx'
import { LayoutDashboard, Users, UserPlus, BookOpen, BarChart3, GraduationCap, ClipboardList, TrendingUp, Settings } from 'lucide-react'
import './BottomNav.css'

export default function BottomNav() {
  const { userRole } = useAuth()

  if (!userRole) return null

  let links = []

  if (userRole === 'master') {
    links = [
      { to: '/master', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/master/mentors', label: 'Mentor', icon: Users },
      { to: '/master/statistics', label: 'Statistik', icon: BarChart3 }
    ]
  } else if (userRole === 'mentor') {
    links = [
      { to: '/mentor', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/mentor/mahasiswa', label: 'Mahasiswa', icon: GraduationCap },
      { to: '/mentor/evaluate', label: 'Evaluasi', icon: ClipboardList },
      { to: '/mentor/settings', label: 'Pengaturan', icon: Settings }
    ]
  } else if (userRole === 'mahasiswa') {
    links = [
      { to: '/mahasiswa', label: 'Beranda', icon: LayoutDashboard },
      { to: '/mahasiswa/progress', label: 'Progres', icon: TrendingUp },
      { to: '/mahasiswa/settings', label: 'Pengaturan', icon: Settings }
    ]
  }

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-container">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === `/${userRole}`} // Exact match for root dashboard
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <div className="bottom-nav-icon">
              <link.icon size={22} strokeWidth={2.5} />
            </div>
            <span className="bottom-nav-label">{link.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

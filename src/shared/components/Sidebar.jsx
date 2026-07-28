import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/context/AuthContext.jsx'
import {
  LayoutDashboard, Users, BarChart3, GraduationCap,
  ClipboardEdit, TrendingUp, LogOut, Menu, X, BookOpen, Settings
} from 'lucide-react'
import './Sidebar.css'

const navItems = {
  master: [
    { to: '/master', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/master/mentors', icon: Users, label: 'Kelola Mentor' },
    { to: '/master/mahasiswa', icon: GraduationCap, label: 'Semua Mahasiswa' },
    { to: '/master/statistics', icon: BarChart3, label: 'Statistik' },
  ],
  mentor: [
    { to: '/mentor', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/mentor/evaluate', icon: ClipboardEdit, label: 'Evaluasi Baru' },
    { to: '/mentor/settings', icon: Settings, label: 'Pengaturan Akun' },
  ],
  mahasiswa: [
    { to: '/mahasiswa', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/mahasiswa/progress', icon: TrendingUp, label: 'Progres Saya' },
    { to: '/mahasiswa/settings', icon: Settings, label: 'Pengaturan Akun' },
  ],
}

export default function Sidebar({ collapsed, onToggle }) {
  const { userRole, logout } = useAuth()
  const location = useLocation()
  const items = navItems[userRole] || []

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div className="sidebar-overlay" onClick={onToggle} />
      )}

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <BookOpen size={24} />
          </div>
          {!collapsed && (
            <div className="sidebar-logo-text">
              <span className="sidebar-logo-title">PBM</span>
              <span className="sidebar-logo-sub">Portal Belajar Mengaji</span>
            </div>
          )}
          <button className="sidebar-toggle" onClick={onToggle}>
            {collapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <item.icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="sidebar-footer">
          <button className="sidebar-link logout-btn" onClick={logout}>
            <LogOut size={20} />
            {!collapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>
    </>
  )
}

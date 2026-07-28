import { useState, useEffect } from 'react'
import { collection, query, getDocs, where } from 'firebase/firestore'
import { db } from '../../../lib/firebase.js'
import { Users, GraduationCap, CalendarCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import MentorList from './MentorList.jsx'
import './MasterDashboard.css'

export default function MasterDashboard() {
  const [stats, setStats] = useState({ mentors: 0, mahasiswa: 0, sessions: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const mentorSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'mentor')))
        const mahasiswaSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'mahasiswa')))
        const evalSnap = await getDocs(collection(db, 'evaluations'))

        setStats({
          mentors: mentorSnap.size,
          mahasiswa: mahasiswaSnap.size,
          sessions: evalSnap.size
        })
      } catch (err) {
        console.error('Error fetching stats:', err)
        toast.error('Gagal memuat statistik. Periksa koneksi Anda.')
      }
      setLoading(false)
    }
    fetchStats()
  }, [])

  const statCards = [
    { icon: Users, value: stats.mentors, label: 'Mentor Aktif', color: '#10B981' },
    { icon: GraduationCap, value: stats.mahasiswa, label: 'Mahasiswa Terdaftar', color: '#6366F1' },
    { icon: CalendarCheck, value: stats.sessions, label: 'Total Sesi', color: '#F59E0B' },
  ]

  return (
    <div className="master-dashboard">
      <h1 className="page-title">Dashboard Master</h1>

      <div className="stats-grid">
        {statCards.map((stat, i) => (
          <div key={i} className="glass-card interactive stat-card">
            <div className="stat-icon" style={{ background: `${stat.color}20`, color: stat.color }}>
              <stat.icon size={22} />
            </div>
            <div className="stat-value">{loading ? '—' : stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <MentorList />
    </div>
  )
}

import { useState, useEffect } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../../lib/firebase.js'
import { BarChart3, Users, GraduationCap, BookOpen, BookMarked, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'

export default function StatsOverview() {
  const [data, setData] = useState({ mentors: 0, mahasiswa: 0, iqro: 0, quran: 0, evals: 0, lanjut: 0, ulang: 0 })
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      try {
        const mentorSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'mentor')))
        const mhsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'mahasiswa')))
        const evalSnap = await getDocs(collection(db, 'evaluations'))
        const attSnap = await getDocs(collection(db, 'attendance'))

        const mentorList = mentorSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const mhsList = mhsSnap.docs.map(d => d.data())
        const evalList = evalSnap.docs.map(d => d.data())
        const attList = attSnap.docs.map(d => d.data())

        // Calculate Leaderboard
        const mentorStats = mentorList.map(mentor => {
          const mentorEvals = evalList.filter(e => e.mentorId === mentor.id)
          const mentorAtts = attList.filter(a => a.mentorId === mentor.id)
          
          let totalEvalPct = 0
          mentorEvals.forEach(e => {
            let coreTotal = 0
            let maxPossible = 0

            if (e.level === 'iqro' && e.metrics) {
              e.metrics.forEach(m => coreTotal += m.score || 0)
              maxPossible = e.metrics.length * 5
            } else {
              const scores = e.scores || {}
              const coreKeys = Object.keys(scores).filter(k => k !== 'adab')
              coreTotal = coreKeys.reduce((a, k) => a + (scores[k] || 0), 0)
              maxPossible = coreKeys.length * 5
            }
            
            const pct = maxPossible > 0 ? (coreTotal / maxPossible) * 100 : 0
            totalEvalPct += pct
          })
          const avgScore = mentorEvals.length > 0 ? Math.round(totalEvalPct / mentorEvals.length) : 0
          
          const hadir = mentorAtts.filter(a => a.status === 'hadir').length
          const attRate = mentorAtts.length > 0 ? Math.round((hadir / mentorAtts.length) * 100) : 0
          
          return {
            id: mentor.id,
            name: mentor.name,
            avgScore: parseInt(avgScore),
            attRate: parseInt(attRate),
            totalStudents: mhsList.filter(m => m.mentorId === mentor.id).length
          }
        })
        
        // Sort primarily by attendance rate, then by average score
        mentorStats.sort((a, b) => b.attRate - a.attRate || b.avgScore - a.avgScore)
        setLeaderboard(mentorStats)

        setData({
          mentors: mentorSnap.size,
          mahasiswa: mhsSnap.size,
          iqro: mhsList.filter(m => m.level === 'iqro').length,
          quran: mhsList.filter(m => m.level === 'quran').length,
          evals: evalSnap.size,
          lanjut: evalList.filter(e => e.status === 'lanjut').length,
          ulang: evalList.filter(e => e.status === 'ulang').length,
        })
      } catch (err) { 
        console.error(err)
        toast.error('Gagal memuat data statistik')
      }
      setLoading(false)
    }
    fetch()
  }, [])

  const cards = [
    { icon: Users, label: 'Total Mentor', value: data.mentors, color: '#10B981' },
    { icon: GraduationCap, label: 'Total Mahasiswa', value: data.mahasiswa, color: '#6366F1' },
    { icon: BookOpen, label: 'Level Iqro', value: data.iqro, color: '#8B5CF6' },
    { icon: BookMarked, label: "Level Al-Qur'an", value: data.quran, color: '#F59E0B' },
    { icon: BarChart3, label: 'Total Evaluasi', value: data.evals, color: '#EC4899' },
    { icon: BarChart3, label: 'Status Lanjut', value: data.lanjut, color: '#22C55E' },
  ]

  return (
    <div className="page-enter">
      <h1 className="page-title" style={{ fontSize: 'var(--fs-heading)', fontWeight: 700, marginBottom: 24 }}>
        <BarChart3 size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
        Statistik Keseluruhan
      </h1>
      <div className="stats-grid">
        {cards.map((c, i) => (
          <div key={i} className="glass-card interactive stat-card">
            <div className="stat-icon" style={{ background: `${c.color}20`, color: c.color }}>
              <c.icon size={22} />
            </div>
            <div className="stat-value">{loading ? '—' : c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      {!loading && data.evals > 0 && (
        <div className="glass-card" style={{ padding: 24, marginTop: 24 }}>
          <h2 style={{ fontSize: 'var(--fs-subheading)', fontWeight: 700, marginBottom: 16 }}>Rasio Status Evaluasi</h2>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 'var(--fs-caption)' }}>
                <span style={{ color: 'var(--clr-success)' }}>Lanjut</span>
                <span style={{ color: 'var(--clr-text-secondary)' }}>{data.lanjut} / {data.evals}</span>
              </div>
              <div className="progress-bar-container" style={{ height: 12 }}>
                <div className="progress-bar" style={{ width: `${(data.lanjut / data.evals) * 100}%`, background: 'var(--clr-success)' }}></div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 'var(--fs-caption)' }}>
                <span style={{ color: 'var(--clr-warning)' }}>Ulang</span>
                <span style={{ color: 'var(--clr-text-secondary)' }}>{data.ulang} / {data.evals}</span>
              </div>
              <div className="progress-bar-container" style={{ height: 12 }}>
                <div className="progress-bar" style={{ width: `${(data.ulang / data.evals) * 100}%`, background: 'var(--clr-warning)' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Papan Peringkat Kinerja Mentor */}
      {!loading && leaderboard.length > 0 && (
        <div className="glass-card" style={{ padding: 24, marginTop: 24 }}>
          <h2 style={{ fontSize: 'var(--fs-subheading)', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={20} style={{ color: 'var(--clr-warning)' }} />
            Papan Peringkat Kinerja Mentor
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Peringkat</th>
                  <th>Nama Mentor</th>
                  <th>Total Mahasiswa</th>
                  <th>Tingkat Kehadiran Kelas</th>
                  <th>Rata-rata Nilai Kelas</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((m, idx) => (
                  <tr key={m.id}>
                    <td>
                      {idx === 0 ? <span className="badge badge-warning">🏆 #1</span> : 
                       idx === 1 ? <span className="badge" style={{ background: '#94a3b8', color: 'white' }}>🥈 #2</span> : 
                       idx === 2 ? <span className="badge" style={{ background: '#b45309', color: 'white' }}>🥉 #3</span> : 
                       `#${idx + 1}`}
                    </td>
                    <td className="td-name">
                      <div className="avatar-circle">{(m.name || '?')[0].toUpperCase()}</div>
                      <div>{m.name}</div>
                    </td>
                    <td>{m.totalStudents} Siswa</td>
                    <td><strong style={{ color: m.attRate >= 80 ? 'var(--clr-success)' : 'inherit' }}>{m.attRate}%</strong></td>
                    <td><strong>{m.avgScore}%</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

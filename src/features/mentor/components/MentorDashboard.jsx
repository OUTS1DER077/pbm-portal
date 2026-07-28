import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../../lib/firebase.js'
import { useAuth } from '../../auth/context/AuthContext.jsx'
import { GraduationCap, BookOpen, BookMarked, UserPlus, ClipboardEdit, Search, Filter, Download, UserCheck, Activity, CalendarDays } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import MahasiswaCreateModal from './MahasiswaCreateModal.jsx'
import { AlertTriangle } from 'lucide-react'
import './MentorDashboard.css'

export default function MentorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mahasiswaList, setMahasiswaList] = useState([])
  const [classStats, setClassStats] = useState({ avgScore: 0, attRate: 0 })
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterLevel, setFilterLevel] = useState('semua')

  const fetchMahasiswa = async () => {
    try {
      const q = query(collection(db, 'users'), where('mentorId', '==', user.uid), where('role', '==', 'mahasiswa'))
      let snap;
      try {
        snap = await getDocs(q)
      } catch (e) {
        console.error('Error fetching users collection:', e);
        throw e;
      }
      const mListRaw = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      // Analytics logic
      const evalQ = query(collection(db, 'evaluations'), where('mentorId', '==', user.uid))
      const attQ = query(collection(db, 'attendance'), where('mentorId', '==', user.uid))
      
      let evalSnap, attSnap;
      try {
        [evalSnap, attSnap] = await Promise.all([getDocs(evalQ), getDocs(attQ)])
      } catch (e) {
        console.error('Error fetching evaluations or attendance:', e);
        throw e;
      }
      
      const evalData = evalSnap.docs.map(d => d.data())
      let totalEvalPct = 0
      evalData.forEach(d => {
        let coreTotal = 0
        let maxPossible = 0

        if (d.level === 'iqro' && d.metrics) {
          d.metrics.forEach(m => coreTotal += m.score || 0)
          maxPossible = d.metrics.length * 5
        } else {
          const scores = d.scores || {}
          const coreKeys = Object.keys(scores).filter(k => k !== 'adab')
          coreTotal = coreKeys.reduce((a, k) => a + (scores[k] || 0), 0)
          maxPossible = coreKeys.length * 5
        }
        
        const pct = maxPossible > 0 ? (coreTotal / maxPossible) * 100 : 0
        totalEvalPct += pct
      })
      const avgScore = evalSnap.size > 0 ? Math.round(totalEvalPct / evalSnap.size) : 0

      const attData = attSnap.docs.map(d => d.data())
      let totalHadir = 0
      attData.forEach(d => { if (d.status === 'hadir') totalHadir++ })
      const attRate = attSnap.size > 0 ? ((totalHadir / attSnap.size) * 100).toFixed(0) : 0

      setClassStats({ avgScore, attRate })

      // Attach quick info to each mahasiswa
      const mList = mListRaw.map(m => {
        const mEvals = evalData.filter(e => e.mahasiswaId === m.id)
        mEvals.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
        const lastEvalDate = mEvals.length > 0 ? new Date(mEvals[0].createdAt) : null
        
        const daysSinceEval = lastEvalDate ? Math.floor((new Date() - lastEvalDate) / (1000 * 60 * 60 * 24)) : 999
        const needsEval = daysSinceEval > 7

        const mAtt = attData.filter(a => a.mahasiswaId === m.id)
        const hadirCount = mAtt.filter(a => a.status === 'hadir').length
        const mAttRate = mAtt.length > 0 ? Math.round((hadirCount / mAtt.length) * 100) : 0

        return { ...m, daysSinceEval, needsEval, attRate: mAttRate }
      })
      setMahasiswaList(mList)
    } catch (err) {
      console.error('Error fetching mahasiswa:', err)
      toast.error('Gagal memuat data. Periksa koneksi Anda.')
    }
    setLoading(false)
  }

  useEffect(() => { if (user) fetchMahasiswa() }, [user])

  const filteredList = mahasiswaList
    .filter(m => (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (m.nim || m.email || '').toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(m => filterLevel === 'semua' || m.level === filterLevel);

  const handleExport = () => {
    const doc = new jsPDF()
    doc.text("Laporan Data Mahasiswa Binaan", 14, 15)
    
    const tableData = filteredList.map((m, index) => [
      index + 1,
      m.nim || m.email,
      m.name,
      m.level === 'iqro' ? 'Iqro' : "Al-Qur'an",
      m.createdAt ? new Date(m.createdAt).toLocaleDateString('id-ID') : '-'
    ])

    autoTable(doc, {
      head: [['No', 'NIM', 'Nama', 'Level', 'Tanggal Bergabung']],
      body: tableData,
      startY: 25,
    })
    
    doc.save("Data_Mahasiswa_Binaan.pdf")
  }

  const handleExportExcel = () => {
    const dataToExport = filteredList.map((m, index) => ({
      No: index + 1,
      NIM: m.nim || m.email,
      Nama: m.name,
      Level: m.level === 'iqro' ? 'Iqro' : "Al-Qur'an",
      'Tanggal Bergabung': m.createdAt ? new Date(m.createdAt).toLocaleDateString('id-ID') : '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Mahasiswa");
    XLSX.writeFile(workbook, "Data_Mahasiswa_Binaan.xlsx");
  }

  const iqroCount = mahasiswaList.filter(m => m.level === 'iqro').length
  const quranCount = mahasiswaList.filter(m => m.level === 'quran').length

  const statCards = [
    { id: 'semua', icon: GraduationCap, value: mahasiswaList.length, label: 'Mahasiswa Binaan', color: '#10B981', action: () => setFilterLevel('semua') },
    { id: 'iqro', icon: BookOpen, value: iqroCount, label: 'Level Iqro', color: '#6366F1', action: () => setFilterLevel('iqro') },
    { id: 'quran', icon: BookMarked, value: quranCount, label: "Level Al-Qur'an", color: '#F59E0B', action: () => setFilterLevel('quran') },
    { id: 'avg', icon: Activity, value: `${classStats.avgScore}%`, label: 'Rata-rata Nilai Kelas', color: '#EC4899', action: null },
    { id: 'att', icon: CalendarDays, value: `${classStats.attRate}%`, label: 'Tingkat Kehadiran', color: '#8B5CF6', action: null },
  ]

  const isDashboard = location.pathname === '/mentor' || location.pathname === '/mentor/'
  const isEvaluate = location.pathname.includes('/mentor/evaluate')

  return (
    <div className="mentor-dashboard page-enter">
      {isDashboard && <h1 className="page-title">Dashboard Mentor</h1>}
      {!isDashboard && !isEvaluate && <h1 className="page-title">Mahasiswa Binaan</h1>}
      {isEvaluate && <h1 className="page-title">Pilih Mahasiswa untuk Dievaluasi</h1>}

      {isDashboard && (
        <div className="stats-grid">
          {statCards.map((s, i) => (
            <div 
              key={i} 
              className={`glass-card stat-card ${s.action ? 'interactive' : ''}`} 
              onClick={s.action ? s.action : undefined} 
              style={{
                cursor: s.action ? 'pointer' : 'default',
                border: s.id === filterLevel ? `2px solid ${s.color}` : '1px solid transparent',
                transform: s.id === filterLevel ? 'translateY(-2px)' : 'none',
                boxShadow: s.id === filterLevel ? `0 8px 16px ${s.color}20` : 'var(--shadow-sm)'
              }}
            >
              <div className="stat-icon" style={{ background: `${s.color}20`, color: s.color }}>
                <s.icon size={22} />
              </div>
              <div className="stat-value">{loading ? '—' : s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Mahasiswa List */}
      <div className="section-header" style={{ marginTop: isDashboard ? 24 : 0, flexWrap: 'wrap' }}>
        <h2 className="section-title"><GraduationCap size={20} /> {isEvaluate ? 'Daftar Mahasiswa' : 'Mahasiswa Binaan'}</h2>
        <div className="header-actions">
          <div className="search-box">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Cari mahasiswa..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="search-box" style={{ width: 'auto' }}>
            <Filter size={16} />
            <select 
              value={filterLevel} 
              onChange={(e) => setFilterLevel(e.target.value)}
              className="search-input"
              style={{ width: '120px' }}
            >
              <option value="semua">Semua Level</option>
              <option value="iqro">Iqro</option>
              <option value="quran">Al-Qur'an</option>
            </select>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleExport} style={{ background: '#ef4444' }}>
            <Download size={16} /> Export PDF
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExportExcel} style={{ background: '#10b981' }}>
            <Download size={16} /> Export Excel
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <UserPlus size={16} /> Tambah
          </button>
        </div>
      </div>

      <div className="mahasiswa-grid">
        {loading ? (
          <div className="empty-state"><div className="spinner"></div></div>
        ) : mahasiswaList.length === 0 ? (
          <div className="glass-card">
            <div className="empty-state">
              <GraduationCap size={48} />
              <p>Belum ada mahasiswa binaan.</p>
              <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
                <UserPlus size={16} /> Tambah Mahasiswa
              </button>
            </div>
          </div>
        ) : (
            filteredList.map(m => (
            <div 
              key={m.id} 
              className="glass-card interactive mahasiswa-card"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                if (isEvaluate) navigate(`/mentor/evaluate/${m.id}`)
                else navigate(`/mentor/mahasiswa/${m.id}`)
              }}
            >
              <div className="mahasiswa-card-top">
                <div className="avatar-circle">{(m.name || '?')[0].toUpperCase()}</div>
                <div className="mahasiswa-info">
                  <div className="mahasiswa-name">{m.name}</div>
                  <div className="mahasiswa-nim">NIM: {m.nim || m.email}</div>
                </div>
                <span className={`badge ${m.level === 'iqro' ? 'badge-accent' : 'badge-warning'}`}>
                  {m.level === 'iqro' ? 'Iqro' : "Al-Qur'an"}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '11px', flexWrap: 'wrap', marginTop: '-8px', marginBottom: '4px' }}>
                <span style={{ padding: '3px 8px', borderRadius: '12px', background: 'var(--clr-bg-tertiary)', color: 'var(--clr-text-muted)', fontWeight: 700 }}>
                  Absen: {m.attRate}%
                </span>
                {m.needsEval ? (
                  <span style={{ padding: '3px 8px', borderRadius: '12px', background: 'var(--clr-danger-bg)', color: 'var(--clr-danger)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={10} /> Perlu Evaluasi
                  </span>
                ) : (
                  <span style={{ padding: '3px 8px', borderRadius: '12px', background: 'var(--clr-success-bg)', color: 'var(--clr-success-dark)', fontWeight: 700 }}>
                    OK ({m.daysSinceEval === 0 ? 'Hari ini' : `${m.daysSinceEval} hr lalu`})
                  </span>
                )}
              </div>
              {!isEvaluate && (
                <div className="card-btn-row">
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={(e) => { e.stopPropagation(); navigate(`/mentor/mahasiswa/${m.id}`) }}
                  >
                    <UserCheck size={16} /> Profil
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, background: '#8B5CF6', color: '#fff' }}
                    onClick={(e) => { e.stopPropagation(); navigate(`/mentor/mahasiswa/${m.id}?section=absen`) }}
                  >
                    <CalendarDays size={16} /> Absen
                  </button>
                </div>
              )}
              <button
                className="btn btn-primary btn-sm btn-block"
                style={{ marginTop: isEvaluate ? '0px' : '8px' }}
                onClick={(e) => { e.stopPropagation(); navigate(`/mentor/evaluate/${m.id}`) }}
              >
                <ClipboardEdit size={16} /> Nilai Sekarang
              </button>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <MahasiswaCreateModal
          mentorId={user.uid}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchMahasiswa() }}
        />
      )}
    </div>
  )
}

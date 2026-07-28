import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, orderBy, getDoc, doc } from 'firebase/firestore'
import { db } from '../../../lib/firebase.js'
import { useAuth } from '../../auth/context/AuthContext.jsx'
import { TrendingUp, BookOpen, CalendarCheck, CheckCircle2, RotateCcw, Download } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import toast from 'react-hot-toast'
import './MahasiswaDashboard.css'

export default function MahasiswaDashboard() {
  const { user, userData } = useAuth()
  const [evaluations, setEvaluations] = useState([])
  const [attendances, setAttendances] = useState([])
  const [mentorName, setMentorName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch evaluations
        const q = query(
          collection(db, 'evaluations'),
          where('mahasiswaId', '==', user.uid),
          orderBy('createdAt', 'desc')
        )
        const snap = await getDocs(q)
        setEvaluations(snap.docs.map(d => ({ id: d.id, ...d.data() })))

        // Fetch attendance
        const attQ = query(
          collection(db, 'attendance'),
          where('mahasiswaId', '==', user.uid)
        )
        const attSnap = await getDocs(attQ)
        setAttendances(attSnap.docs.map(d => d.data()))

        // Fetch mentor name
        if (userData?.mentorId) {
          const mentorDoc = await getDoc(doc(db, 'users', userData.mentorId))
          if (mentorDoc.exists()) setMentorName(mentorDoc.data().name || 'Mentor')
        }
      } catch (err) {
        console.error('Error fetching data:', err)
        toast.error('Gagal memuat data. Periksa koneksi Anda.')
      }
      setLoading(false)
    }
    if (user) fetchData()
  }, [user, userData])

  const totalSesi = evaluations.length
  const lanjutCount = evaluations.filter(e => e.status === 'lanjut').length
  const progressPercent = totalSesi > 0 ? Math.round((lanjutCount / totalSesi) * 100) : 0

  // Calculate attendance stats
  const attStats = {
    hadir: attendances.filter(a => a.status === 'hadir').length,
    izin: attendances.filter(a => a.status === 'izin').length,
    sakit: attendances.filter(a => a.status === 'sakit').length,
    alpa: attendances.filter(a => a.status === 'alpa').length,
  }
  const totalAtt = attendances.length
  const attRate = totalAtt > 0 ? Math.round((attStats.hadir / totalAtt) * 100) : 0

  // Determine current level info
  const latestEval = evaluations[0]
  let levelLabel = userData?.level === 'iqro' ? 'Iqro' : "Al-Qur'an"
  let levelDetail = ''
  if (latestEval) {
    if (latestEval.level === 'iqro') {
      levelLabel = 'Iqro'
      levelDetail = `Jilid ${latestEval.jilid || '—'}, Hal. ${latestEval.halaman || '—'}`
    } else {
      levelLabel = "Al-Qur'an"
      levelDetail = `${latestEval.surah || ''} — Ayat ${latestEval.ayatFrom || ''}–${latestEval.ayatTo || ''}`
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner spinner-lg"></div><p>Memuat progres...</p></div>

  const handleExportPdf = () => {
    if (evaluations.length === 0) {
      toast.error('Belum ada riwayat evaluasi untuk diunduh.', { duration: 4000 })
      return
    }

    const doc = new jsPDF()
    
    // Header
    doc.setFontSize(16)
    doc.text('Laporan Hasil Evaluasi Tahsin', 14, 20)
    
    doc.setFontSize(11)
    doc.text(`Nama Mahasiswa: ${userData?.name || '—'}`, 14, 30)
    doc.text(`NIM: ${userData?.nim || userData?.email || '—'}`, 14, 36)
    doc.text(`Mentor Pembimbing: ${mentorName || '—'}`, 14, 42)
    doc.text(`Level Saat Ini: ${levelLabel}`, 14, 48)

    // Summary Section
    doc.text('Ringkasan Kehadiran & Evaluasi:', 14, 60)
    doc.setFontSize(10)
    doc.text(`Kehadiran: ${attRate}% (${attStats.hadir} Hadir, ${attStats.izin} Izin, ${attStats.sakit} Sakit, ${attStats.alpa} Alpa)`, 14, 66)
    doc.text(`Total Evaluasi: ${totalSesi} Sesi (${lanjutCount} Lanjut, ${totalSesi - lanjutCount} Ulang)`, 14, 72)

    // Table
    const tableData = [...evaluations].reverse().map((ev, index) => {
      const materi = ev.level === 'iqro' 
        ? `Iqro Jilid ${ev.jilid}, Hal ${ev.halaman}`
        : `Al-Qur'an Juz ${ev.juz}, Surah ${ev.surah}`
      
      const scores = ev.scores || {}
      
      let coreScoreTotal = 0
      let rincianArr = []
      
      if (ev.level === 'iqro') {
        if (ev.metrics) {
          ev.metrics.forEach(m => {
            coreScoreTotal += m.score
            rincianArr.push(`${m.label}: ${m.score}`)
          })
        } else {
          coreScoreTotal = (scores.huruf || 0) + (scores.harokat || 0) + (scores.sambung || 0)
          if(scores.huruf) rincianArr.push(`Huruf: ${scores.huruf}`)
          if(scores.harokat) rincianArr.push(`Harokat: ${scores.harokat}`)
          if(scores.sambung) rincianArr.push(`Sambung: ${scores.sambung}`)
        }
      } else {
        coreScoreTotal = (scores.makharij || 0) + (scores.tajwid || 0) + (scores.kelancaran || 0)
        if(scores.makharij) rincianArr.push(`Makharij: ${scores.makharij}`)
        if(scores.tajwid) rincianArr.push(`Tajwid: ${scores.tajwid}`)
        if(scores.kelancaran) rincianArr.push(`Kelancaran: ${scores.kelancaran}`)
      }

      return [
        index + 1,
        new Date(ev.createdAt).toLocaleDateString('id-ID'),
        materi,
        ev.status === 'lanjut' ? 'Lanjut' : 'Ulang',
        coreScoreTotal,
        scores.adab || '-',
        rincianArr.join(', \n') || '-'
      ]
    })

    autoTable(doc, {
      head: [['No', 'Tanggal', 'Materi', 'Status', 'Total Skor', 'Adab', 'Rincian Penilaian']],
      body: tableData,
      startY: 80,
    })

    doc.save(`Laporan_Tahsin_${userData?.name?.replace(/\s+/g, '_') || 'Mahasiswa'}.pdf`)
  }

  return (
    <div className="mahasiswa-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Dashboard Saya</h1>
          {mentorName && <p className="mentor-label">Mentor: <strong>{mentorName}</strong></p>}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleExportPdf} style={{ background: '#ef4444' }}>
          <Download size={16} /> Unduh Laporan PDF
        </button>
      </div>

      {/* Progress Overview */}
      <div className="glass-card progress-overview">
        <div className="progress-header">
          <TrendingUp size={20} />
          <span>Tingkat Kelulusan (Pass Rate)</span>
        </div>
        <div className="progress-level">
          <span className="progress-level-name">{levelLabel}</span>
          {levelDetail && <span className="progress-level-detail">{levelDetail}</span>}
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${progressPercent}%` }}>
            <span className="progress-bar-text">{progressPercent}%</span>
          </div>
        </div>
        <div className="progress-stats">
          <div className="progress-stat">
            <CalendarCheck size={16} />
            <span>Total Evaluasi: <strong>{totalSesi}</strong></span>
          </div>
          <div className="progress-stat">
            <CheckCircle2 size={16} />
            <span>Lanjut: <strong>{lanjutCount}</strong></span>
          </div>
          <div className="progress-stat">
            <RotateCcw size={16} />
            <span>Ulang: <strong>{totalSesi - lanjutCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Attendance Stats */}
      <div className="glass-card" style={{ padding: 24, marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '150px' }}>
          <h3 style={{ fontSize: 'var(--fs-caption)', color: 'var(--clr-text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><CalendarCheck size={16} /> Persentase Kehadiran</h3>
          <div style={{ fontSize: '24px', fontWeight: 800, color: attRate >= 80 ? 'var(--clr-success)' : 'var(--clr-warning)' }}>{attRate}%</div>
          <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--clr-text-light)' }}>Total {totalAtt} Pertemuan</div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', flex: 2 }}>
          <div style={{ flex: 1, textAlign: 'center', background: 'var(--clr-bg-primary)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--clr-success)' }}>{attStats.hadir}</div>
            <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hadir</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', background: 'var(--clr-bg-primary)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--clr-primary)' }}>{attStats.izin}</div>
            <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Izin</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', background: 'var(--clr-bg-primary)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--clr-warning)' }}>{attStats.sakit}</div>
            <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sakit</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', background: 'var(--clr-bg-primary)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--clr-danger)' }}>{attStats.alpa}</div>
            <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alpa</div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="timeline-section">
        <h2 className="section-title"><BookOpen size={20} /> Riwayat Evaluasi</h2>

        {evaluations.length === 0 ? (
          <div className="glass-card">
            <div className="empty-state">
              <BookOpen size={48} />
              <p>Belum ada evaluasi.</p>
            </div>
          </div>
        ) : (
          <div className="timeline">
            {evaluations.map((ev, idx) => (
              <TimelineItem key={ev.id} evaluation={ev} index={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TimelineItem({ evaluation: ev, index }) {
  const [expanded, setExpanded] = useState(false)
  const isLanjut = ev.status === 'lanjut'
  const date = ev.createdAt ? new Date(ev.createdAt).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric'
  }) : '—'

  let title = ''
  if (ev.level === 'iqro') {
    title = `Iqro Jilid ${ev.jilid || '—'}, Hal. ${ev.halaman || '—'}`
  } else {
    title = `${ev.surah || "Al-Qur'an"} — Ayat ${ev.ayatFrom || ''}–${ev.ayatTo || ''}`
  }

  const scores = ev.scores || {}
  
  // Render metrics based on new dynamic format or old hardcoded format
  let scoreEntries = []
  if (ev.level === 'iqro') {
    if (ev.metrics && Array.isArray(ev.metrics)) {
      scoreEntries = ev.metrics.map(m => [m.label, m.score])
    } else {
      // Fallback for old data
      scoreEntries = [['Huruf', scores.huruf], ['Harokat', scores.harokat], ['Sambung', scores.sambung]]
    }
  } else {
    scoreEntries = [['Makharij', scores.makharij], ['Tajwid', scores.tajwid], ['Kelancaran', scores.kelancaran]]
  }
  
  if (scores.adab != null) scoreEntries.push(['Adab', scores.adab])

  return (
    <div
      className={`timeline-item ${isLanjut ? 'lanjut' : 'ulang'}`}
      style={{ animationDelay: `${index * 0.08}s` }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="timeline-dot">
        {isLanjut ? <CheckCircle2 size={16} /> : <RotateCcw size={16} />}
      </div>
      <div className="timeline-content glass-card">
        <div className="timeline-head">
          <span className="timeline-date">{date}</span>
          <span className={`badge ${isLanjut ? 'badge-success' : 'badge-warning'}`}>
            {isLanjut ? 'Lanjut' : 'Ulang'}
          </span>
        </div>
        <div className="timeline-title">{title}</div>

        {expanded && (
          <div className="timeline-detail">
            <div className="timeline-scores">
              {scoreEntries.map(([label, val]) => (
                <div key={label} className="timeline-score">
                  <span>{label}</span>
                  <div className="mini-dots">
                    {[1,2,3,4,5].map(n => (
                      <span key={n} className={`mini-dot ${n <= (val || 0) ? 'filled' : ''}`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {ev.catatan && (
              <div className="timeline-note">
                <strong>Catatan:</strong> {ev.catatan}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

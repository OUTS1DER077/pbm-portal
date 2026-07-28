import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { doc, getDoc, collection, query, where, getDocs, addDoc, orderBy, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../../lib/firebase.js'
import { useAuth } from '../../auth/context/AuthContext.jsx'
import { ArrowLeft, UserCheck, CalendarDays, LineChart as ChartIcon, Plus, FileText, Target, Activity, Edit, Trash2, X, Download, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import './MahasiswaDetail.css'

export default function MahasiswaDetail() {
  const { mahasiswaId } = useParams()
  const [searchParams] = useSearchParams()
  const { user, userRole, userData } = useAuth()
  const navigate = useNavigate()
  const attendanceRef = useRef(null)

  const isMaster = userRole === 'master'

  const [mahasiswa, setMahasiswa] = useState(null)
  const [evaluations, setEvaluations] = useState([])
  const [attendances, setAttendances] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editNim, setEditNim] = useState('')
  const [editLevel, setEditLevel] = useState('iqro')

  const [activeTab, setActiveTab] = useState(searchParams.get('section') === 'absen' ? 'absen' : 'profil')

  useEffect(() => {
    async function fetchData() {
      if (!mahasiswaId) return
      try {
        // Fetch User Info
        const userSnap = await getDoc(doc(db, 'users', mahasiswaId))
        if (userSnap.exists()) setMahasiswa({ id: userSnap.id, ...userSnap.data() })

        // Fetch Evaluations
        const evalQ = query(
          collection(db, 'evaluations'),
          where('mahasiswaId', '==', mahasiswaId)
        )
        const evalSnap = await getDocs(evalQ)
        const evalData = evalSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        
        // Sort explicitly by createdAt to ensure correct chart order
        evalData.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        setEvaluations(evalData)

        // Fetch Attendances
        const attQ = query(
          collection(db, 'attendance'),
          where('mahasiswaId', '==', mahasiswaId)
        )
        const attSnap = await getDocs(attQ)
        setAttendances(attSnap.docs.map(d => ({ id: d.id, ...d.data() })))

      } catch (err) {
        console.error('Error fetching details:', err)
        toast.error('Gagal memuat data')
      }
      setLoading(false)
    }
    fetchData()
  }, [mahasiswaId])

  useEffect(() => {
    if (searchParams.get('section') === 'absen') {
      setActiveTab('absen')
    }
  }, [searchParams])

  const markAttendance = async (status) => {
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const alreadyAttended = attendances.find(a => a.date === today)
    
    if (alreadyAttended) {
      toast.error('Sudah absen hari ini!')
      return
    }

    try {
      const attData = {
        mahasiswaId,
        mentorId: user.uid,
        date: today,
        status,
        timestamp: new Date().toISOString()
      }
      const docRef = await addDoc(collection(db, 'attendance'), attData)
      setAttendances(prev => [...prev, { id: docRef.id, ...attData }])
      toast.success(`Berhasil ditandai: ${status.toUpperCase()}`)
    } catch (err) {
      console.error(err)
      toast.error('Gagal mencatat kehadiran')
    }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    try {
      await updateDoc(doc(db, 'users', mahasiswaId), { name: editName, nim: editNim, level: editLevel })
      setMahasiswa(prev => ({ ...prev, name: editName, nim: editNim, level: editLevel }))
      setShowEditModal(false)
      toast.success('Profil berhasil diperbarui')
    } catch (err) {
      console.error(err)
      toast.error('Gagal memperbarui profil')
    }
  }

  const handleDeleteAttendance = async (attId) => {
    if (!window.confirm('Hapus catatan kehadiran ini?')) return
    try {
      await deleteDoc(doc(db, 'attendance', attId))
      setAttendances(prev => prev.filter(a => a.id !== attId))
      toast.success('Kehadiran dihapus')
    } catch (err) {
      console.error(err)
      toast.error('Gagal menghapus kehadiran')
    }
  }

  const handleDelete = async () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus mahasiswa ini? Semua data evaluasi dan kehadiran juga akan terhapus secara permanen.')) {
      try {
        // Hapus data evaluasi
        const evalQ = query(collection(db, 'evaluations'), where('mahasiswaId', '==', mahasiswaId), where('mentorId', '==', user.uid));
        const evalSnap = await getDocs(evalQ);
        await Promise.all(evalSnap.docs.map(d => deleteDoc(d.ref)));

        // Hapus data kehadiran
        const attQ = query(collection(db, 'attendance'), where('mahasiswaId', '==', mahasiswaId), where('mentorId', '==', user.uid));
        const attSnap = await getDocs(attQ);
        await Promise.all(attSnap.docs.map(d => deleteDoc(d.ref)));

        // Hapus data user
        await deleteDoc(doc(db, 'users', mahasiswaId))
        toast.success('Mahasiswa beserta datanya berhasil dihapus')
        navigate('/mentor', { replace: true })
      } catch (err) {
        console.error('Delete error:', err)
        toast.error(`Gagal menghapus: ${err.code || err.message}`)
      }
    }
  }

  const handleDeleteEval = async (evalId) => {
    if (!window.confirm('Yakin ingin menghapus evaluasi ini?')) return
    try {
      await deleteDoc(doc(db, 'evaluations', evalId))
      setEvaluations(prev => prev.filter(e => e.id !== evalId))
      toast.success('Evaluasi berhasil dihapus')
    } catch (err) {
      console.error(err)
      toast.error('Gagal menghapus evaluasi')
    }
  }

  // Format chart data: normalize scores to percentage (0-100%)
  const chartData = evaluations.map((e, index) => {
    let coreTotal = 0
    let maxPossible = 0

    if (e.level === 'iqro' && e.metrics) {
      e.metrics.forEach(m => {
        coreTotal += m.score || 0
      })
      maxPossible = e.metrics.length * 5
    } else {
      const scores = e.scores || {}
      const coreKeys = Object.keys(scores).filter(k => k !== 'adab')
      coreTotal = coreKeys.reduce((sum, k) => sum + (scores[k] || 0), 0)
      maxPossible = coreKeys.length * 5
    }
    
    const pct = maxPossible > 0 ? Math.round((coreTotal / maxPossible) * 100) : 0
    return {
      name: `Tes ${index + 1}`,
      score: pct,
      date: new Date(e.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      level: e.level === 'iqro' ? `Jilid ${e.jilid}` : `Juz ${e.juz}`
    }
  })

  // Calculate attendance stats
  const attStats = {
    hadir: attendances.filter(a => a.status === 'hadir').length,
    izin: attendances.filter(a => a.status === 'izin').length,
    sakit: attendances.filter(a => a.status === 'sakit').length,
    alpa: attendances.filter(a => a.status === 'alpa').length,
  }
  const totalAtt = attendances.length
  const attRate = totalAtt > 0 ? ((attStats.hadir / totalAtt) * 100).toFixed(0) : 0

  const avgPct = chartData.length > 0 
    ? (chartData.reduce((sum, d) => sum + d.score, 0) / chartData.length).toFixed(0)
    : 0

  // Smart predikat: check per-aspect weaknesses
  let predikat = "Belum Ada Data"
  let predikatColor = "var(--clr-text-muted)"
  let weakAspects = []
  if (evaluations.length > 0) {
    // Analyze last 3 evaluations for weakness detection
    const recentEvals = evaluations.slice(-3)
    const aspectTotals = {}
    const aspectCounts = {}
    const ASPECT_LABELS = { huruf: 'Penguasaan Huruf', harokat: 'Harokat', sambung: 'Menyambung Huruf', makharij: 'Makharijul Huruf', tajwid: 'Tajwid', kelancaran: 'Kelancaran' }
    
    recentEvals.forEach(e => {
      if (e.level === 'iqro' && e.metrics) {
        e.metrics.forEach(m => {
          aspectTotals[m.key] = (aspectTotals[m.key] || 0) + (m.score || 0)
          aspectCounts[m.key] = (aspectCounts[m.key] || 0) + 1
          if (!ASPECT_LABELS[m.key]) ASPECT_LABELS[m.key] = m.label
        })
      } else {
        const scores = e.scores || {}
        Object.entries(scores).forEach(([key, val]) => {
          if (key === 'adab') return
          aspectTotals[key] = (aspectTotals[key] || 0) + (val || 0)
          aspectCounts[key] = (aspectCounts[key] || 0) + 1
        })
      }
    })
    Object.entries(aspectTotals).forEach(([key, total]) => {
      const avg = total / aspectCounts[key]
      if (avg <= 2) weakAspects.push(ASPECT_LABELS[key] || key)
    })

    if (parseInt(avgPct) >= 80 && parseInt(attRate) >= 80 && weakAspects.length === 0) {
      predikat = "Sangat Baik (Siap Naik Level)"
      predikatColor = "var(--clr-success)"
    } else if (parseInt(avgPct) >= 60 && weakAspects.length === 0) {
      predikat = "Baik"
      predikatColor = "var(--clr-primary)"
    } else if (weakAspects.length > 0) {
      predikat = "Butuh Perhatian Khusus"
      predikatColor = "var(--clr-warning)"
    } else {
      predikat = "Cukup"
      predikatColor = "var(--clr-text-muted)"
    }
  }

  const handleExportPdf = () => {
    const doc = new jsPDF()
    
    // Header
    doc.setFontSize(16)
    doc.text('Laporan Hasil Evaluasi Tahsin', 14, 20)
    
    doc.setFontSize(11)
    doc.text(`Nama Mahasiswa: ${mahasiswa?.name || '—'}`, 14, 30)
    doc.text(`NIM: ${mahasiswa?.nim || mahasiswa?.email || '—'}`, 14, 36)
    doc.text(`Mentor Pembimbing: ${userData?.name || '—'}`, 14, 42)
    doc.text(`Level Saat Ini: ${mahasiswa?.level === 'iqro' ? 'Iqro' : "Al-Qur'an"}`, 14, 48)

    // Summary Section
    doc.text('Ringkasan Kehadiran & Evaluasi:', 14, 60)
    doc.setFontSize(10)
    doc.text(`Kehadiran: ${attRate}% (${attStats.hadir} Hadir, ${attStats.izin} Izin, ${attStats.sakit} Sakit, ${attStats.alpa} Alpa)`, 14, 66)
    const totalSesi = evaluations.length
    const lanjutCount = evaluations.filter(e => e.status === 'lanjut').length
    doc.text(`Total Evaluasi: ${totalSesi} Sesi (${lanjutCount} Lanjut, ${totalSesi - lanjutCount} Ulang) | Rata-rata Skor: ${avgPct}%`, 14, 72)
    doc.text(`Predikat: ${predikat}`, 14, 78)

    // Table
    const tableData = [...evaluations].map((ev, index) => {
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
      startY: 85,
    })

    doc.save(`Laporan_Tahsin_${mahasiswa?.name?.replace(/\s+/g, '_') || 'Mahasiswa'}.pdf`)
  }

  if (loading) return <div className="loading-screen"><div className="spinner spinner-lg"></div></div>

  return (
    <div className="mahasiswa-detail-page page-enter">
      <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        <ArrowLeft size={16} /> Kembali
      </button>

      {/* Profil Header */}
      <div className="glass-card profile-header">
        <div className="profile-header-left">
          <div className="avatar-circle avatar-lg">{(mahasiswa?.name || '?')[0].toUpperCase()}</div>
          <div>
            <h1 className="student-name">{mahasiswa?.name}</h1>
            <p className="student-nim">NIM: {mahasiswa?.nim || mahasiswa?.email}</p>
            <span className={`badge ${mahasiswa?.level === 'iqro' ? 'badge-accent' : 'badge-warning'}`} style={{ marginTop: 8, display: 'inline-block' }}>
              Level: {mahasiswa?.level === 'iqro' ? 'Iqro' : "Al-Qur'an"}
            </span>
          </div>
        </div>
        <div className="profile-header-right" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" style={{ padding: '8px 12px', background: '#ef4444', color: '#fff' }} onClick={handleExportPdf}>
            <Download size={16} /> Unduh Laporan PDF
          </button>
          {!isMaster && (
            <>
              <button className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={() => { setEditName(mahasiswa?.name); setEditNim(mahasiswa?.nim || mahasiswa?.email?.split('@')[0] || ''); setEditLevel(mahasiswa?.level || 'iqro'); setShowEditModal(true); }}>
                <Edit size={16} /> Edit
              </button>
              <button className="btn btn-secondary" style={{ color: 'var(--clr-accent)', borderColor: 'var(--clr-accent)', padding: '8px 12px' }} onClick={handleDelete}>
                <Trash2 size={16} /> Hapus
              </button>
              <button className="btn btn-primary" onClick={() => navigate(`/mentor/evaluate/${mahasiswaId}`)}>
                <Plus size={16} /> Evaluasi Baru
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'profil' ? 'active' : ''}`}
          onClick={() => setActiveTab('profil')}
        >
          <Target size={16} /> Profil & Evaluasi
        </button>
        <button 
          className={`tab-btn ${activeTab === 'absen' ? 'active' : ''}`}
          onClick={() => setActiveTab('absen')}
        >
          <CalendarDays size={16} /> Kehadiran (Absen)
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'profil' && (
          <div className="tab-pane page-enter">
            {/* Kesimpulan Kemampuan */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
              <h3 className="card-title" style={{ marginBottom: 16 }}><Target size={18} /> Kesimpulan Kemampuan</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--clr-bg-primary)', padding: 16, borderRadius: 'var(--radius-md)' }}>
                  <div style={{ background: 'var(--clr-primary-light)', color: 'var(--clr-primary)', padding: 12, borderRadius: 50 }}>
                    <Activity size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--clr-text-light)' }}>Rata-rata Nilai</div>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>{avgPct}%</div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--clr-bg-primary)', padding: 16, borderRadius: 'var(--radius-md)' }}>
                  <div style={{ background: 'var(--clr-success-light)', color: 'var(--clr-success)', padding: 12, borderRadius: 50 }}>
                    <CalendarDays size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--clr-text-light)' }}>Tingkat Kehadiran</div>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>{attRate}%</div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--clr-bg-primary)', padding: 16, borderRadius: 'var(--radius-md)' }}>
                  <div style={{ background: 'var(--clr-bg-tertiary)', color: predikatColor, padding: 12, borderRadius: 50 }}>
                    <UserCheck size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--clr-text-light)' }}>Predikat</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: predikatColor }}>{predikat}</div>
                    {weakAspects.length > 0 && (
                      <div style={{ fontSize: 'var(--fs-micro)', color: 'var(--clr-warning)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={12} /> Lemah: {weakAspects.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Grafik */}
            <div className="glass-card chart-card" style={{ marginBottom: 24 }}>
              <h3 className="card-title"><ChartIcon size={18} /> Grafik Perkembangan Nilai</h3>
              {chartData.length > 0 ? (
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} />
                      <YAxis tick={{fontSize: 12, fill: '#64748b'}} domain={[0, 100]} unit="%" />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value) => [`${value}%`, 'Skor']}
                        labelFormatter={(label, payload) => payload[0] ? `${payload[0].payload.date} (${payload[0].payload.level})` : label}
                      />
                      <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-chart">
                  <FileText size={32} />
                  <p>Belum ada riwayat evaluasi.</p>
                </div>
              )}
            </div>

            {/* Riwayat Evaluasi List */}
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 className="card-title" style={{ marginBottom: 16 }}><FileText size={18} /> Riwayat Evaluasi Lengkap</h3>
              {evaluations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[...evaluations].reverse().map((ev, idx) => {
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
                    <div key={ev.id} style={{ padding: 16, background: 'var(--clr-bg-primary)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '12px', color: 'var(--clr-text-muted)', marginBottom: 4 }}>
                            {new Date(ev.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </div>
                          <div style={{ fontWeight: 600 }}>
                            {ev.level === 'iqro' 
                              ? `Iqro Jilid ${ev.jilid}, Hal ${ev.halaman}` 
                              : `Al-Qur'an Juz ${ev.juz}, Surah ${ev.surah}`}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--clr-text-light)', marginTop: 4 }}>
                            Status: <span style={{ color: ev.status === 'lanjut' ? 'var(--clr-success)' : 'var(--clr-warning)', fontWeight: 600 }}>{ev.status === 'lanjut' ? 'Lanjut' : 'Ulang'}</span>
                          </div>
                        </div>
                        {!isMaster && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" style={{ padding: '8px', color: 'var(--clr-primary)', background: 'var(--clr-primary-bg)' }} onClick={() => navigate(`/mentor/evaluate/${mahasiswaId}?edit=${ev.id}`)} title="Edit Evaluasi">
                              <Edit size={16} />
                            </button>
                            <button className="btn btn-secondary btn-sm" style={{ padding: '8px', color: 'var(--clr-danger)', background: 'var(--clr-danger-bg)' }} onClick={() => handleDeleteEval(ev.id)} title="Hapus Evaluasi">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Detail Skor */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                        {scoreEntries.map(([label, val]) => (
                          <span key={label} style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: label === 'Adab' ? 'var(--clr-bg-tertiary)' : (val <= 2 ? 'var(--clr-danger-bg)' : val <= 3 ? 'var(--clr-warning-bg)' : 'var(--clr-success-bg)'), color: label === 'Adab' ? 'var(--clr-text-muted)' : (val <= 2 ? 'var(--clr-danger)' : val <= 3 ? 'var(--clr-warning)' : 'var(--clr-success)') }}>
                            {label}: {val}/5
                          </span>
                        ))}
                      </div>
                      {ev.catatan && (
                        <div style={{ fontSize: '12px', color: 'var(--clr-text-muted)', marginTop: 8, fontStyle: 'italic' }}>
                          📝 {ev.catatan}
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <FileText size={32} />
                  <p>Belum ada riwayat evaluasi.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'absen' && (
          <div className="tab-pane page-enter">
            <div className="attendance-layout">
              {/* Kolom Kiri: Aksi & Statistik */}
              <div className="glass-card attendance-action-card" ref={attendanceRef}>
                <h3 className="card-title"><CalendarDays size={18} /> Kehadiran Hari Ini</h3>
                <p className="card-subtitle">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                
                {!isMaster && (
                  <div className="attendance-buttons">
                    <button className="att-btn btn-hadir" onClick={() => markAttendance('hadir')}>Hadir</button>
                    <button className="att-btn btn-izin" onClick={() => markAttendance('izin')}>Izin</button>
                    <button className="att-btn btn-sakit" onClick={() => markAttendance('sakit')}>Sakit</button>
                    <button className="att-btn btn-alpa" onClick={() => markAttendance('alpa')}>Alpa</button>
                  </div>
                )}

                <div className="attendance-stats">
                  <div className="att-stat"><span className="stat-num hadir">{attStats.hadir}</span>Hadir</div>
                  <div className="att-stat"><span className="stat-num izin">{attStats.izin}</span>Izin</div>
                  <div className="att-stat"><span className="stat-num sakit">{attStats.sakit}</span>Sakit</div>
                  <div className="att-stat"><span className="stat-num alpa">{attStats.alpa}</span>Alpa</div>
                </div>
              </div>

              {/* Kolom Kanan: Riwayat */}
              <div className="glass-card attendance-history-card">
                <h3 className="card-title" style={{ marginBottom: 20 }}><FileText size={18} /> Riwayat Kehadiran</h3>
                {attendances.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '400px', overflowY: 'auto', paddingRight: 4 }} className="custom-scrollbar">
                    {[...attendances].sort((a,b) => new Date(b.date) - new Date(a.date)).map(att => (
                      <div key={att.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--clr-bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-bg-tertiary)' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600 }}>{new Date(att.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                          <div style={{ fontSize: '12px', color: 'var(--clr-text-light)', marginTop: 4 }}>
                            Status: <span style={{ fontWeight: 800, textTransform: 'uppercase', color: att.status === 'hadir' ? 'var(--clr-success)' : att.status === 'alpa' ? 'var(--clr-danger)' : att.status === 'sakit' ? 'var(--clr-warning)' : 'var(--clr-primary)' }}>{att.status}</span>
                          </div>
                        </div>
                        {!isMaster && (
                          <button className="btn btn-secondary btn-sm" style={{ padding: 8, color: 'var(--clr-danger)', background: 'var(--clr-danger-bg)' }} onClick={() => handleDeleteAttendance(att.id)} title="Hapus Absensi">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <CalendarDays size={32} />
                    <p>Belum ada data kehadiran.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Profil Mahasiswa</h2>
              <button className="sidebar-toggle" onClick={() => setShowEditModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nama Lengkap</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>NIM</label>
                  <input value={editNim} onChange={e => setEditNim(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Level</label>
                  <select value={editLevel} onChange={e => setEditLevel(e.target.value)} required>
                    <option value="iqro">Iqro</option>
                    <option value="quran">Al-Qur'an</option>
                  </select>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--clr-text-light)', marginTop: 8, fontStyle: 'italic' }}>
                  Catatan: Perubahan password harus dilakukan oleh admin Master.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

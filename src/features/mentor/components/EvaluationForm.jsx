import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { doc, getDoc, addDoc, updateDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../../../lib/firebase.js'
import { useAuth } from '../../auth/context/AuthContext.jsx'
import { ArrowLeft, Save, CheckCircle2, RotateCcw, Info } from 'lucide-react'
import { surahList } from '../../../shared/data/surahData.js'
import { iqroCurriculum, RUBRIK_GENERIC } from '../../../shared/data/iqroCurriculum.js'
import toast from 'react-hot-toast'
import './EvaluationForm.css'

// Hapus RUBRIK_IQRO lama karena sudah diganti dengan iqroCurriculum dan RUBRIK_GENERIC

const RUBRIK_QURAN = {
  makharij: {
    1: 'Pengucapan huruf sangat tidak tepat dari tempat keluarnya',
    2: 'Beberapa huruf keluar dari makhraj yang benar, banyak yang salah',
    3: 'Sebagian besar huruf sudah tepat, beberapa masih perlu koreksi',
    4: 'Makhraj hampir sempurna, hanya sesekali kurang tepat',
    5: 'Seluruh makhraj huruf sempurna dan fasih',
  },
  tajwid: {
    1: 'Belum memahami hukum tajwid dasar',
    2: 'Mengenal beberapa hukum tajwid tapi jarang diterapkan',
    3: 'Menerapkan tajwid dasar (nun mati, mim mati) dengan cukup baik',
    4: 'Menguasai tajwid dengan baik, kesalahan sangat jarang',
    5: 'Menerapkan seluruh hukum tajwid dengan sempurna dan konsisten',
  },
  kelancaran: {
    1: 'Sangat terbata-bata, sering berhenti lama',
    2: 'Terbata-bata, tempo tidak stabil',
    3: 'Cukup lancar dengan tempo yang kadang tidak konsisten',
    4: 'Lancar dengan tempo yang baik dan konsisten',
    5: 'Sangat lancar, tartil, tempo sempurna sesuai kaidah',
  },
}

const RUBRIK_ADAB = {
  1: 'Perlu bimbingan khusus dalam adab mengaji',
  2: 'Adab kurang baik, sering tidak fokus atau bermain',
  3: 'Adab cukup baik, sesekali kurang fokus',
  4: 'Adab baik, sopan dan fokus selama mengaji',
  5: 'Adab sangat baik, khusyuk, sopan, dan menjadi teladan',
}

const SKOR_LABELS = {
  1: 'Sangat Kurang',
  2: 'Kurang',
  3: 'Cukup',
  4: 'Baik',
  5: 'Sangat Baik',
}

export default function EvaluationForm() {
  const { mahasiswaId } = useParams()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const { user } = useAuth()
  const navigate = useNavigate()

  const [mahasiswa, setMahasiswa] = useState(null)
  const [level, setLevel] = useState('iqro')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [evalDate, setEvalDate] = useState(new Date().toISOString().split('T')[0])
  const [lastEval, setLastEval] = useState(null)

  // Iqro fields
  const [jilid, setJilid] = useState('1')
  const [halaman, setHalaman] = useState('')
  const [iqroMetrics, setIqroMetrics] = useState({}) // menampung nilai dinamis per kriteria

  // Quran fields
  const [juz, setJuz] = useState('1')
  const [surah, setSurah] = useState('')
  const [ayatFrom, setAyatFrom] = useState('')
  const [ayatTo, setAyatTo] = useState('')
  const [makharij, setMakharij] = useState(0)
  const [tajwid, setTajwid] = useState(0)
  const [kelancaran, setKelancaran] = useState(0)

  // Common
  const [adab, setAdab] = useState(0)
  const [status, setStatus] = useState('lanjut')
  const [catatan, setCatatan] = useState('')

  useEffect(() => {
    async function fetchMahasiswa() {
      if (!mahasiswaId) { setLoading(false); return }
      try {
        const snap = await getDoc(doc(db, 'users', mahasiswaId))
        if (snap.exists()) {
          const data = snap.data()
          setMahasiswa({ id: snap.id, ...data })
          setLevel(data.level || 'iqro')

          // Ambil riwayat evaluasi terakhir
          const q = query(
            collection(db, 'evaluations'),
            where('mahasiswaId', '==', mahasiswaId),
            orderBy('createdAt', 'desc'),
            limit(1)
          )
          const evalSnap = await getDocs(q)
          if (!evalSnap.empty) {
            setLastEval(evalSnap.docs[0].data())
          }
        }

        // Jika mode edit, muat data evaluasi yang ada
        if (editId) {
          const editSnap = await getDoc(doc(db, 'evaluations', editId))
          if (editSnap.exists()) {
            const ed = editSnap.data()
            setLevel(ed.level || 'iqro')
            setStatus(ed.status || 'lanjut')
            setCatatan(ed.catatan || '')
            setAdab(ed.scores?.adab || 0)
            setEvalDate(ed.createdAt ? ed.createdAt.split('T')[0] : new Date().toISOString().split('T')[0])

            if (ed.level === 'iqro') {
              setJilid(String(ed.jilid || '1'))
              setHalaman(ed.halaman || '')
              
              // Restore dynamic metrics if available, otherwise reconstruct from old scores for fallback
              if (ed.metrics) {
                const loadedMetrics = {}
                ed.metrics.forEach(m => { loadedMetrics[m.key] = m.score })
                setIqroMetrics(loadedMetrics)
              } else if (ed.scores) {
                // Fallback for old records (will just show empty if jilid > 1 and keys don't match)
                setIqroMetrics({ huruf: ed.scores.huruf, harokat: ed.scores.harokat, sambung: ed.scores.sambung })
              }
            } else {
              setJuz(String(ed.juz || '1'))
              setSurah(ed.surah || '')
              setAyatFrom(String(ed.ayatFrom || ''))
              setAyatTo(String(ed.ayatTo || ''))
              setMakharij(ed.scores?.makharij || 0)
              setTajwid(ed.scores?.tajwid || 0)
              setKelancaran(ed.scores?.kelancaran || 0)
            }
          }
        }
      } catch (err) {
        console.error('Error:', err)
      }
      setLoading(false)
    }
    fetchMahasiswa()
  }, [mahasiswaId, editId])

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validasi skor
    if (level === 'iqro') {
      const currentCurriculum = iqroCurriculum[jilid]
      const hasUnscored = currentCurriculum.some(c => !iqroMetrics[c.key] || iqroMetrics[c.key] === 0)
      if (hasUnscored) {
        return toast.error('Harap berikan nilai pada semua kriteria (minimal 1).')
      }
    } else {
      if (makharij === 0 || tajwid === 0 || kelancaran === 0) {
        return toast.error('Harap berikan semua nilai penilaian (minimal 1).')
      }
      if (parseInt(ayatFrom) > parseInt(ayatTo)) {
        return toast.error('Ayat awal tidak boleh lebih besar dari ayat akhir.')
      }
    }

    if (adab === 0) {
      return toast.error('Harap berikan nilai Adab/Akhlak (minimal 1).')
    }

    // Proteksi duplikat: cek apakah sudah ada evaluasi di tanggal yang sama (hanya untuk create, bukan edit)
    if (!editId) {
      try {
        const dupQ = query(
          collection(db, 'evaluations'),
          where('mahasiswaId', '==', mahasiswaId),
          where('mentorId', '==', user.uid)
        )
        const dupSnap = await getDocs(dupQ)
        const targetDate = evalDate
        const alreadyExists = dupSnap.docs.some(d => {
          const existingDate = d.data().createdAt?.split('T')[0]
          return existingDate === targetDate
        })
        if (alreadyExists) {
          return toast.error('Sudah ada evaluasi untuk mahasiswa ini di tanggal tersebut. Gunakan fitur edit jika ingin mengubah.')
        }
      } catch (err) {
        console.error('Duplikat check error:', err)
      }
    }

    setSaving(true)

    const finalDate = evalDate === new Date().toISOString().split('T')[0] 
      ? new Date().toISOString() 
      : new Date(evalDate).toISOString()

    const evalData = {
      mahasiswaId,
      mentorId: user.uid,
      level,
      status,
      catatan,
      createdAt: finalDate,
    }

    if (level === 'iqro') {
      const currentCurriculum = iqroCurriculum[jilid]
      // Simpan format array untuk riwayat masa depan yang kebal perubahan
      const metricsArray = currentCurriculum.map(c => ({
        key: c.key,
        label: c.label,
        score: iqroMetrics[c.key] || 0
      }))

      Object.assign(evalData, {
        jilid: parseInt(jilid),
        halaman: halaman,
        metrics: metricsArray, // Format baru yang dinamis
        scores: { adab } // Hapus skor kaku, sisakan adab di object scores
      })
    } else {
      Object.assign(evalData, {
        juz: parseInt(juz),
        surah,
        ayatFrom: parseInt(ayatFrom),
        ayatTo: parseInt(ayatTo),
        scores: { makharij, tajwid, kelancaran, adab }
      })
    }

    try {
      if (editId) {
        // Mode edit: update dokumen yang sudah ada
        await updateDoc(doc(db, 'evaluations', editId), evalData)
        toast.success('Evaluasi berhasil diperbarui!')
      } else {
        // Mode baru: tambah dokumen baru
        await addDoc(collection(db, 'evaluations'), evalData)
        toast.success('Evaluasi berhasil disimpan!')
      }

      // Update mahasiswa level if changed
      if (mahasiswa && mahasiswa.level !== level) {
        await updateDoc(doc(db, 'users', mahasiswaId), { level })
      }

      setSuccess(true)
      setTimeout(() => navigate(`/mentor/mahasiswa/${mahasiswaId}`), 1500)
    } catch (err) {
      console.error('Error saving evaluation:', err)
      toast.error('Gagal menyimpan evaluasi. Coba lagi.')
    }
    setSaving(false)
  }

  const selectedSurah = surahList.find(s => s.name === surah)
  const maxAyat = selectedSurah ? selectedSurah.ayat : 999

  if (loading) return <div className="loading-screen"><div className="spinner spinner-lg"></div><p>Memuat data...</p></div>

  if (success) {
    return (
      <div className="loading-screen">
        <CheckCircle2 size={64} style={{ color: 'var(--clr-success)' }} />
        <p style={{ color: 'var(--clr-success)', fontWeight: 600 }}>
          {editId ? 'Evaluasi berhasil diperbarui!' : 'Evaluasi berhasil disimpan!'}
        </p>
      </div>
    )
  }

  return (
    <div className="eval-page page-enter">
      <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        <ArrowLeft size={16} /> Kembali
      </button>

      <h1 className="page-title">
        {editId ? '✏️ Edit' : '📋 Evaluasi'}: {mahasiswa?.name || 'Mahasiswa'}
      </h1>

      {lastEval && !editId && (
        <div className="glass-card eval-section" style={{ padding: '16px', marginBottom: '20px', backgroundColor: 'var(--clr-bg-tertiary)' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--clr-text-muted)', marginBottom: '4px' }}>
            RIWAYAT TERAKHIR ({new Date(lastEval.createdAt).toLocaleDateString('id-ID')})
          </div>
          <div style={{ fontSize: '14px', color: 'var(--clr-text-main)' }}>
            {lastEval.level === 'iqro' 
              ? `Iqro Jilid ${lastEval.jilid}, Halaman ${lastEval.halaman}`
              : `Al-Qur'an Juz ${lastEval.juz}, Surah ${lastEval.surah} (${lastEval.ayatFrom}-${lastEval.ayatTo})`}
            <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', backgroundColor: lastEval.status === 'lanjut' ? 'var(--clr-success-bg)' : 'var(--clr-accent-bg)', color: lastEval.status === 'lanjut' ? 'var(--clr-success-dark)' : 'var(--clr-accent-dark)' }}>
              {lastEval.status === 'lanjut' ? 'Lanjut' : 'Ulang'}
            </span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="eval-form">
        {/* Level Toggle & Date */}
        <div className="glass-card eval-section">
          <div className="eval-fields-row" style={{ alignItems: 'flex-end' }}>
            <div>
              <label className="eval-section-label">Level</label>
              <div className="level-toggle">
                <button type="button" className={`level-option ${level === 'iqro' ? 'active' : ''}`} onClick={() => setLevel('iqro')}>
                  Iqro
                </button>
                <button type="button" className={`level-option ${level === 'quran' ? 'active' : ''}`} onClick={() => setLevel('quran')}>
                  Al-Qur'an
                </button>
              </div>
            </div>
            <div>
              <label className="eval-section-label">Tanggal Evaluasi</label>
              <input 
                type="date" 
                value={evalDate} 
                onChange={e => setEvalDate(e.target.value)} 
                required
                style={{ width: '100%', padding: '12.5px 16px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--clr-bg-primary)', color: 'var(--clr-text-main)', fontSize: 'var(--fs-body)', fontWeight: 600, outline: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* Conditional Fields */}
        <div className="glass-card eval-section">
          {level === 'iqro' ? (
            <div className="eval-fields">
              <div className="eval-fields-row">
                <div className="form-group">
                  <label>Jilid</label>
                  <select 
                    value={jilid} 
                    onChange={e => {
                      setJilid(e.target.value)
                      setIqroMetrics({}) // Reset nilai saat jilid diubah agar tidak ada nilai nyasar
                    }} 
                    required
                  >
                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>Jilid {n}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Halaman</label>
                  <input type="text" value={halaman} onChange={e => setHalaman(e.target.value)} placeholder="Misal: 15-18" required />
                </div>
              </div>

              <div className="eval-ratings">
                <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--clr-primary-bg)', color: 'var(--clr-primary-dark)', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 500 }}>
                  🎯 Fokus Penilaian Jilid {jilid}
                </div>
                {iqroCurriculum[jilid].map(item => (
                  <RatingInput 
                    key={item.key}
                    label={item.label} 
                    value={iqroMetrics[item.key] || 0} 
                    onChange={(val) => setIqroMetrics(prev => ({ ...prev, [item.key]: val }))} 
                    rubrik={RUBRIK_GENERIC}
                    desc={item.desc}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="eval-fields">
              <div className="eval-fields-row">
                <div className="form-group">
                  <label>Juz</label>
                  <select value={juz} onChange={e => setJuz(e.target.value)} required>
                    {Array.from({length:30}, (_,i) => i+1).map(n => <option key={n} value={n}>Juz {n}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Surah</label>
                  <select value={surah} onChange={e => setSurah(e.target.value)} required>
                    <option value="">Pilih Surah</option>
                    {surahList.map(s => <option key={s.number} value={s.name}>{s.number}. {s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="eval-fields-row">
                <div className="form-group">
                  <label>Ayat Dari</label>
                  <input type="number" min="1" max={maxAyat} value={ayatFrom} onChange={e => setAyatFrom(e.target.value)} placeholder="1" required />
                </div>
                <div className="form-group">
                  <label>Ayat Sampai</label>
                  <input type="number" min="1" max={maxAyat} value={ayatTo} onChange={e => setAyatTo(e.target.value)} placeholder={String(maxAyat)} required />
                </div>
              </div>

              <div className="eval-ratings">
                <RatingInput label="Makharijul Huruf" value={makharij} onChange={setMakharij} rubrik={RUBRIK_QURAN.makharij} />
                <RatingInput label="Tajwid" value={tajwid} onChange={setTajwid} rubrik={RUBRIK_QURAN.tajwid} />
                <RatingInput label="Kelancaran / Tempo" value={kelancaran} onChange={setKelancaran} rubrik={RUBRIK_QURAN.kelancaran} />
              </div>
            </div>
          )}
        </div>

        {/* Aspek Adab / Akhlak — Universal */}
        <div className="glass-card eval-section">
          <label className="eval-section-label">🤲 Adab & Akhlak Mengaji</label>
          <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--clr-text-muted)', marginBottom: 16, marginTop: -8 }}>
            Penilaian sikap dan kesopanan mahasiswa selama proses pembelajaran.
          </p>
          <div className="eval-ratings" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
            <RatingInput label="Adab / Akhlak" value={adab} onChange={setAdab} rubrik={RUBRIK_ADAB} />
          </div>
        </div>

        {/* Status & Catatan */}
        <div className="glass-card eval-section">
          <label className="eval-section-label">Status</label>
          <div className="status-toggle">
            <button type="button" className={`status-option lanjut ${status === 'lanjut' ? 'active' : ''}`} onClick={() => setStatus('lanjut')}>
              <CheckCircle2 size={18} /> Lanjut
            </button>
            <button type="button" className={`status-option ulang ${status === 'ulang' ? 'active' : ''}`} onClick={() => setStatus('ulang')}>
              <RotateCcw size={18} /> Ulang
            </button>
          </div>

          <div className="form-group" style={{ marginTop: 16 }}>
            <label>Catatan Mentor</label>
            <textarea
              rows={3}
              value={catatan}
              onChange={e => setCatatan(e.target.value)}
              placeholder="Catatan perkembangan mahasiswa..."
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={saving}>
          {saving ? <div className="spinner"></div> : <><Save size={20} /> {editId ? 'Perbarui Evaluasi' : 'Simpan Evaluasi'}</>}
        </button>
      </form>
    </div>
  )
}

/* Rating Component with Rubrik Tooltip */
function RatingInput({ label, value, onChange, rubrik, desc }) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="rating-group">
      <div className="rating-label-row">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="rating-label">{label}</span>
          {desc && <span style={{ fontSize: '11px', color: 'var(--clr-text-muted)', marginTop: '2px' }}>{desc}</span>}
        </div>
        <button 
          type="button" 
          className="rubrik-info-btn"
          onClick={() => setShowTooltip(!showTooltip)}
          title="Lihat rubrik penilaian"
        >
          <Info size={14} />
        </button>
      </div>
      <div className="rating-dots">
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            type="button"
            className={`rating-dot ${n <= value ? 'active' : ''}`}
            onClick={() => onChange(n)}
            title={rubrik?.[n] || ''}
          >
            {n}
          </button>
        ))}
      </div>
      <span className="rating-value">{value}/5</span>
      
      {/* Deskripsi level yang dipilih */}
      {value > 0 && (
        <div className="rating-description">
          <span className="rating-level-badge" data-level={value}>{SKOR_LABELS[value]}</span>
          <span className="rating-desc-text">{rubrik?.[value]}</span>
        </div>
      )}

      {/* Tooltip rubrik lengkap */}
      {showTooltip && (
        <div className="rubrik-tooltip">
          <div className="rubrik-tooltip-header">
            <strong>Rubrik: {label}</strong>
            <button type="button" onClick={() => setShowTooltip(false)} className="rubrik-close">✕</button>
          </div>
          {[1,2,3,4,5].map(n => (
            <div key={n} className={`rubrik-item ${n === value ? 'current' : ''}`}>
              <span className="rubrik-score" data-level={n}>{n}</span>
              <div>
                <strong>{SKOR_LABELS[n]}</strong>
                <p>{rubrik?.[n]}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore'
import { db } from '../../../lib/firebase.js'
import { Users as UsersIcon, Search, Filter, Download, ArrowRightLeft, Edit, Trash2, X, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export default function MasterMahasiswaList() {
  const navigate = useNavigate()
  const [mahasiswa, setMahasiswa] = useState([])
  const [mentors, setMentors] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMentor, setFilterMentor] = useState('semua')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editMahasiswa, setEditMahasiswa] = useState(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch all mentors
        const mQ = query(collection(db, 'users'), where('role', '==', 'mentor'))
        const mSnap = await getDocs(mQ)
        const mentorList = mSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        setMentors(mentorList)

        // Fetch all mahasiswa
        const sQ = query(collection(db, 'users'), where('role', '==', 'mahasiswa'))
        const sSnap = await getDocs(sQ)
        setMahasiswa(sSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error('Error fetching data:', err)
        toast.error('Gagal memuat data')
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const handleMutasi = async (mahasiswaId, newMentorId) => {
    try {
      await updateDoc(doc(db, 'users', mahasiswaId), { mentorId: newMentorId })
      setMahasiswa(prev => prev.map(m => m.id === mahasiswaId ? { ...m, mentorId: newMentorId } : m))
      toast.success('Berhasil memindahkan mahasiswa ke mentor baru')
    } catch (err) {
      console.error(err)
      toast.error('Gagal memindahkan mentor')
    }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    try {
      await updateDoc(doc(db, 'users', editMahasiswa.id), { name: editName })
      setMahasiswa(prev => prev.map(m => m.id === editMahasiswa.id ? { ...m, name: editName } : m))
      setShowEditModal(false)
      toast.success('Nama mahasiswa berhasil diperbarui')
    } catch (err) {
      console.error(err)
      toast.error('Gagal memperbarui mahasiswa')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus mahasiswa ini secara permanen? Semua data evaluasi dan kehadirannya juga akan ikut terhapus.')) return
    try {
      // Hapus data evaluasi
      try {
        const evalQ = query(collection(db, 'evaluations'), where('mahasiswaId', '==', id));
        const evalSnap = await getDocs(evalQ);
        await Promise.all(evalSnap.docs.map(d => deleteDoc(d.ref)));
      } catch (e) {
        throw new Error(`Gagal hapus evaluasi: ${e.code || e.message}`);
      }

      // Hapus data kehadiran
      try {
        const attQ = query(collection(db, 'attendance'), where('mahasiswaId', '==', id));
        const attSnap = await getDocs(attQ);
        await Promise.all(attSnap.docs.map(d => deleteDoc(d.ref)));
      } catch (e) {
        throw new Error(`Gagal hapus kehadiran: ${e.code || e.message}`);
      }

      // Hapus user
      try {
        await deleteDoc(doc(db, 'users', id))
      } catch (e) {
        throw new Error(`Gagal hapus user DB: ${e.code || e.message}`);
      }

      setMahasiswa(prev => prev.filter(m => m.id !== id))
      toast.success('Mahasiswa beserta datanya berhasil dihapus')
    } catch (err) {
      console.error('Master Delete Error:', err)
      toast.error(`Master Gagal: ${err.message}`)
    }
  }

  const handleExport = () => {
    const doc = new jsPDF()
    doc.text("Laporan Data Semua Mahasiswa PBM", 14, 15)

    const tableData = filteredMahasiswa.map((m, index) => {
      const mentorObj = mentors.find(men => men.id === m.mentorId)
      return [
        index + 1,
        m.nim || m.email,
        m.name,
        m.level === 'iqro' ? 'Iqro' : "Al-Qur'an",
        mentorObj ? mentorObj.name : 'Tidak Ada',
        m.createdAt ? new Date(m.createdAt).toLocaleDateString('id-ID') : '-'
      ]
    })
    
    autoTable(doc, {
      head: [['No', 'NIM', 'Nama', 'Level', 'Mentor', 'Tanggal Daftar']],
      body: tableData,
      startY: 25,
    })
    
    doc.save("Data_Semua_Mahasiswa_PBM.pdf")
  }

  const handleExportExcel = () => {
    const tableData = filteredMahasiswa.map((m, index) => {
      const mentorObj = mentors.find(men => men.id === m.mentorId)
      return {
        No: index + 1,
        NIM: m.nim || m.email,
        Nama: m.name,
        Level: m.level === 'iqro' ? 'Iqro' : "Al-Qur'an",
        Mentor: mentorObj ? mentorObj.name : 'Tidak Ada',
        'Tanggal Daftar': m.createdAt ? new Date(m.createdAt).toLocaleDateString('id-ID') : '-'
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(tableData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Semua Mahasiswa");
    XLSX.writeFile(workbook, "Data_Semua_Mahasiswa_PBM.xlsx");
  }

  const filteredMahasiswa = mahasiswa
    .filter(m => 
      (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (m.nim || m.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(m => filterMentor === 'semua' || m.mentorId === filterMentor)

  return (
    <div className="mentor-list-section page-enter">
      <div className="section-header" style={{ flexWrap: 'wrap' }}>
        <h2 className="section-title">
          <UsersIcon size={20} />
          Manajemen Semua Mahasiswa
        </h2>
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
              value={filterMentor} 
              onChange={(e) => setFilterMentor(e.target.value)}
              className="search-input"
            >
              <option value="semua">Semua Mentor</option>
              {mentors.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleExport} style={{ background: '#ef4444' }}>
            <Download size={16} /> Export PDF
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExportExcel} style={{ background: '#10b981' }}>
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      <div className="glass-card mentor-table-card">
        {loading ? (
          <div className="empty-state"><div className="spinner"></div></div>
        ) : filteredMahasiswa.length === 0 ? (
          <div className="empty-state">
            <UsersIcon size={48} />
            <p>Tidak ada data mahasiswa ditemukan.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama & NIM</th>
                  <th>Level</th>
                  <th>Mentor Pembimbing</th>
                  <th>Aksi (Mutasi)</th>
                </tr>
              </thead>
              <tbody>
                {filteredMahasiswa.map(m => {
                  const currentMentor = mentors.find(men => men.id === m.mentorId)
                  return (
                    <tr key={m.id}>
                      <td className="td-name">
                        <div className="avatar-circle">{(m.name || '?')[0].toUpperCase()}</div>
                        <div>
                          <div>{m.name || '—'}</div>
                          <div style={{ fontSize: '12px', color: 'var(--clr-text-light)' }}>{m.nim || m.email}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${m.level === 'iqro' ? 'badge-accent' : 'badge-warning'}`}>
                          {m.level === 'iqro' ? 'Iqro' : "Al-Qur'an"}
                        </span>
                      </td>
                      <td>
                        {currentMentor ? currentMentor.name : <span style={{color: 'red'}}>Mentor Terhapus</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <ArrowRightLeft size={16} style={{ color: 'var(--clr-primary)' }} />
                          <select 
                            className="search-input" 
                            style={{ border: '1px solid var(--clr-bg-tertiary)', borderRadius: '4px', padding: '4px' }}
                            value={m.mentorId || ''}
                            onChange={(e) => handleMutasi(m.id, e.target.value)}
                          >
                            <option value="" disabled>Pilih Mentor</option>
                            {mentors.map(men => (
                              <option key={men.id} value={men.id}>{men.name}</option>
                            ))}
                          </select>
                          <button className="btn btn-secondary btn-sm" style={{ padding: '6px', color: 'var(--clr-primary)', background: 'var(--clr-primary-light)' }} onClick={() => navigate(`/master/mahasiswa/${m.id}`)} title="Lihat Nilai">
                            <Eye size={14} />
                          </button>
                          <button className="btn btn-secondary btn-sm" style={{ padding: '6px' }} onClick={() => {
                            setEditMahasiswa(m)
                            setEditName(m.name || '')
                            setShowEditModal(true)
                          }} title="Edit Mahasiswa">
                            <Edit size={14} />
                          </button>
                          <button className="btn btn-danger btn-sm" style={{ padding: '6px' }} onClick={() => handleDelete(m.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Nama Mahasiswa</h2>
              <button className="sidebar-toggle" onClick={() => setShowEditModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nama Lengkap</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} required />
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

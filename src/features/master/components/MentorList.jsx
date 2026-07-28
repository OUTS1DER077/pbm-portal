import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../../lib/firebase.js'
import { UserPlus, Trash2, Users as UsersIcon, Search, Edit, X } from 'lucide-react'
import toast from 'react-hot-toast'
import MentorCreateModal from './MentorCreateModal.jsx'
import './MentorList.css'

export default function MentorList() {
  const [mentors, setMentors] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editMentor, setEditMentor] = useState(null)
  const [editName, setEditName] = useState('')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchMentors = async () => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'mentor'))
      const snap = await getDocs(q)
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setMentors(list)
    } catch (err) {
      console.error('Error fetching mentors:', err)
    }
    setLoading(false)
  }

  useEffect(() => { fetchMentors() }, [])

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    try {
      await updateDoc(doc(db, 'users', editMentor.id), { name: editName })
      setMentors(prev => prev.map(m => m.id === editMentor.id ? { ...m, name: editName } : m))
      setShowEditModal(false)
      toast.success('Nama mentor berhasil diperbarui')
    } catch (err) {
      console.error(err)
      toast.error('Gagal memperbarui mentor')
    }
  }

  const handleDelete = async (id) => {
    try {
      const q = query(collection(db, 'users'), where('mentorId', '==', id), where('role', '==', 'mahasiswa'))
      const snap = await getDocs(q)
      
      if (!snap.empty) {
        if (!window.confirm(`PERINGATAN: Mentor ini masih membimbing ${snap.size} mahasiswa!\n\nJika dihapus, Anda harus melakukan mutasi pada mahasiswa-mahasiswa tersebut nanti.\n\nTetap hapus mentor ini?`)) {
          return
        }
      } else {
        if (!window.confirm('Yakin ingin menghapus mentor ini?')) return
      }

      await deleteDoc(doc(db, 'users', id))
      setMentors(prev => prev.filter(m => m.id !== id))
      toast.success('Mentor berhasil dihapus')
    } catch (err) {
      console.error('Error deleting mentor:', err)
      toast.error('Gagal menghapus mentor')
    }
  }

  const handleCreated = () => {
    setShowModal(false)
    fetchMentors()
  }

  return (
    <div className="mentor-list-section">
      <div className="section-header">
        <h2 className="section-title">
          <UsersIcon size={20} />
          Daftar Mentor
        </h2>
        <div className="header-actions">
          <div className="search-box">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Cari mentor..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <UserPlus size={16} />
            Tambah Mentor
          </button>
        </div>
      </div>

      <div className="glass-card mentor-table-card">
        {loading ? (
          <div className="empty-state"><div className="spinner"></div></div>
        ) : mentors.length === 0 ? (
          <div className="empty-state">
            <UsersIcon size={48} />
            <p>Belum ada mentor terdaftar.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
              <UserPlus size={16} /> Tambah Mentor Pertama
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Tanggal Dibuat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mentors.filter(m => 
                (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (m.email || '').toLowerCase().includes(searchQuery.toLowerCase())
              ).map(m => (
                <tr key={m.id}>
                  <td className="td-name">
                    <div className="avatar-circle">{(m.name || m.email)[0].toUpperCase()}</div>
                    {m.name || '—'}
                  </td>
                  <td className="td-email">{m.email}</td>
                  <td className="td-date">{m.createdAt ? new Date(m.createdAt).toLocaleDateString('id-ID') : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => {
                        setEditMentor(m)
                        setEditName(m.name || '')
                        setShowEditModal(true)
                      }}>
                        <Edit size={14} />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <MentorCreateModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Nama Mentor</h2>
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

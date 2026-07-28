import { useState } from 'react'
import { createAccountWithoutSignIn } from '../../auth/services/authService.js'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MahasiswaCreateModal({ mentorId, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [nim, setNim] = useState('')
  const [password, setPassword] = useState('')
  const [level, setLevel] = useState('iqro')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const emailToUse = nim.includes('@') ? nim : `${nim}@pbm.app`
      await createAccountWithoutSignIn(emailToUse, password, 'mahasiswa', {
        name,
        nim,
        level,
        mentorId
      })
      toast.success('Mahasiswa berhasil ditambahkan!')
      onCreated()
    } catch (err) {
      const messages = {
        'auth/email-already-in-use': 'NIM sudah terdaftar.',
        'auth/invalid-email': 'Format NIM tidak valid.',
      }
      setError(messages[err.code] || 'Gagal membuat akun. Coba lagi.')
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Tambah Mahasiswa Baru</h2>
          <button className="sidebar-toggle" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="login-error">{error}</div>}
            <div className="form-group">
              <label htmlFor="mhs-name">Nama Lengkap</label>
              <input id="mhs-name" value={name} onChange={e => setName(e.target.value)} placeholder="Nama mahasiswa" required />
            </div>
            <div className="form-group">
              <label htmlFor="mhs-nim">NIM</label>
              <input id="mhs-nim" value={nim} onChange={e => setNim(e.target.value)} placeholder="Contoh: 2024001" required />
            </div>
            <div className="form-group">
              <label htmlFor="mhs-password">Password Awal</label>
              <input id="mhs-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimal 6 karakter" required minLength={6} />
            </div>
            <div className="form-group">
              <label>Level Awal</label>
              <div className="level-toggle">
                <button type="button" className={`level-option ${level === 'iqro' ? 'active' : ''}`} onClick={() => setLevel('iqro')}>Iqro</button>
                <button type="button" className={`level-option ${level === 'quran' ? 'active' : ''}`} onClick={() => setLevel('quran')}>Al-Qur'an</button>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <div className="spinner"></div> : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

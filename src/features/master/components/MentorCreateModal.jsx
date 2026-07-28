import { useState } from 'react'
import { createAccountWithoutSignIn } from '../../auth/services/authService.js'
import { Eye, EyeOff, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MentorCreateModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await createAccountWithoutSignIn(email, password, 'mentor', { name })
      toast.success('Mentor berhasil ditambahkan!')
      onCreated()
    } catch (err) {
      const messages = {
        'auth/email-already-in-use': 'Email sudah terdaftar.',
        'auth/invalid-email': 'Format email tidak valid.',
        'auth/weak-password': 'Password minimal 6 karakter.'
      }
      setError(messages[err.code] || 'Gagal membuat akun. Coba lagi.')
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Tambah Mentor Baru</h2>
          <button className="sidebar-toggle" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="login-error">{error}</div>}
            <div className="form-group">
              <label htmlFor="mentor-name">Nama Lengkap</label>
              <input id="mentor-name" value={name} onChange={e => setName(e.target.value)} placeholder="Masukkan nama mentor" required />
            </div>
            <div className="form-group">
              <label htmlFor="mentor-email">Email</label>
              <input id="mentor-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="mentor@email.com" required />
            </div>
            <div className="form-group">
              <label htmlFor="mentor-password">Password Awal</label>
              <input id="mentor-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimal 6 karakter" required minLength={6} />
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

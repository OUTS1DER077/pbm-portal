import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../../lib/firebase.js'
import { useAuth } from '../../auth/context/AuthContext.jsx'
import { changeUserPassword, changeUserEmail } from '../../auth/services/authService.js'
import { User, Save, Lock, KeyRound, Mail } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MentorSettings() {
  const { user, userData } = useAuth()
  
  const [name, setName] = useState(userData?.name || '')
  const [loading, setLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  
  // Password states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // Email states
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Nama tidak boleh kosong')
      return
    }

    setLoading(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: name.trim(),
      })
      toast.success('Profil berhasil diperbarui!')
    } catch (err) {
      console.error('Error updating profile:', err)
      toast.error('Gagal memperbarui profil. Coba lagi.')
    }
    setLoading(false)
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    
    if (newPassword.length < 6) {
      toast.error('Sandi baru minimal 6 karakter.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Sandi baru dan konfirmasi tidak cocok.')
      return
    }

    setPasswordLoading(true)
    try {
      await changeUserPassword(currentPassword, newPassword)
      toast.success('Sandi berhasil diubah!', { duration: 4000 })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      console.error('Error changing password:', err)
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        toast.error('Sandi saat ini salah.')
      } else {
        toast.error('Gagal mengubah sandi. Coba lagi.')
      }
    }
    setPasswordLoading(false)
  }

  const handleChangeEmail = async (e) => {
    e.preventDefault()
    
    setEmailLoading(true)
    try {
      await changeUserEmail(emailCurrentPassword, newEmail)
      
      toast.success(`Tautan verifikasi telah dikirim ke ${newEmail}. Buka email tersebut untuk mengonfirmasi perubahan.`, { duration: 6000 })
      setEmailCurrentPassword('')
      setNewEmail('')
    } catch (err) {
      console.error('Error changing email:', err)
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        toast.error('Sandi saat ini salah.')
      } else if (err.code === 'auth/email-already-in-use') {
        toast.error('Email tersebut sudah digunakan oleh akun lain.')
      } else if (err.code === 'auth/invalid-email') {
        toast.error('Format email tidak valid.')
      } else {
        toast.error(`Gagal: ${err.code || 'Unknown Error'} - ${err.message}`)
      }
    }
    setEmailLoading(false)
  }

  return (
    <div className="page-enter" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 className="page-title" style={{ marginBottom: '24px' }}>Pengaturan Akun</h1>
      
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: 'var(--fs-subheading)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <User size={20} color="var(--clr-primary)" /> Profil Saya
        </h2>
        
        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Nama Lengkap</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Masukkan nama lengkap"
              required
            />
          </div>
          
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-start', marginTop: '8px' }}>
            {loading ? <div className="spinner"></div> : <><Save size={16} /> Simpan Perubahan</>}
          </button>
        </form>
      </div>

      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: 'var(--fs-subheading)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--clr-primary)' }}>
          <Mail size={20} /> Ganti Email
        </h2>
        
        <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--clr-text-muted)', marginBottom: '16px' }}>
          Email saat ini: <strong>{userData?.email || user?.email}</strong>
        </p>
        
        <form onSubmit={handleChangeEmail} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
              <label>Email Baru</label>
              <input 
                type="email" 
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Masukkan email baru"
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
              <label>Sandi Saat Ini (Untuk Keamanan)</label>
              <input 
                type="password" 
                value={emailCurrentPassword}
                onChange={(e) => setEmailCurrentPassword(e.target.value)}
                placeholder="Masukkan sandi Anda"
                required
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={emailLoading}
            style={{ alignSelf: 'flex-start', marginTop: '8px' }}
          >
            {emailLoading ? <div className="spinner"></div> : <><Save size={16} /> Ubah Email Sekarang</>}
          </button>
        </form>
      </div>

      <div className="glass-card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: 'var(--fs-subheading)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--clr-danger)' }}>
          <Lock size={20} /> Ganti Kata Sandi
        </h2>
        
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Sandi Saat Ini</label>
            <input 
              type="password" 
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Masukkan sandi Anda saat ini"
              required
            />
          </div>
          
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
              <label>Sandi Baru</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                required
                minLength={6}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
              <label>Konfirmasi Sandi Baru</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi sandi baru"
                required
                minLength={6}
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            className="btn btn-secondary" 
            disabled={passwordLoading}
            style={{ alignSelf: 'flex-start', marginTop: '8px', background: 'var(--clr-danger-bg)', color: 'var(--clr-danger)', border: '1px solid var(--clr-danger)' }}
          >
            {passwordLoading ? <div className="spinner"></div> : <><KeyRound size={16} /> Ubah Sandi Sekarang</>}
          </button>
        </form>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginUser, resetPassword } from '../services/authService.js'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../../lib/firebase.js'
import { BookOpen, Eye, EyeOff, LogIn } from 'lucide-react'
import toast from 'react-hot-toast'
import './LoginPage.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = await loginUser(email, password)
      const userDoc = await getDoc(doc(db, 'users', user.uid))

      if (!userDoc.exists()) {
        setError('Data pengguna tidak ditemukan.')
        setLoading(false)
        return
      }

      const userData = userDoc.data()
      
      // Sinkronisasi Email: Jika email di Firebase Auth sudah berubah (setelah verifikasi), update di Firestore
      if (user.email && user.email !== userData.email) {
        await updateDoc(doc(db, 'users', user.uid), { email: user.email })
      }

      const role = userData.role
      const redirectMap = {
        master: '/master',
        mentor: '/mentor',
        mahasiswa: '/mahasiswa'
      }
      navigate(redirectMap[role] || '/login')
    } catch (err) {
      const messages = {
        'auth/user-not-found': 'Email tidak terdaftar.',
        'auth/wrong-password': 'Password salah.',
        'auth/invalid-email': 'Format email tidak valid.',
        'auth/invalid-credential': 'Email atau password salah.',
        'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi nanti.'
      }
      setError(messages[err.code] || 'Terjadi kesalahan. Coba lagi.')
    }
    setLoading(false)
  }

  const handleResetPassword = async () => {
    if (!email) {
      toast.error('Silakan masukkan email Anda di kolom atas terlebih dahulu', { duration: 4000 })
      return
    }
    try {
      setLoading(true)
      await resetPassword(email)
      // Generic message prevents user enumeration
      toast.success('Jika email Anda terdaftar, tautan reset telah dikirim ke kotak masuk atau spam Anda.', { duration: 5000 })
    } catch (err) {
      // If user not found, we pretend it worked to prevent enumeration
      if (err.code === 'auth/user-not-found') {
        toast.success('Jika email Anda terdaftar, tautan reset telah dikirim ke kotak masuk atau spam Anda.', { duration: 5000 })
      } else if (err.code === 'auth/invalid-email') {
        toast.error('Format email tidak valid.')
      } else {
        toast.error('Gagal mengirim link reset. Coba lagi nanti.')
      }
    }
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-bg-pattern"></div>
      <div className="login-card glass-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <BookOpen size={32} />
          </div>
          <h1 className="login-title">PBM</h1>
          <p className="login-subtitle">Portal Belajar Mengaji</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email / NIM</label>
            <input
              id="email"
              type="email"
              placeholder="Masukkan email anda"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button 
                type="button" 
                onClick={handleResetPassword}
                disabled={loading}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: loading ? 'var(--clr-text-muted)' : 'var(--clr-primary)', 
                  fontSize: 'var(--fs-caption)', 
                  cursor: loading ? 'not-allowed' : 'pointer', 
                  padding: 0 
                }}
              >
                Lupa Password?
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-block login-btn"
            disabled={loading}
          >
            {loading ? (
              <div className="spinner"></div>
            ) : (
              <>
                <LogIn size={20} />
                Masuk
              </>
            )}
          </button>
        </form>

        <p className="login-footer">ISTEK 'Aisyiyah &copy; 2026</p>
      </div>
    </div>
  )
}

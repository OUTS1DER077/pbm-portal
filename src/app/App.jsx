import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/context/AuthContext.jsx'

// Layout
import DashboardLayout from '../shared/components/DashboardLayout.jsx'
import ProtectedRoute from '../shared/components/ProtectedRoute.jsx'

// Auth
import LoginPage from '../features/auth/components/LoginPage.jsx'

// Master
import MasterDashboard from '../features/master/components/MasterDashboard.jsx'
import MentorList from '../features/master/components/MentorList.jsx'
import StatsOverview from '../features/master/components/StatsOverview.jsx'
import MasterMahasiswaList from '../features/master/components/MasterMahasiswaList.jsx'

// Mentor
import MentorDashboard from '../features/mentor/components/MentorDashboard.jsx'
import EvaluationForm from '../features/mentor/components/EvaluationForm.jsx'
import MahasiswaDetail from '../features/mentor/components/MahasiswaDetail.jsx'
import MentorSettings from '../features/mentor/components/MentorSettings.jsx'

// Mahasiswa
import MahasiswaDashboard from '../features/mahasiswa/components/MahasiswaDashboard.jsx'
import MahasiswaSettings from '../features/mahasiswa/components/MahasiswaSettings.jsx'

import { Toaster } from 'react-hot-toast'

export default function App() {
  const { user, userRole, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg"></div>
        <p>Memuat Portal Belajar Mengaji...</p>
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        {/* Public */}
        <Route path="/login" element={
          user ? <Navigate to={`/${userRole}`} replace /> : <LoginPage />
        } />

        {/* Master Routes */}
        <Route path="/master" element={
          <ProtectedRoute allowedRoles={['master']}>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<MasterDashboard />} />
          <Route path="mentors" element={<MentorList />} />
          <Route path="mahasiswa" element={<MasterMahasiswaList />} />
          <Route path="mahasiswa/:mahasiswaId" element={<MahasiswaDetail />} />
          <Route path="statistics" element={<StatsOverview />} />
        </Route>

        {/* Mentor Routes */}
        <Route path="/mentor" element={
          <ProtectedRoute allowedRoles={['mentor']}>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<MentorDashboard />} />
          <Route path="mahasiswa" element={<MentorDashboard />} />
          <Route path="mahasiswa/:mahasiswaId" element={<MahasiswaDetail />} />
          <Route path="evaluate" element={<MentorDashboard />} />
          <Route path="evaluate/:mahasiswaId" element={<EvaluationForm />} />
          <Route path="settings" element={<MentorSettings />} />
        </Route>

        {/* Mahasiswa Routes */}
        <Route path="/mahasiswa" element={
          <ProtectedRoute allowedRoles={['mahasiswa']}>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<MahasiswaDashboard />} />
          <Route path="progress" element={<MahasiswaDashboard />} />
          <Route path="settings" element={<MahasiswaSettings />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  )
}

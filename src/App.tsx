import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ApplyPage from './pages/ApplyPage'
import AdminPage from './pages/AdminPage'
import AdminLogin from './pages/AdminLogin'

function AdminRoute() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem('hr_admin_auth') === '1'
  )

  function handleLogin() { setAuthed(true) }
  function handleLogout() {
    sessionStorage.removeItem('hr_admin_auth')
    setAuthed(false)
  }

  if (!authed) return <AdminLogin onLogin={handleLogin} />
  return <AdminPage onLogout={handleLogout} />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/apply/:vacancyId" element={<ApplyPage />} />
        <Route path="/admin" element={<AdminRoute />} />
        <Route path="/" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

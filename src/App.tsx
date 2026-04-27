import { Routes, Route, Navigate } from 'react-router-dom'
import { CalendarPage } from './pages/CalendarPage'
import { DevComponentsPage } from './pages/DevComponentsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CalendarPage />} />
      <Route path="/week/:isoDate" element={<CalendarPage />} />
      <Route path="/dev/components" element={<DevComponentsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

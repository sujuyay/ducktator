import { Navigate, Route, Routes } from 'react-router-dom'
import { LineupPage } from './pages/LineupPage'
import { OpenGymsListPage } from './pages/OpenGymsListPage'
import { OpenGymPage } from './pages/OpenGymPage'

function App() {
  return (
    <Routes>
      <Route path="/lineup" element={<LineupPage />} />
      <Route path="/open-gyms" element={<OpenGymsListPage />} />
      <Route path="/open-gyms/:id" element={<OpenGymPage />} />
      {/* Anything else (incl. /) redirects to the lineup page for now. */}
      <Route path="*" element={<Navigate to="/lineup" replace />} />
    </Routes>
  )
}

export default App

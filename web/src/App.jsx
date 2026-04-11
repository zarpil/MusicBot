import { Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import PlayerPage from './components/PlayerPage';

function App() {
  return (
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/guild/:guildId" element={<PlayerPage />} />
      </Routes>
    </div>
  );
}

export default App;

import { Routes, Route } from 'react-router-dom';
import AuditLogs from '@/components/emulator/AuditLogs';
import RealTimeMonitoring from '@/components/emulator/RealTimeMonitoring';
import Alerts from '@/components/emulator/Alerts';
import SessionReplay from '@/components/emulator/SessionReplay';

const EmulatorPanel = () => {
  return (
    <Routes>
      <Route path="/" element={<RealTimeMonitoring />} />
      <Route path="/logs" element={<AuditLogs />} />
      <Route path="/alerts" element={<Alerts />} />
      <Route path="/sessions" element={<SessionReplay />} />
    </Routes>
  );
};

export default EmulatorPanel;
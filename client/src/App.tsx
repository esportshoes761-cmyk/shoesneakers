import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Login from '@/pages/Login';
import MarketingPanel from '@/pages/MarketingPanel';
import EmulatorPanel from '@/pages/EmulatorPanel';
import Layout from '@/components/Layout';

const ProtectedRoute: React.FC<{ children: React.ReactNode; role?: string }> = ({ children, role }) => {
  const { user, hasPermission } = useAuth();

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (role && !hasPermission(role as any)) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/marketing/*"
        element={
          <ProtectedRoute role="marketing">
            <Layout>
              <MarketingPanel />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/emulator/*"
        element={
          <ProtectedRoute role="emulator">
            <Layout>
              <EmulatorPanel />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/marketing" />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
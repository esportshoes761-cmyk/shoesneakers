import { Routes, Route } from 'react-router-dom';
import Dashboard from '@/components/marketing/Dashboard';
import ProductManagement from '@/components/marketing/ProductManagement';
import Reports from '@/components/marketing/Reports';
import BulkUpload from '@/components/marketing/BulkUpload';

const MarketingPanel = () => {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/products" element={<ProductManagement />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/bulk-upload" element={<BulkUpload />} />
    </Routes>
  );
};

export default MarketingPanel;
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LoginPage from '@/pages/auth/LoginPage'
import AdminLayout from '@/components/AdminLayout'
import FirmAdminLayout from '@/components/FirmAdminLayout'
import AdminDashboard from '@/pages/platform-admin/AdminDashboard'
import FirmsPage from '@/pages/platform-admin/FirmsPage'
import FirmDashboard from '@/pages/firm-admin/FirmDashboard'
import CompaniesPage from '@/pages/firm-admin/CompaniesPage'
import AccountantsPage from '@/pages/firm-admin/AccountantsPage'
import PaymentHeadsPage from '@/pages/firm-admin/PaymentHeadsPage'
import CompanyLayout from '@/components/CompanyLayout'
import CompanyDashboard from '@/pages/company/CompanyDashboard'
import UploadPage from '@/pages/company/UploadPage'
import DocumentDetailPage from '@/pages/company/DocumentDetailPage'
import AccountantLayout from '@/components/AccountantLayout'
import AccountantDashboard from '@/pages/accountant/AccountantDashboard'
import ReviewPage from '@/pages/accountant/ReviewPage'
import AccountantReportsPage from '@/pages/accountant/ReportsPage'
import CompanyReportsPage from '@/pages/company/ReportsPage'
import AuditPage from '@/pages/firm-admin/AuditPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="firms" element={<FirmsPage />} />
          </Route>

          <Route path="/firm" element={
            <ProtectedRoute allowedRoles={['firm_admin']}>
              <FirmAdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<FirmDashboard />} />
            <Route path="companies" element={<CompaniesPage />} />
            <Route path="companies/:companyId/payment-heads" element={<PaymentHeadsPage />} />
            <Route path="accountants" element={<AccountantsPage />} />
            <Route path="audit" element={<AuditPage />} />
          </Route>

          <Route path="/company" element={
            <ProtectedRoute allowedRoles={['company_admin', 'company_user']}>
              <CompanyLayout />
            </ProtectedRoute>
          }>
            <Route index element={<CompanyDashboard />} />
            <Route path="upload" element={<UploadPage />} />
            <Route path="documents/:docId" element={<DocumentDetailPage />} />
            <Route path="reports" element={<CompanyReportsPage />} />
          </Route>

          <Route path="/accountant" element={
            <ProtectedRoute allowedRoles={['accountant', 'firm_admin']}>
              <AccountantLayout />
            </ProtectedRoute>
          }>
            <Route index element={<AccountantDashboard />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="reports" element={<AccountantReportsPage />} />
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

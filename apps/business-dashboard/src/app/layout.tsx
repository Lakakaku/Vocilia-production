import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { PermissionProvider } from '@/contexts/PermissionContext';
import { BusinessProvider } from '@/contexts/BusinessContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export const metadata: Metadata = {
  title: 'AI Feedback Platform - Business Dashboard',
  description: 'Manage your customer feedback and insights',
  // Force deployment refresh - 2025-09-07
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <body className="bg-gray-50">
        <AuthProvider>
          <PermissionProvider>
            <BusinessProvider>
              <DashboardLayout>
                {children}
              </DashboardLayout>
            </BusinessProvider>
          </PermissionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
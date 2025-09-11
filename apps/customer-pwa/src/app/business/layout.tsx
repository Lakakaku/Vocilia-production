import type { Metadata } from 'next';
import { Sidebar } from '../../business-components/layout/Sidebar';

export const metadata: Metadata = {
  title: 'AI Feedback Platform - Business Dashboard',
  description: 'Manage your customer feedback and insights',
};

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-hidden">
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
import type { Metadata } from 'next';

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
    <div className="min-h-screen bg-gray-50">
      <main>
        {children}
      </main>
    </div>
  );
}
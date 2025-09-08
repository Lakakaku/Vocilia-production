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
    <div className="bg-gray-50 min-h-screen">
      {children}
    </div>
  );
}
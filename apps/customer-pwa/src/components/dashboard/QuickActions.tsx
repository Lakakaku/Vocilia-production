'use client';

import { useRouter } from 'next/navigation';
import { MessageSquare, TrendingUp, Settings, Download, Users, CreditCard } from 'lucide-react';

export function QuickActions() {
  const router = useRouter();

  const actions = [
    {
      title: 'Visa feedback',
      description: 'Se all kundåterkoppling',
      icon: MessageSquare,
      color: 'bg-blue-100 text-blue-600',
      onClick: () => router.push('/feedback')
    },
    {
      title: 'Analys',
      description: 'Detaljerad statistik',
      icon: TrendingUp,
      color: 'bg-green-100 text-green-600',
      onClick: () => router.push('/analytics')
    },
    {
      title: 'Kunder',
      description: 'Hantera kundinsikter',
      icon: Users,
      color: 'bg-purple-100 text-purple-600',
      onClick: () => router.push('/customers')
    },
    {
      title: 'Betalningar',
      description: 'Hantera utbetalningar',
      icon: CreditCard,
      color: 'bg-orange-100 text-orange-600',
      onClick: () => router.push('/payments')
    },
    {
      title: 'Exportera',
      description: 'Ladda ner rapporter',
      icon: Download,
      color: 'bg-gray-100 text-gray-600',
      onClick: () => router.push('/analytics?export=true')
    },
    {
      title: 'Inställningar',
      description: 'Företagsinställningar',
      icon: Settings,
      color: 'bg-gray-100 text-gray-600',
      onClick: () => router.push('/settings')
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.title}
            onClick={action.onClick}
            className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-left group"
          >
            <div className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-gray-900 text-sm">{action.title}</h3>
            <p className="text-xs text-gray-500 mt-1">{action.description}</p>
          </button>
        );
      })}
    </div>
  );
}
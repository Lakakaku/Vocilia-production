'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BarChart3, 
  MessageSquare, 
  Settings, 
  Store, 
  Users,
  TrendingUp,
  MapPin,
  Shield,
  ChevronLeft,
  ChevronRight,
  Calculator,
  Gift,
  FileText,
  Printer
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Feedback', href: '/feedback', icon: MessageSquare },
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
  { name: 'ROI-kalkylator', href: '/roi', icon: Calculator },
  { name: 'Rapporter', href: '/reports', icon: Printer },
  { name: 'Locations', href: '/locations', icon: MapPin },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Verification', href: '/verification', icon: Shield },
  { name: 'Kontext-mallar', href: '/templates', icon: FileText },
  { name: 'Store Settings', href: '/settings', icon: Store },
  { name: 'Account', href: '/account', icon: Settings },
  { name: 'Provperiod', href: '/trial', icon: Gift },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <div className={`bg-gray-900 text-white transition-all duration-300 ${
      collapsed ? 'w-16' : 'w-64'
    }`}>
      <div className="flex flex-col h-full">
        {/* Logo/Brand */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            {!collapsed && (
              <h2 className="text-lg font-semibold">AI Feedback</h2>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-md hover:bg-gray-800"
            >
              {collapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${collapsed ? '' : 'mr-3'}`} />
                {!collapsed && item.name}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        {!collapsed && (
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium">TC</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">Test Café</p>
                <p className="text-xs text-gray-400">Stockholm</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
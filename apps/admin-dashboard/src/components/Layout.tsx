import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { authManager, getCurrentUser, hasPermission, AdminUser } from '../utils/auth';

interface LayoutProps {
  children: ReactNode;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  permission?: string;
  description?: string;
}

const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Översikt',
    icon: '🏠',
    href: '/dashboard',
    description: 'Systemöversikt och statistik'
  },
  {
    id: 'businesses',
    label: 'Företag',
    icon: '🏢',
    href: '/businesses',
    permission: 'business:read',
    description: 'Hantera företagskonton och inställningar'
  },
  {
    id: 'verifications',
    label: 'Verifikationer',
    icon: '✅',
    href: '/verifications',
    permission: 'verification:read',
    description: 'Hantera månadsvis verifiering och betalningar'
  },
  {
    id: 'approvals',
    label: 'Godkännanden',
    icon: '🔍',
    href: '/approvals',
    permission: 'business:approve',
    description: 'Granska och godkänn ansökningar'
  },
  {
    id: 'live',
    label: 'Live Sessioner',
    icon: '🎙️',
    href: '/live',
    permission: 'system:read',
    description: 'Övervaka aktiva röstsessioner'
  },
  {
    id: 'fraud',
    label: 'Bedrägeri',
    icon: '🚨',
    href: '/fraud',
    permission: 'fraud:read',
    description: 'Bedrägeridetektering och hantering'
  },
  {
    id: 'bans',
    label: 'Blockering & Överklaganden',
    icon: '🚫',
    href: '/bans',
    permission: 'bans:read',
    description: 'Hantera kund- och företagsblockningar med överklagandeprocess'
  },
  {
    id: 'overrides',
    label: 'Manuella Ändringar',
    icon: '✏️',
    href: '/overrides',
    permission: 'feedback:override',
    description: 'Åsidosätt AI-poängsättning'
  },
  {
    id: 'tiers',
    label: 'Tier-hantering',
    icon: '📊',
    href: '/tiers',
    permission: 'business:approve',
    description: 'Hantera företag tier-nivåer och uppgraderingar'
  },
  {
    id: 'limits',
    label: 'Gräns-hantering',
    icon: '⚖️',
    href: '/limits',
    permission: 'limits:read',
    description: 'Övervaka och hantera tier-baserade gränser'
  },
  {
    id: 'recommendations',
    label: 'AI-rekommendationer',
    icon: '🤖',
    href: '/recommendations',
    permission: 'analytics:read',
    description: 'Performance-baserade tier-rekommendationer'
  },
  {
    id: 'integration-monitoring',
    label: 'Integration Övervakning',
    icon: '🔌',
    href: '/integration-monitoring',
    permission: 'system:read',
    description: 'Real-time POS integration hälsa och prestanda'
  },
  {
    id: 'manual-overrides',
    label: 'Manuell Kontroll',
    icon: '🛠️',
    href: '/manual-overrides',
    permission: 'system:admin',
    description: 'Manuella override verktyg för POS integrationer'
  },
  {
    id: 'audit',
    label: 'Granskningslogg',
    icon: '📋',
    href: '/audit',
    permission: 'system:read',
    description: 'Systemaktivitet och ändringslogg'
  },
  {
    id: 'users',
    label: 'Administratörer',
    icon: '👥',
    href: '/users',
    permission: 'admin:read',
    description: 'Hantera administratörsanvändare'
  },
  {
    id: 'system-metrics',
    label: 'Systemstatistik',
    icon: '🔧',
    href: '/system-metrics',
    permission: 'system:read',
    description: 'System hälsoövervakning och prestanda'
  }
];

export default function Layout({ children }: LayoutProps) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
  }, []);

  const handleLogout = async () => {
    try {
      await authManager.logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      router.push('/login');
    }
  };

  const getVisibleNavItems = (): NavigationItem[] => {
    if (!user) return [];
    
    return navigationItems.filter(item => {
      if (!item.permission) return true;
      return hasPermission(item.permission.split(':')[0] + ':read') || 
             hasPermission(item.permission);
    });
  };

  const getRoleDisplayName = (role: string): string => {
    const roleNames: Record<string, string> = {
      'super_admin': 'Super Administratör',
      'admin': 'Administratör'
    };
    return roleNames[role] || role;
  };

  const getRoleBadgeColor = (role: string): string => {
    const colors: Record<string, string> = {
      'super_admin': '#dc2626',
      'admin': '#ea580c'
    };
    return colors[role] || '#64748b';
  };

  const isActiveRoute = (href: string): boolean => {
    return router.pathname === href;
  };

  if (!user) {
    return <div>{children}</div>; // No layout for unauthenticated users
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Mobile menu backdrop */}
      {mobileMenuOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 40
          }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? '280px' : '80px',
        backgroundColor: 'white',
        borderRight: '1px solid #e2e8f0',
        transition: 'width 0.3s ease',
        position: 'relative',
        zIndex: 50,
        ...(window.innerWidth < 768 ? {
          position: 'fixed',
          height: '100vh',
          transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)',
          width: '280px'
        } : {})
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: sidebarOpen ? 'block' : 'none' }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#1e293b',
              margin: 0,
              marginBottom: '4px'
            }}>
              Admin Panel
            </h2>
            <p style={{
              fontSize: '12px',
              color: '#64748b',
              margin: 0
            }}>
              AI Feedback Platform
            </p>
          </div>
          
          {/* Sidebar toggle button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              backgroundColor: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px'
            }}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Navigation Menu */}
        <nav style={{ padding: '16px 0', flex: 1, overflowY: 'auto' }}>
          {getVisibleNavItems().map((item) => (
            <a
              key={item.id}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                router.push(item.href);
                setMobileMenuOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: sidebarOpen ? '12px 20px' : '12px',
                marginBottom: '4px',
                textDecoration: 'none',
                color: isActiveRoute(item.href) ? '#3b82f6' : '#374151',
                backgroundColor: isActiveRoute(item.href) ? '#eff6ff' : 'transparent',
                borderRight: isActiveRoute(item.href) ? '3px solid #3b82f6' : 'none',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                if (!isActiveRoute(item.href)) {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActiveRoute(item.href)) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span style={{ 
                fontSize: '20px', 
                marginRight: sidebarOpen ? '12px' : '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px'
              }}>
                {item.icon}
              </span>
              {sidebarOpen && (
                <div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '2px'
                  }}>
                    {item.label}
                  </div>
                  {item.description && (
                    <div style={{
                      fontSize: '11px',
                      color: '#6b7280',
                      lineHeight: '1.2'
                    }}>
                      {item.description}
                    </div>
                  )}
                </div>
              )}
            </a>
          ))}
        </nav>

        {/* User Section */}
        {sidebarOpen && (
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc'
          }}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#1e293b',
                marginBottom: '2px'
              }}>
                {user.name || user.email}
              </div>
              <div style={{
                fontSize: '12px',
                padding: '2px 8px',
                backgroundColor: getRoleBadgeColor(user.role),
                color: 'white',
                borderRadius: '12px',
                display: 'inline-block'
              }}>
                {getRoleDisplayName(user.role)}
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ef4444';
              }}
            >
              Logga ut
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        minWidth: 0 // Prevents flex item from overflowing
      }}>
        {/* Mobile Header */}
        <header 
          style={{
            display: window.innerWidth < 768 ? 'flex' : 'none',
            alignItems: 'center',
            padding: '16px 20px',
            backgroundColor: 'white',
            borderBottom: '1px solid #e2e8f0'
          }}
        >
          <button
            onClick={() => setMobileMenuOpen(true)}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '16px',
              fontSize: '18px'
            }}
          >
            ☰
          </button>
          
          <div>
            <h1 style={{ 
              fontSize: '20px', 
              fontWeight: 'bold', 
              color: '#1e293b',
              margin: 0
            }}>
              Admin Panel
            </h1>
          </div>
        </header>

        {/* Page Content */}
        <div style={{ 
          flex: 1,
          padding: window.innerWidth < 768 ? '16px' : '24px',
          overflowY: 'auto'
        }}>
          {children}
        </div>
      </main>
    </div>
  );
}
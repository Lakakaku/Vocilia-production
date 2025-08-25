import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import BusinessApprovalQueue from '../components/BusinessApprovalQueue';
import { authManager, getCurrentUser, AdminUser } from '../utils/auth';

export default function ApprovalsPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check authentication and permissions
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    
    // Check if user has business approval permissions
    if (!currentUser.permissions.includes('business:approve') && 
        !currentUser.permissions.includes('business:read')) {
      router.push('/dashboard');
      return;
    }
    
    setUser(currentUser);
    setLoading(false);
    
    // Start token refresh timer
    authManager.startTokenRefreshTimer();
  }, [router]);

  if (loading) {
    return (
      <Layout>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '60vh'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              border: '3px solid #e2e8f0',
              borderTop: '3px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <p style={{ color: '#64748b' }}>Laddar godkännanden...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <Layout>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ 
              fontSize: '28px', 
              fontWeight: 'bold', 
              color: '#1e293b',
              margin: '0 0 8px 0'
            }}>
              Företagsgodkännanden
            </h1>
            <p style={{ 
              color: '#64748b', 
              fontSize: '16px',
              margin: 0
            }}>
              Granska och godkänn företagsansökningar med svensk regelefterlevnad
            </p>
          </div>
          
          {/* Permission indicator */}
          <div style={{
            padding: '8px 12px',
            backgroundColor: user.permissions.includes('business:approve') ? '#dcfce7' : '#fef3c7',
            color: user.permissions.includes('business:approve') ? '#166534' : '#92400e',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            {user.permissions.includes('business:approve') ? 
              '✅ Godkännandebehörighet' : 
              '👀 Endast läsbehörighet'}
          </div>
        </div>
      </div>

      {/* Guidance for Swedish compliance */}
      <div style={{
        backgroundColor: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '24px'
      }}>
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: '600', 
          color: '#0369a1',
          margin: '0 0 8px 0'
        }}>
          📋 Granskningsguide - Svensk Regelefterlevnad
        </h3>
        <div style={{ fontSize: '14px', color: '#0369a1', lineHeight: '1.5' }}>
          <strong>Obligatoriska kontroller:</strong>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>Organisationsnummer verifiering via Bolagsverket</li>
            <li>Giltigt restaurangtillstånd/näringstillstånd</li>
            <li>Ekonomisk stabilitet (kontoutdrag, kreditkontroll)</li>
            <li>Adressverifiering och fysisk närvaro i Sverige</li>
            <li>AML/KYC efterlevnad enligt Finansinspektionen</li>
          </ul>
          <strong>Riskbedömning:</strong> Låg risk (≥90 poäng) = Automatisk godkännande möjlig | Medium risk (60-89) = Manuell granskning | Hög risk (&lt;60) = Extra kontroller krävs
        </div>
      </div>

      {/* Permission check for approval actions */}
      {!user.permissions.includes('business:approve') && (
        <div style={{
          backgroundColor: '#fef3c7',
          border: '1px solid #fcd34d',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px'
        }}>
          <div style={{ color: '#92400e', fontSize: '14px' }}>
            ⚠️ Du har endast läsbehörighet. Kontakta en super-admin för att få godkännandebehörighet.
          </div>
        </div>
      )}

      {/* Business Approval Queue Component */}
      <BusinessApprovalQueue />
      
      {/* Add CSS animation for loading spinner */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </Layout>
  );
}


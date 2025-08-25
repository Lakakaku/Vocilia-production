import { useState, useEffect } from 'react';
import { authManager } from '../utils/auth';

// Types for Swedish business approval system
interface BusinessApplication {
  id: string;
  name: string;
  organizationNumber: string;
  contactEmail: string;
  contactPhone: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
    region: string;
  };
  businessType: string;
  estimatedMonthlyTransactions: number;
  expectedCustomerVolume: number;
  submittedAt: string;
  status: 'pending_review' | 'needs_documentation' | 'approved_conditionally' | 'approved' | 'rejected';
  documents: {
    organizationCertificate?: Document;
    businessLicense?: Document;
    bankStatement?: Document;
  };
  validation: {
    organizationNumberValid: boolean;
    documentsComplete: boolean;
    addressVerified: boolean;
    creditCheckPassed: boolean | null;
    complianceScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    automaticApproval: boolean;
    requiresManualReview: boolean;
    flags: string[];
  };
  reviewNotes: ReviewNote[];
  assignedReviewer: string | null;
  conditionalApproval?: {
    conditions: string[];
    expiresAt: string;
  };
}

interface Document {
  filename: string;
  uploadedAt: string;
  status: 'uploaded' | 'verified' | 'rejected';
  verified: boolean;
}

interface ReviewNote {
  id: string;
  adminId: string;
  adminName: string;
  note: string;
  timestamp: string;
  category: 'documentation' | 'approval' | 'rejection' | 'general';
}

interface AuditLogEntry {
  id: string;
  businessId: string;
  adminId: string;
  adminName: string;
  adminRole: string;
  action: 'validate' | 'approve' | 'reject' | 'assign' | 'update_tier' | 'add_note';
  details: {
    previousStatus?: string;
    newStatus?: string;
    reason?: string;
    tier?: number;
    conditions?: string[];
    approvalType?: string;
    validationResults?: any;
  };
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

interface ApprovalStats {
  total: number;
  pending: number;
  needsDocumentation: number;
  conditionallyApproved: number;
  awaitingReview: number;
  highRisk: number;
  automaticApprovalEligible: number;
}

export default function BusinessApprovalQueue() {
  const [applications, setApplications] = useState<BusinessApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<BusinessApplication | null>(null);
  const [showDocuments, setShowDocuments] = useState(false);
  const [approvalStats, setApprovalStats] = useState<ApprovalStats | null>(null);
  const [filter, setFilter] = useState<string>('pending');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [validationLoading, setValidationLoading] = useState<string | null>(null);
  const [autoApprovalLoading, setAutoApprovalLoading] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<string, AuditLogEntry[]>>({});
  const [showAuditHistory, setShowAuditHistory] = useState<Record<string, boolean>>({});

  // Load business applications
  useEffect(() => {
    loadApplications();
  }, [filter]);

  const loadApplications = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authManager.makeAuthenticatedRequest(
        `/api/admin/business/approvals?status=${filter}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load applications');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setApplications(data.data.businesses);
        setApprovalStats(data.data.stats);
      } else {
        throw new Error(data.message || 'Failed to load applications');
      }
    } catch (err: any) {
      console.error('Load applications error:', err);
      setError('Kunde inte ladda ansökningar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (application: BusinessApplication, approvalData: any) => {
    try {
      const response = await authManager.makeAuthenticatedRequest(
        `/api/admin/business/${application.id}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(approvalData)
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('Business approved:', result);
        setShowApprovalModal(false);
        setSelectedApplication(null);
        await loadApplications(); // Refresh list
      } else {
        throw new Error('Approval failed');
      }
    } catch (err) {
      console.error('Approval error:', err);
      setError('Kunde inte godkänna företag');
    }
  };

  const handleReject = async (application: BusinessApplication, rejectionData: any) => {
    try {
      const response = await authManager.makeAuthenticatedRequest(
        `/api/admin/business/${application.id}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rejectionData)
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('Business rejected:', result);
        setShowRejectionModal(false);
        setSelectedApplication(null);
        await loadApplications(); // Refresh list
      } else {
        throw new Error('Rejection failed');
      }
    } catch (err) {
      console.error('Rejection error:', err);
      setError('Kunde inte avvisa företag');
    }
  };

  const handleRunValidation = async (application: BusinessApplication) => {
    try {
      setValidationLoading(application.id);
      setError(null);

      const response = await authManager.makeAuthenticatedRequest(
        `/api/admin/business/${application.id}/validate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('Validation completed:', result);
        
        // Show validation results
        if (result.success) {
          const validation = result.data.validation;
          const message = `Automatisk validering slutförd:
• Compliance Score: ${validation.complianceScore}/100
• Risk Nivå: ${validation.riskLevel}
• Automatisk godkännande: ${validation.automaticApproval ? 'Ja' : 'Nej'}
• Flaggor: ${validation.flags.join(', ') || 'Inga'}`;
          
          alert(message);
        }
        
        await loadApplications(); // Refresh list with updated validation
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Validering misslyckades');
      }
    } catch (err: any) {
      console.error('Validation error:', err);
      setError('Kunde inte köra automatisk validering: ' + err.message);
    } finally {
      setValidationLoading(null);
    }
  };

  const handleAutoApprove = async (application: BusinessApplication) => {
    const confirmApproval = confirm(`Är du säker på att du vill automatiskt godkänna ${application.name}?
    
Detta kommer att:
• Godkänna företaget baserat på AI-validering
• Tilldela Tier 1 (200 SEK/dag, 20% provision)  
• Aktivera företagskontot omedelbart`);

    if (!confirmApproval) {
      return;
    }

    try {
      setAutoApprovalLoading(application.id);
      setError(null);

      const response = await authManager.makeAuthenticatedRequest(
        `/api/admin/business/${application.id}/auto-approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('Auto-approval completed:', result);
        
        if (result.success) {
          alert(`${application.name} har automatiskt godkänts!
          
• Tier: ${result.data.tier}
• Provision: ${result.data.commissionRate * 100}%
• Status: Aktiv
• Nästa steg: Företaget kan nu börja använda plattformen`);
        }
        
        await loadApplications(); // Refresh list
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Auto-godkännande misslyckades');
      }
    } catch (err: any) {
      console.error('Auto-approval error:', err);
      setError('Kunde inte automatiskt godkänna företag: ' + err.message);
    } finally {
      setAutoApprovalLoading(null);
    }
  };

  const loadAuditHistory = async (businessId: string) => {
    try {
      const response = await authManager.makeAuthenticatedRequest(
        `/api/admin/business/${businessId}/audit-history`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAuditLogs(prev => ({
            ...prev,
            [businessId]: data.data.auditLogs
          }));
        }
      } else {
        console.warn('Failed to load audit history for business:', businessId);
      }
    } catch (err) {
      console.error('Error loading audit history:', err);
    }
  };

  const toggleAuditHistory = async (businessId: string) => {
    const isShowing = showAuditHistory[businessId];
    
    setShowAuditHistory(prev => ({
      ...prev,
      [businessId]: !isShowing
    }));

    // Load audit history if not already loaded and showing
    if (!isShowing && !auditLogs[businessId]) {
      await loadAuditHistory(businessId);
    }
  };

  const getActionDisplayName = (action: string): string => {
    const actionNames: Record<string, string> = {
      'validate': 'Automatisk Validering',
      'approve': 'Godkännande',
      'reject': 'Avslag',
      'assign': 'Tilldelning',
      'update_tier': 'Tier-uppdatering',
      'add_note': 'Anteckning'
    };
    return actionNames[action] || action;
  };

  const getActionIcon = (action: string): string => {
    const actionIcons: Record<string, string> = {
      'validate': '🤖',
      'approve': '✅',
      'reject': '❌',
      'assign': '👤',
      'update_tier': '📊',
      'add_note': '📝'
    };
    return actionIcons[action] || '📋';
  };

  const getActionColor = (action: string): string => {
    const actionColors: Record<string, string> = {
      'validate': '#3b82f6',
      'approve': '#22c55e',
      'reject': '#ef4444',
      'assign': '#f59e0b',
      'update_tier': '#8b5cf6',
      'add_note': '#6b7280'
    };
    return actionColors[action] || '#6b7280';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending_review': return '#f59e0b';
      case 'needs_documentation': return '#ef4444';
      case 'approved_conditionally': return '#3b82f6';
      case 'approved': return '#22c55e';
      case 'rejected': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'pending_review': return 'Väntar granskning';
      case 'needs_documentation': return 'Behöver dokument';
      case 'approved_conditionally': return 'Villkorligt godkänd';
      case 'approved': return 'Godkänd';
      case 'rejected': return 'Avvisad';
      default: return status;
    }
  };

  const getRiskColor = (risk: string): string => {
    switch (risk) {
      case 'low': return '#22c55e';
      case 'medium': return '#f59e0b';
      case 'high': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: '#6b7280' }}>Laddar ansökningar...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Header with stats */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          color: '#1e293b', 
          margin: '0 0 16px 0' 
        }}>
          Företagsgodkännanden
        </h2>
        
        {approvalStats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#f8fafc', 
              borderRadius: '8px',
              textAlign: 'center' 
            }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>
                {approvalStats.total}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Totalt</div>
            </div>
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#fef3c7', 
              borderRadius: '8px',
              textAlign: 'center' 
            }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#92400e' }}>
                {approvalStats.pending}
              </div>
              <div style={{ fontSize: '12px', color: '#92400e' }}>Väntar</div>
            </div>
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#fee2e2', 
              borderRadius: '8px',
              textAlign: 'center' 
            }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#dc2626' }}>
                {approvalStats.needsDocumentation}
              </div>
              <div style={{ fontSize: '12px', color: '#dc2626' }}>Behöver dok.</div>
            </div>
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#fee2e2', 
              borderRadius: '8px',
              textAlign: 'center' 
            }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#dc2626' }}>
                {approvalStats.highRisk}
              </div>
              <div style={{ fontSize: '12px', color: '#dc2626' }}>Hög risk</div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {[
            { key: 'pending', label: 'Väntande' },
            { key: 'needs_documentation', label: 'Behöver dokument' },
            { key: 'approved_conditionally', label: 'Villkorligt godkända' },
            { key: 'all', label: 'Alla' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                padding: '8px 16px',
                backgroundColor: filter === tab.key ? '#3b82f6' : 'white',
                color: filter === tab.key ? 'white' : '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#dc2626',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {/* Applications list */}
      <div style={{ display: 'grid', gap: '16px' }}>
        {applications.map(app => (
          <div
            key={app.id}
            style={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              ':hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
            }}
            onClick={() => setSelectedApplication(app)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  color: '#1e293b',
                  margin: '0 0 8px 0'
                }}>
                  {app.name}
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                  <div>
                    <strong>Org.nr:</strong> {app.organizationNumber}<br/>
                    <strong>Typ:</strong> {app.businessType}<br/>
                    <strong>Plats:</strong> {app.address.city}, {app.address.region}
                  </div>
                  <div>
                    <strong>Ansökningsdatum:</strong> {new Date(app.submittedAt).toLocaleDateString('sv-SE')}<br/>
                    <strong>Månatliga transaktioner:</strong> {app.estimatedMonthlyTransactions.toLocaleString('sv-SE')}<br/>
                    <strong>Kunder/månad:</strong> {app.expectedCustomerVolume.toLocaleString('sv-SE')}
                  </div>
                </div>

                {/* Validation status */}
                <div style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  marginTop: '12px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ 
                    fontSize: '12px',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    backgroundColor: app.validation.organizationNumberValid ? '#dcfce7' : '#fee2e2',
                    color: app.validation.organizationNumberValid ? '#166534' : '#dc2626'
                  }}>
                    {app.validation.organizationNumberValid ? '✅' : '❌'} Org.nr
                  </div>
                  <div style={{ 
                    fontSize: '12px',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    backgroundColor: app.validation.documentsComplete ? '#dcfce7' : '#fee2e2',
                    color: app.validation.documentsComplete ? '#166534' : '#dc2626'
                  }}>
                    {app.validation.documentsComplete ? '✅' : '❌'} Dokument
                  </div>
                  <div style={{ 
                    fontSize: '12px',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    backgroundColor: app.validation.addressVerified ? '#dcfce7' : '#fee2e2',
                    color: app.validation.addressVerified ? '#166534' : '#dc2626'
                  }}>
                    {app.validation.addressVerified ? '✅' : '❌'} Adress
                  </div>
                  <div style={{ 
                    fontSize: '12px',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569'
                  }}>
                    Risk: <span style={{ color: getRiskColor(app.validation.riskLevel) }}>
                      {app.validation.riskLevel === 'low' ? 'Låg' : 
                       app.validation.riskLevel === 'medium' ? 'Medium' : 'Hög'}
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: '12px',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569'
                  }}>
                    Score: {app.validation.complianceScore}/100
                  </div>
                </div>

                {/* Flags */}
                {app.validation.flags.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    {app.validation.flags.map(flag => (
                      <span
                        key={flag}
                        style={{
                          display: 'inline-block',
                          fontSize: '11px',
                          padding: '2px 6px',
                          margin: '2px 4px 2px 0',
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          borderRadius: '8px'
                        }}
                      >
                        ⚠️ {flag.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}

                {/* Audit History Toggle */}
                <div style={{ 
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid #e2e8f0'
                }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAuditHistory(app.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 8px',
                      backgroundColor: 'transparent',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#374151',
                      cursor: 'pointer',
                      width: '100%',
                      justifyContent: 'center'
                    }}
                  >
                    📋 {showAuditHistory[app.id] ? 'Dölj' : 'Visa'} Granskningshistorik
                    <span style={{ fontSize: '10px' }}>
                      {showAuditHistory[app.id] ? '▼' : '▶'}
                    </span>
                  </button>

                  {/* Audit History Display */}
                  {showAuditHistory[app.id] && (
                    <div style={{
                      marginTop: '8px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      {auditLogs[app.id] && auditLogs[app.id].length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {auditLogs[app.id]
                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                            .map(log => (
                            <div
                              key={log.id}
                              style={{
                                display: 'flex',
                                alignItems: 'start',
                                gap: '8px',
                                padding: '8px',
                                backgroundColor: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '11px'
                              }}
                            >
                              <span 
                                style={{ 
                                  fontSize: '14px',
                                  color: getActionColor(log.action)
                                }}
                              >
                                {getActionIcon(log.action)}
                              </span>
                              <div style={{ flex: 1 }}>
                                <div style={{ 
                                  fontWeight: '500',
                                  color: '#1e293b',
                                  marginBottom: '2px'
                                }}>
                                  {getActionDisplayName(log.action)}
                                </div>
                                <div style={{ color: '#64748b', marginBottom: '2px' }}>
                                  Av: {log.adminName} ({log.adminRole})
                                </div>
                                <div style={{ color: '#64748b', fontSize: '10px' }}>
                                  {new Date(log.timestamp).toLocaleString('sv-SE')}
                                </div>
                                {log.details.reason && (
                                  <div style={{ 
                                    marginTop: '4px',
                                    padding: '4px 6px',
                                    backgroundColor: '#f1f5f9',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    color: '#475569'
                                  }}>
                                    {log.details.reason}
                                  </div>
                                )}
                                {log.details.previousStatus && log.details.newStatus && (
                                  <div style={{ 
                                    marginTop: '2px',
                                    fontSize: '10px',
                                    color: '#6b7280'
                                  }}>
                                    Status: {log.details.previousStatus} → {log.details.newStatus}
                                  </div>
                                )}
                                {log.details.tier && (
                                  <div style={{ 
                                    marginTop: '2px',
                                    fontSize: '10px',
                                    color: '#6b7280'
                                  }}>
                                    Tier: {log.details.tier}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ 
                          textAlign: 'center',
                          color: '#64748b',
                          fontSize: '12px',
                          padding: '12px'
                        }}>
                          Ingen granskningshistorik tillgänglig ännu
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  fontSize: '12px',
                  padding: '6px 12px',
                  borderRadius: '16px',
                  backgroundColor: getStatusColor(app.status) + '20',
                  color: getStatusColor(app.status),
                  fontWeight: '500',
                  marginBottom: '12px'
                }}>
                  {getStatusText(app.status)}
                </div>
                
                {app.assignedReviewer && (
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Granskare: {app.assignedReviewer}
                  </div>
                )}
                
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Automated validation buttons */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRunValidation(app);
                      }}
                      disabled={validationLoading === app.id}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: validationLoading === app.id ? '#9ca3af' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: validationLoading === app.id ? 'not-allowed' : 'pointer'
                      }}
                      title="Kör automatisk svensk validering"
                    >
                      {validationLoading === app.id ? '⏳ Validerar...' : '🤖 Validera'}
                    </button>
                    
                    {app.validation.automaticApproval && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAutoApprove(app);
                        }}
                        disabled={autoApprovalLoading === app.id}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: autoApprovalLoading === app.id ? '#9ca3af' : '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: autoApprovalLoading === app.id ? 'not-allowed' : 'pointer'
                        }}
                        title="Automatiskt godkännande baserat på AI-validering"
                      >
                        {autoApprovalLoading === app.id ? '⏳ Godkänner...' : '⚡ Auto-godkänn'}
                      </button>
                    )}
                  </div>
                  
                  {/* Manual approval buttons */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedApplication(app);
                        setShowApprovalModal(true);
                      }}
                      disabled={!app.validation.documentsComplete}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: app.validation.documentsComplete ? '#22c55e' : '#d1d5db',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: app.validation.documentsComplete ? 'pointer' : 'not-allowed'
                      }}
                    >
                      Godkänn
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedApplication(app);
                        setShowRejectionModal(true);
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Avvisa
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {applications.length === 0 && !loading && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: '#64748b',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '2px dashed #cbd5e1'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Inga ansökningar att visa</h3>
          <p style={{ fontSize: '14px' }}>Det finns inga företagsansökningar som matchar det valda filtret.</p>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedApplication && (
        <ApprovalModal
          application={selectedApplication}
          onApprove={handleApprove}
          onCancel={() => setShowApprovalModal(false)}
        />
      )}

      {/* Rejection Modal */}
      {showRejectionModal && selectedApplication && (
        <RejectionModal
          application={selectedApplication}
          onReject={handleReject}
          onCancel={() => setShowRejectionModal(false)}
        />
      )}
    </div>
  );
}

// Approval Modal Component
interface ApprovalModalProps {
  application: BusinessApplication;
  onApprove: (application: BusinessApplication, data: any) => void;
  onCancel: () => void;
}

function ApprovalModal({ application, onApprove, onCancel }: ApprovalModalProps) {
  const [approvalType, setApprovalType] = useState<'full' | 'conditional' | 'trial'>('full');
  const [tier, setTier] = useState(1);
  const [conditions, setConditions] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onApprove(application, {
      approvalType,
      tier,
      conditions: approvalType === 'conditional' ? conditions : [],
      notes,
      requiresFollowup: approvalType === 'conditional',
      followupDate: approvalType === 'conditional' ? 
        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() : null
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        width: '500px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
          Godkänn {application.name}
        </h3>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              Godkännandetyp:
            </label>
            <select
              value={approvalType}
              onChange={(e) => setApprovalType(e.target.value as any)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '6px'
              }}
            >
              <option value="full">Fullständigt godkännande</option>
              <option value="conditional">Villkorligt godkännande</option>
              <option value="trial">Testperiod</option>
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              Tier:
            </label>
            <select
              value={tier}
              onChange={(e) => setTier(parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '6px'
              }}
            >
              <option value={1}>Tier 1 (200 SEK/dag, 20% provision)</option>
              <option value={2}>Tier 2 (1000 SEK/dag, 18% provision)</option>
              <option value={3}>Tier 3 (5000 SEK/dag, 15% provision)</option>
            </select>
          </div>

          {approvalType === 'conditional' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                Villkor:
              </label>
              <textarea
                placeholder="Ange villkor för godkännande..."
                onChange={(e) => setConditions(e.target.value.split('\n').filter(c => c.trim()))}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  resize: 'vertical'
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              Anteckningar:
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Interna anteckningar om godkännandet..."
              style={{
                width: '100%',
                minHeight: '60px',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Avbryt
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                backgroundColor: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Godkänn företag
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Rejection Modal Component
interface RejectionModalProps {
  application: BusinessApplication;
  onReject: (application: BusinessApplication, data: any) => void;
  onCancel: () => void;
}

function RejectionModal({ application, onReject, onCancel }: RejectionModalProps) {
  const [category, setCategory] = useState<'compliance' | 'documentation' | 'risk' | 'eligibility' | 'fraud'>('compliance');
  const [reason, setReason] = useState('');
  const [allowReapplication, setAllowReapplication] = useState(true);
  const [internalNotes, setInternalNotes] = useState('');

  const categoryOptions = {
    compliance: 'Regelefterlevnad',
    documentation: 'Dokumentation',
    risk: 'Riskbedömning',
    eligibility: 'Behörighet',
    fraud: 'Bedrägeri'
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      alert('Anledning för avslag krävs');
      return;
    }
    
    onReject(application, {
      reason: reason.trim(),
      category,
      allowReapplication,
      internalNotes: internalNotes.trim(),
      customerFacing: true,
      reapplicationDate: allowReapplication ? 
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        width: '500px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
          Avvisa {application.name}
        </h3>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              Kategori:
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '6px'
              }}
            >
              {Object.entries(categoryOptions).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              Anledning (visas för kunden): *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Beskriv anledningen för avslag som kommer visas för kunden..."
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                resize: 'vertical'
              }}
              required
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
              <input
                type="checkbox"
                checked={allowReapplication}
                onChange={(e) => setAllowReapplication(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Tillåt ny ansökan (efter 30 dagar)
            </label>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              Interna anteckningar:
            </label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Interna anteckningar (visas inte för kunden)..."
              style={{
                width: '100%',
                minHeight: '60px',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Avbryt
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Avvisa företag
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
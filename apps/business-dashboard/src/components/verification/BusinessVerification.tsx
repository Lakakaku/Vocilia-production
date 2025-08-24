'use client';

import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Upload, 
  FileText, 
  X,
  Download,
  RefreshCw
} from 'lucide-react';
import {
  BusinessVerification,
  VerificationDocument,
  DocumentType,
  VerificationStatus,
  DOCUMENT_REQUIREMENTS,
  getVerificationStatusDisplay,
  getRequiredDocuments,
  isVerificationComplete,
  canSubmitVerification,
  canResubmitVerification
} from '@/types/verification';

interface BusinessVerificationProps {}

export function BusinessVerification({}: BusinessVerificationProps) {
  const [verification, setVerification] = useState<BusinessVerification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState<DocumentType | null>(null);

  useEffect(() => {
    // Mock data - in real implementation, this would fetch from API
    setTimeout(() => {
      setVerification({
        id: 'verification-1',
        businessId: 'business-1',
        status: VerificationStatus.PENDING,
        documents: [],
        businessInfo: {
          legalName: 'Café Aurora AB',
          organizationNumber: '556123-4567',
          registeredAddress: 'Storgatan 15, 111 29 Stockholm',
          contactPerson: 'Emma Larsson',
          contactEmail: 'emma.larsson@cafearura.se',
          contactPhone: '+46 8 123 456',
          businessDescription: 'Kafé och bageri med fokus på ekologiska råvaror och hållbar service',
          website: 'https://cafearura.se',
          expectedMonthlyFeedbacks: 500
        },
        requiredDocuments: getRequiredDocuments(),
        createdAt: '2024-08-20T10:00:00Z',
        updatedAt: '2024-08-20T10:00:00Z'
      });
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleFileUpload = async (docType: DocumentType, file: File) => {
    setUploadingDoc(docType);
    
    try {
      // Validate file
      const requirements = DOCUMENT_REQUIREMENTS[docType];
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
      
      if (!requirements.acceptedFormats.includes(fileExtension)) {
        throw new Error(`Filtypen ${fileExtension} stöds inte. Tillåtna format: ${requirements.acceptedFormats.join(', ')}`);
      }
      
      if (file.size > requirements.maxSize * 1024 * 1024) {
        throw new Error(`Filen är för stor. Max storlek: ${requirements.maxSize}MB`);
      }
      
      // Simulate upload
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newDocument: VerificationDocument = {
        id: Date.now().toString(),
        type: docType,
        name: file.name,
        url: URL.createObjectURL(file),
        uploadedAt: new Date().toISOString(),
        status: 'uploaded'
      };
      
      if (verification) {
        const updatedVerification = {
          ...verification,
          documents: [...verification.documents.filter(d => d.type !== docType), newDocument],
          updatedAt: new Date().toISOString()
        };
        setVerification(updatedVerification);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Fel vid filuppladdning');
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleRemoveDocument = (documentId: string) => {
    if (!verification) return;
    
    const updatedVerification = {
      ...verification,
      documents: verification.documents.filter(d => d.id !== documentId),
      updatedAt: new Date().toISOString()
    };
    setVerification(updatedVerification);
  };

  const handleSubmitVerification = async () => {
    if (!verification || !canSubmitVerification(verification)) return;
    
    try {
      setIsLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const updatedVerification = {
        ...verification,
        status: VerificationStatus.SUBMITTED,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      setVerification(updatedVerification);
      
    } catch (error) {
      alert('Fel vid inskickning av verifiering');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!verification) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Ingen verifiering hittades</p>
      </div>
    );
  }

  const statusDisplay = getVerificationStatusDisplay(verification.status);
  const isComplete = isVerificationComplete(verification);
  const canSubmit = canSubmitVerification(verification);
  const canResubmit = canResubmitVerification(verification);

  return (
    <div className="space-y-6">
      {/* Status header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          <StatusIcon status={verification.status} />
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">
              Företagsverifiering
            </h2>
            <p className="text-gray-600 mt-1">
              {statusDisplay.description}
            </p>
            {verification.rejectionReason && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800 text-sm">
                  <strong>Anledning till avvisning:</strong> {verification.rejectionReason}
                </p>
              </div>
            )}
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium bg-${statusDisplay.color}-100 text-${statusDisplay.color}-800`}>
            {statusDisplay.label}
          </div>
        </div>
      </div>

      {/* Business information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Företagsinformation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Företagsnamn</label>
            <p className="mt-1 text-sm text-gray-900">{verification.businessInfo.legalName}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Organisationsnummer</label>
            <p className="mt-1 text-sm text-gray-900">{verification.businessInfo.organizationNumber}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Kontaktperson</label>
            <p className="mt-1 text-sm text-gray-900">{verification.businessInfo.contactPerson}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">E-post</label>
            <p className="mt-1 text-sm text-gray-900">{verification.businessInfo.contactEmail}</p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Registrerad adress</label>
            <p className="mt-1 text-sm text-gray-900">{verification.businessInfo.registeredAddress}</p>
          </div>
        </div>
      </div>

      {/* Document upload */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Dokument</h3>
          <div className="text-sm text-gray-500">
            {verification.documents.length} av {verification.requiredDocuments.length} krävda dokument uppladdade
          </div>
        </div>

        <div className="space-y-4">
          {verification.requiredDocuments.map((docType) => (
            <DocumentUploadCard
              key={docType}
              docType={docType}
              document={verification.documents.find(d => d.type === docType)}
              isUploading={uploadingDoc === docType}
              onUpload={(file) => handleFileUpload(docType, file)}
              onRemove={handleRemoveDocument}
              canEdit={verification.status !== VerificationStatus.UNDER_REVIEW && 
                       verification.status !== VerificationStatus.APPROVED}
            />
          ))}
        </div>
      </div>

      {/* Action buttons */}
      {(canSubmit || canResubmit) && (
        <div className="flex justify-end">
          <button
            onClick={handleSubmitVerification}
            disabled={!isComplete}
            className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {canResubmit ? <RefreshCw className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            {canResubmit ? 'Skicka in igen' : 'Skicka in för granskning'}
          </button>
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: VerificationStatus }) {
  switch (status) {
    case VerificationStatus.APPROVED:
      return <CheckCircle className="w-8 h-8 text-green-500" />;
    case VerificationStatus.REJECTED:
      return <X className="w-8 h-8 text-red-500" />;
    case VerificationStatus.UNDER_REVIEW:
    case VerificationStatus.SUBMITTED:
      return <Clock className="w-8 h-8 text-blue-500" />;
    case VerificationStatus.REQUIRES_ADDITIONAL_INFO:
      return <AlertCircle className="w-8 h-8 text-orange-500" />;
    default:
      return <Clock className="w-8 h-8 text-gray-400" />;
  }
}

interface DocumentUploadCardProps {
  docType: DocumentType;
  document?: VerificationDocument;
  isUploading: boolean;
  canEdit: boolean;
  onUpload: (file: File) => void;
  onRemove: (documentId: string) => void;
}

function DocumentUploadCard({ docType, document, isUploading, canEdit, onUpload, onRemove }: DocumentUploadCardProps) {
  const requirements = DOCUMENT_REQUIREMENTS[docType];
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    e.target.value = ''; // Reset input
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900">{requirements.name}</h4>
            {requirements.required && (
              <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                Obligatorisk
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-2">{requirements.description}</p>
          <p className="text-xs text-gray-500">
            Format: {requirements.acceptedFormats.join(', ')} • Max: {requirements.maxSize}MB
          </p>
        </div>

        <div className="ml-4">
          {document ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Uppladdad</span>
              </div>
              {canEdit && (
                <button
                  onClick={() => onRemove(document.id)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : canEdit ? (
            <div className="relative">
              <input
                type="file"
                accept={requirements.acceptedFormats.map(f => `.${f}`).join(',')}
                onChange={handleFileSelect}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <button
                disabled={isUploading}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:bg-gray-300"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Laddar upp...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Ladda upp
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Väntar på upload</div>
          )}
        </div>
      </div>

      {document && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-900">{document.name}</span>
            <span className="text-xs text-gray-500">
              • Uppladdad {new Date(document.uploadedAt).toLocaleDateString('sv-SE')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
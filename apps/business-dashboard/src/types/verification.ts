export enum VerificationStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REQUIRES_ADDITIONAL_INFO = 'requires_additional_info'
}

export enum DocumentType {
  BUSINESS_REGISTRATION = 'business_registration',
  TAX_CERTIFICATE = 'tax_certificate',
  IDENTITY_DOCUMENT = 'identity_document',
  BANK_STATEMENT = 'bank_statement',
  OTHER = 'other'
}

export interface VerificationDocument {
  id: string;
  type: DocumentType;
  name: string;
  url: string;
  uploadedAt: string;
  status: 'uploaded' | 'verified' | 'rejected';
  rejectionReason?: string;
}

export interface BusinessVerification {
  id: string;
  businessId: string;
  status: VerificationStatus;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  notes?: string;
  rejectionReason?: string;
  documents: VerificationDocument[];
  businessInfo: {
    legalName: string;
    organizationNumber: string;
    registeredAddress: string;
    contactPerson: string;
    contactEmail: string;
    contactPhone: string;
    businessDescription: string;
    website?: string;
    expectedMonthlyFeedbacks: number;
  };
  requiredDocuments: DocumentType[];
  additionalRequirements?: string[];
  createdAt: string;
  updatedAt: string;
}

export const DOCUMENT_REQUIREMENTS: Record<DocumentType, { 
  name: string; 
  description: string; 
  required: boolean;
  acceptedFormats: string[];
  maxSize: number; // in MB
}> = {
  [DocumentType.BUSINESS_REGISTRATION]: {
    name: 'Företagsregistrering',
    description: 'Registreringsbevis från Bolagsverket eller motsvarande',
    required: true,
    acceptedFormats: ['pdf', 'jpg', 'png'],
    maxSize: 10
  },
  [DocumentType.TAX_CERTIFICATE]: {
    name: 'Skatteregistreringsbevis',
    description: 'Bevis på skatteregistrering (F-skatt eller motsvarande)',
    required: true,
    acceptedFormats: ['pdf', 'jpg', 'png'],
    maxSize: 10
  },
  [DocumentType.IDENTITY_DOCUMENT]: {
    name: 'Identitetshandling',
    description: 'Körkort, pass eller nationellt ID för kontaktperson',
    required: true,
    acceptedFormats: ['pdf', 'jpg', 'png'],
    maxSize: 10
  },
  [DocumentType.BANK_STATEMENT]: {
    name: 'Kontoutdrag',
    description: 'Senaste månadens kontoutdrag för företagskonto',
    required: false,
    acceptedFormats: ['pdf'],
    maxSize: 10
  },
  [DocumentType.OTHER]: {
    name: 'Övrigt',
    description: 'Andra relevanta dokument',
    required: false,
    acceptedFormats: ['pdf', 'jpg', 'png', 'doc', 'docx'],
    maxSize: 10
  }
};

export function getVerificationStatusDisplay(status: VerificationStatus): { 
  label: string; 
  color: string;
  description: string; 
} {
  switch (status) {
    case VerificationStatus.PENDING:
      return { 
        label: 'Väntande', 
        color: 'gray',
        description: 'Verifieringsprocessen har inte påbörjats' 
      };
    case VerificationStatus.SUBMITTED:
      return { 
        label: 'Inskickad', 
        color: 'blue',
        description: 'Dokumenten har skickats in och väntar på granskning' 
      };
    case VerificationStatus.UNDER_REVIEW:
      return { 
        label: 'Under granskning', 
        color: 'yellow',
        description: 'Dina dokument granskas av vårt team' 
      };
    case VerificationStatus.APPROVED:
      return { 
        label: 'Godkänd', 
        color: 'green',
        description: 'Din verksamhet är verifierad och godkänd' 
      };
    case VerificationStatus.REJECTED:
      return { 
        label: 'Avvisad', 
        color: 'red',
        description: 'Verifieringen avvisades, se anledning nedan' 
      };
    case VerificationStatus.REQUIRES_ADDITIONAL_INFO:
      return { 
        label: 'Kräver mer information', 
        color: 'orange',
        description: 'Ytterligare information eller dokument krävs' 
      };
  }
}

export function getRequiredDocuments(businessType?: string): DocumentType[] {
  // Basic requirements for all businesses
  const required = [
    DocumentType.BUSINESS_REGISTRATION,
    DocumentType.TAX_CERTIFICATE,
    DocumentType.IDENTITY_DOCUMENT
  ];

  // Additional requirements based on business type or other factors
  // This can be extended based on specific needs
  
  return required;
}

export function isVerificationComplete(verification: BusinessVerification): boolean {
  const requiredDocs = verification.requiredDocuments;
  const uploadedDocs = verification.documents.map(doc => doc.type);
  
  return requiredDocs.every(reqDoc => uploadedDocs.includes(reqDoc));
}

export function canSubmitVerification(verification: BusinessVerification): boolean {
  return verification.status === VerificationStatus.PENDING && 
         isVerificationComplete(verification);
}

export function canResubmitVerification(verification: BusinessVerification): boolean {
  return verification.status === VerificationStatus.REJECTED || 
         verification.status === VerificationStatus.REQUIRES_ADDITIONAL_INFO;
}
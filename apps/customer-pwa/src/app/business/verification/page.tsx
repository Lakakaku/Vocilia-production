'use client';

import { BusinessVerification } from '../../../business-components/verification/BusinessVerification';

export default function VerificationPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Företagsverifiering</h1>
        <p className="text-gray-600">
          Verifiera ditt företag för att börja ta emot feedback och belöningar
        </p>
      </div>

      {/* Verification process */}
      <BusinessVerification />
    </div>
  );
}
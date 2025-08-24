'use client';

import { ROICalculator } from '@/components/analytics/ROICalculator';

export default function ROIPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ROI-kalkylator</h1>
        <p className="text-gray-600">
          Beräkna avkastningen på din investering i AI Feedback-plattformen
        </p>
      </div>

      {/* ROI Calculator */}
      <ROICalculator />
    </div>
  );
}
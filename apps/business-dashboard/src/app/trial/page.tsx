'use client';

import { TrialManager } from '@/components/trial/TrialManager';

export default function TrialPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Provperiod</h1>
        <p className="text-gray-600">
          Hantera din gratisprovperiod och uppgradera när du är redo
        </p>
      </div>

      {/* Trial Manager */}
      <TrialManager />
    </div>
  );
}
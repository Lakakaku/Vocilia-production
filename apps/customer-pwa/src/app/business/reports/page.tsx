'use client';

import { PrintReports } from '../../../business-components/reports/PrintReports';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Utskriftsvänliga rapporter</h1>
        <p className="text-gray-600">
          Skapa professionella rapporter för utskrift och presentation
        </p>
      </div>

      {/* Print Reports */}
      <PrintReports />
    </div>
  );
}
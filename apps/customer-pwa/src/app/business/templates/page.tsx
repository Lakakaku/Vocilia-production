'use client';

import { ContextTemplates } from '../../../business-components/templates/ContextTemplates';

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kontext-mallar</h1>
        <p className="text-gray-600">
          Hantera och använd mallar för att snabbt konfigurera företagskontext för AI-utvärdering
        </p>
      </div>

      {/* Context Templates */}
      <ContextTemplates />
    </div>
  );
}
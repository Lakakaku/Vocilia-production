'use client';

import { useState } from 'react';
import { LocationManager } from '@/components/locations/LocationManager';

export default function LocationsPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platser</h1>
        <p className="text-gray-600">Hantera dina affärsplatser och QR-koder</p>
      </div>

      {/* Location management */}
      <LocationManager />
    </div>
  );
}
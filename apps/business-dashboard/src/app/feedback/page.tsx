'use client';

import { useState } from 'react';
import { FeedbackList } from '@/components/feedback/FeedbackList';
import { FeedbackFilters } from '@/components/feedback/FeedbackFilters';
import { FeedbackStats } from '@/components/feedback/FeedbackStats';

export type FeedbackFilter = {
  search: string;
  sentiment: 'all' | 'positive' | 'neutral' | 'negative';
  category: string;
  dateRange: '7d' | '30d' | '90d' | 'all';
  scoreRange: [number, number];
};

const initialFilters: FeedbackFilter = {
  search: '',
  sentiment: 'all',
  category: 'all',
  dateRange: '30d',
  scoreRange: [0, 100],
};

export default function FeedbackPage() {
  const [filters, setFilters] = useState<FeedbackFilter>(initialFilters);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kundåterkoppling</h1>
        <p className="text-gray-600">Hantera och analysera all kundåterkoppling</p>
      </div>

      {/* Stats overview */}
      <FeedbackStats filters={filters} />

      {/* Filters */}
      <FeedbackFilters 
        filters={filters} 
        onFiltersChange={setFilters}
        onResetFilters={() => setFilters(initialFilters)}
      />

      {/* Feedback list */}
      <FeedbackList filters={filters} />
    </div>
  );
}
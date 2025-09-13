'use client';

import { useState } from 'react';
import { Search, Filter, X, Calendar, Star } from 'lucide-react';
import type { FeedbackFilter } from '@/app/feedback/page';

interface FeedbackFiltersProps {
  filters: FeedbackFilter;
  onFiltersChange: (filters: FeedbackFilter) => void;
  onResetFilters: () => void;
}

const categories = [
  { value: 'all', label: 'Alla kategorier' },
  { value: 'service', label: 'Service' },
  { value: 'kvalitet', label: 'Kvalitet' },
  { value: 'miljö', label: 'Miljö' },
  { value: 'produkter', label: 'Produkter' },
  { value: 'väntetid', label: 'Väntetid' },
];

const dateRanges = [
  { value: '7d', label: 'Senaste 7 dagarna' },
  { value: '30d', label: 'Senaste 30 dagarna' },
  { value: '90d', label: 'Senaste 90 dagarna' },
  { value: 'all', label: 'Alla' },
];

const sentiments = [
  { value: 'all', label: 'Alla' },
  { value: 'positive', label: 'Positiv' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negativ' },
];

export function FeedbackFilters({ filters, onFiltersChange, onResetFilters }: FeedbackFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilter = (key: keyof FeedbackFilter, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = 
    filters.search !== '' || 
    filters.sentiment !== 'all' || 
    filters.category !== 'all' || 
    filters.dateRange !== '30d' || 
    filters.scoreRange[0] !== 0 || 
    filters.scoreRange[1] !== 100;

  return (
    <div className="card">
      <div className="p-6">
        {/* Search and basic filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Sök i feedback text, kunder..."
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
              />
            </div>
          </div>

          {/* Quick filters */}
          <div className="flex gap-3">
            {/* Date range */}
            <select
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              value={filters.dateRange}
              onChange={(e) => updateFilter('dateRange', e.target.value)}
            >
              {dateRanges.map(range => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>

            {/* Advanced filters toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center px-3 py-2 rounded-md border transition-colors ${
                showAdvanced
                  ? 'bg-primary-50 border-primary-200 text-primary-700'
                  : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Filter className="w-4 h-4 mr-2" />
              Avancerad
            </button>

            {/* Reset filters */}
            {hasActiveFilters && (
              <button
                onClick={onResetFilters}
                className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md border border-gray-300"
              >
                <X className="w-4 h-4 mr-2" />
                Återställ
              </button>
            )}
          </div>
        </div>

        {/* Advanced filters */}
        {showAdvanced && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Sentiment filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sentiment
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  value={filters.sentiment}
                  onChange={(e) => updateFilter('sentiment', e.target.value)}
                >
                  {sentiments.map(sentiment => (
                    <option key={sentiment.value} value={sentiment.value}>
                      {sentiment.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kategori
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  value={filters.category}
                  onChange={(e) => updateFilter('category', e.target.value)}
                >
                  {categories.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Score range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Star className="w-4 h-4 inline mr-1" />
                  Poäng: {filters.scoreRange[0]} - {filters.scoreRange[1]}
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.scoreRange[0]}
                    onChange={(e) => updateFilter('scoreRange', [Number(e.target.value), filters.scoreRange[1]])}
                    className="flex-1"
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filters.scoreRange[1]}
                    onChange={(e) => updateFilter('scoreRange', [filters.scoreRange[0], Number(e.target.value)])}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
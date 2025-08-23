'use client';

import { useState } from 'react';
import { Clock, User, Star, MessageSquare, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import type { FeedbackFilter } from '@/app/feedback/page';

interface FeedbackItem {
  id: string;
  customer: string;
  score: number;
  categories: string[];
  excerpt: string;
  fullText: string;
  reward: string;
  time: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  metadata: {
    location?: string;
    purchaseAmount?: number;
    items?: string[];
    deviceType?: string;
  };
}

// Extended mock data
const mockFeedback: FeedbackItem[] = [
  {
    id: '1',
    customer: 'Anonym Kund',
    score: 85,
    categories: ['service', 'kvalitet'],
    excerpt: 'Mycket bra service och trevlig personal. Kaffe var riktigt bra och...',
    fullText: 'Mycket bra service och trevlig personal. Kaffe var riktigt bra och atmosfären var mysig. Jag kommer definitivt tillbaka. Personalen tog sig tid att förklara olika kaffesorter och hjälpte mig hitta något som passade min smak. Miljön var ren och inbjudande.',
    reward: '12.50 kr',
    time: '2 min sedan',
    sentiment: 'positive',
    metadata: {
      location: 'Stockholm, Södermalm',
      purchaseAmount: 125,
      items: ['Cappuccino', 'Kanelbulle'],
      deviceType: 'iPhone'
    }
  },
  {
    id: '2',
    customer: 'Anonym Kund',
    score: 67,
    categories: ['miljö', 'service'],
    excerpt: 'Butiken var ren och välorganiserad. Dock var det lite långsamt i kassan...',
    fullText: 'Butiken var ren och välorganiserad. Dock var det lite långsamt i kassan och jag fick vänta längre än väntat. Personalen var trevlig men verkade lite stressad. Kaffet var okej men inget speciellt.',
    reward: '4.25 kr',
    time: '15 min sedan',
    sentiment: 'neutral',
    metadata: {
      location: 'Stockholm, Östermalm', 
      purchaseAmount: 85,
      items: ['Latte', 'Croissant'],
      deviceType: 'Android'
    }
  },
  {
    id: '3',
    customer: 'Anonym Kund',
    score: 92,
    categories: ['produkter', 'service', 'kvalitet'],
    excerpt: 'Fantastisk upplevelse! Personalen var mycket kunnig och hjälpsam...',
    fullText: 'Fantastisk upplevelse! Personalen var mycket kunnig och hjälpsam. Kaffet var extraordinärt och bakverken var färska och välsmakande. Atmosfären var perfekt för att arbeta eller träffa vänner. Detta är definitivt mitt nya favoritcafé.',
    reward: '18.75 kr',
    time: '32 min sedan',
    sentiment: 'positive',
    metadata: {
      location: 'Stockholm, Vasastan',
      purchaseAmount: 175,
      items: ['Espresso', 'Americano', 'Äppelpaj'],
      deviceType: 'iPhone'
    }
  },
  {
    id: '4',
    customer: 'Anonym Kund',
    score: 58,
    categories: ['miljö', 'väntetid'],
    excerpt: 'Lite rörigt i butiken och fick vänta länge vid kassan. Personalen var...',
    fullText: 'Lite rörigt i butiken och fick vänta länge vid kassan. Personalen var stressad och inte särskilt hjälpsam. Kaffet var ljummet när jag fick det. Behöver förbättra organisationen.',
    reward: '0 kr',
    time: '1 tim sedan',
    sentiment: 'negative',
    metadata: {
      location: 'Stockholm, Gamla Stan',
      purchaseAmount: 95,
      items: ['Cappuccino'],
      deviceType: 'Android'
    }
  },
];

interface FeedbackListProps {
  filters: FeedbackFilter;
}

export function FeedbackList({ filters }: FeedbackListProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'time' | 'score' | 'sentiment'>('time');

  // Filter and sort feedback based on current filters
  const filteredFeedback = mockFeedback
    .filter(item => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          item.fullText.toLowerCase().includes(searchLower) ||
          item.customer.toLowerCase().includes(searchLower) ||
          item.categories.some(cat => cat.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      // Sentiment filter
      if (filters.sentiment !== 'all' && item.sentiment !== filters.sentiment) {
        return false;
      }

      // Category filter
      if (filters.category !== 'all' && !item.categories.includes(filters.category)) {
        return false;
      }

      // Score range filter
      if (item.score < filters.scoreRange[0] || item.score > filters.scoreRange[1]) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return b.score - a.score;
        case 'sentiment':
          const sentimentOrder = { positive: 3, neutral: 2, negative: 1 };
          return sentimentOrder[b.sentiment] - sentimentOrder[a.sentiment];
        default:
          return 0; // Keep original order for time
      }
    });

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-600 bg-green-100';
      case 'negative':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Feedback ({filteredFeedback.length})
            </h3>
            <p className="text-sm text-gray-600">
              {filters.search && `Sökning: "${filters.search}"`}
              {filters.sentiment !== 'all' && ` • ${filters.sentiment}`}
              {filters.category !== 'all' && ` • ${filters.category}`}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <label className="text-sm text-gray-600">Sortera:</label>
            <select
              className="text-sm border border-gray-300 rounded px-2 py-1"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="time">Tid</option>
              <option value="score">Poäng</option>
              <option value="sentiment">Sentiment</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Feedback items */}
      <div className="divide-y divide-gray-200">
        {filteredFeedback.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ingen feedback hittades</h3>
            <p className="text-gray-600">Försök justera dina filter för att se fler resultat.</p>
          </div>
        ) : (
          filteredFeedback.map((feedback) => (
            <div key={feedback.id} className="p-6">
              <div className="flex items-start space-x-4">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-500" />
                  </div>
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900">{feedback.customer}</p>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(feedback.score)}`}>
                        <div className="flex items-center space-x-1">
                          <Star className="w-3 h-3" />
                          <span>{feedback.score}</span>
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${getSentimentColor(feedback.sentiment)}`}>
                        {feedback.sentiment}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 text-sm text-gray-500">
                      <span>{feedback.reward}</span>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{feedback.time}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Categories */}
                  <div className="mt-1 flex items-center space-x-1">
                    {feedback.categories.map((category) => (
                      <span
                        key={category}
                        className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                  
                  {/* Text content */}
                  <div className="mt-2">
                    <p className="text-sm text-gray-700">
                      {expandedItems.has(feedback.id) ? feedback.fullText : feedback.excerpt}
                    </p>
                  </div>
                  
                  {/* Metadata (only when expanded) */}
                  {expandedItems.has(feedback.id) && feedback.metadata && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-md">
                      <h4 className="text-xs font-medium text-gray-900 mb-2">Metadata</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                        {feedback.metadata.location && (
                          <div>
                            <span className="font-medium">Plats:</span> {feedback.metadata.location}
                          </div>
                        )}
                        {feedback.metadata.purchaseAmount && (
                          <div>
                            <span className="font-medium">Köpbelopp:</span> {feedback.metadata.purchaseAmount} kr
                          </div>
                        )}
                        {feedback.metadata.items && (
                          <div className="col-span-2">
                            <span className="font-medium">Produkter:</span> {feedback.metadata.items.join(', ')}
                          </div>
                        )}
                        {feedback.metadata.deviceType && (
                          <div>
                            <span className="font-medium">Enhet:</span> {feedback.metadata.deviceType}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="mt-3 flex items-center space-x-4">
                    <button 
                      onClick={() => toggleExpanded(feedback.id)}
                      className="text-sm text-primary-600 hover:text-primary-800 font-medium flex items-center"
                    >
                      {expandedItems.has(feedback.id) ? (
                        <>
                          <ChevronUp className="w-4 h-4 mr-1" />
                          Visa mindre
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4 mr-1" />
                          Visa mer
                        </>
                      )}
                    </button>
                    <button className="text-sm text-gray-600 hover:text-gray-800 font-medium flex items-center">
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Öppna detaljer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Footer */}
      {filteredFeedback.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Visar {filteredFeedback.length} av {mockFeedback.length} feedback
            </p>
            <button className="btn-secondary text-sm">
              Ladda fler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
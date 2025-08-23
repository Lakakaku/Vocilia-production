'use client';

import { MessageSquare, Star, Clock, User } from 'lucide-react';

const recentFeedback = [
  {
    id: '1',
    customer: 'Anonym Kund',
    score: 85,
    categories: ['service', 'kvalitet'],
    excerpt: 'Mycket bra service och trevlig personal. Kaffe var riktigt bra och...',
    reward: '12.50 kr',
    time: '2 min sedan',
    sentiment: 'positive' as const
  },
  {
    id: '2',
    customer: 'Anonym Kund',
    score: 67,
    categories: ['miljö', 'service'],
    excerpt: 'Butiken var ren och välorganiserad. Dock var det lite långsamt i kassan...',
    reward: '4.25 kr',
    time: '15 min sedan',
    sentiment: 'neutral' as const
  },
  {
    id: '3',
    customer: 'Anonym Kund',
    score: 92,
    categories: ['produkter', 'service', 'kvalitet'],
    excerpt: 'Fantastisk upplevelse! Personalen var mycket kunnig och hjälpsam...',
    reward: '18.75 kr',
    time: '32 min sedan',
    sentiment: 'positive' as const
  },
  {
    id: '4',
    customer: 'Anonym Kund',
    score: 58,
    categories: ['miljö', 'väntetid'],
    excerpt: 'Lite rörigt i butiken och fick vänta länge vid kassan. Personalen var...',
    reward: '0 kr',
    time: '1 tim sedan',
    sentiment: 'negative' as const
  },
];

export function RecentFeedback() {
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
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Senaste Feedback</h3>
        <p className="text-sm text-gray-600">De mest aktuella kundkommentarerna</p>
      </div>
      
      <div className="divide-y divide-gray-200">
        {recentFeedback.map((feedback) => (
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
                
                {/* Excerpt */}
                <p className="mt-2 text-sm text-gray-700 line-clamp-2">
                  {feedback.excerpt}
                </p>
                
                {/* Actions */}
                <div className="mt-3">
                  <button className="text-sm text-primary-600 hover:text-primary-800 font-medium">
                    Läs mer →
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <button className="btn-secondary w-full">
          Visa alla feedback
        </button>
      </div>
    </div>
  );
}
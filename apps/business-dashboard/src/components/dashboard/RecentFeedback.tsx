'use client';

import { MessageSquare, Star, Clock, User, Loader2 } from 'lucide-react';
import { useBusinessContext } from '@/contexts/BusinessContext';
import { useFeedbackData } from '../../services/hooks';

interface FeedbackItem {
  id: string;
  qualityScore: number;
  rewardAmount: number;
  categories: string[];
  transcript?: string;
  sentiment?: number;
  createdAt: string;
  verificationType: string;
  verificationStatus?: string;
}

export function RecentFeedback() {
  const { businessId } = useBusinessContext();
  const { data: feedbackData, loading, error } = useFeedbackData(
    businessId || '', 
    { limit: 4 }
  );

  const getSentimentColor = (sentiment?: number) => {
    if (!sentiment) return 'text-gray-600 bg-gray-100';
    if (sentiment > 0.3) return 'text-green-600 bg-green-100';
    if (sentiment < -0.3) return 'text-red-600 bg-red-100';
    return 'text-yellow-600 bg-yellow-100';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} min sedan`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} tim sedan`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} dag sedan`;
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Senaste Feedback</h3>
          <p className="text-sm text-gray-600">De mest aktuella kundkommentarerna</p>
        </div>
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Senaste Feedback</h3>
          <p className="text-sm text-gray-600">De mest aktuella kundkommentarerna</p>
        </div>
        <div className="p-8 text-center">
          <p className="text-red-600">Kunde inte ladda feedback data</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const recentFeedback = feedbackData?.feedback || [];

  if (recentFeedback.length === 0) {
    return (
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Senaste Feedback</h3>
          <p className="text-sm text-gray-600">De mest aktuella kundkommentarerna</p>
        </div>
        <div className="p-8 text-center">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Ingen feedback än</p>
          <p className="text-sm text-gray-500 mt-1">
            Kunder kommer att se deras feedback här när de börjar använda din butikskod
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Senaste Feedback</h3>
        <p className="text-sm text-gray-600">De mest aktuella kundkommentarerna</p>
      </div>
      
      <div className="divide-y divide-gray-200">
        {recentFeedback.map((feedback: FeedbackItem) => (
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
                    <p className="text-sm font-medium text-gray-900">Anonym Kund</p>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(feedback.qualityScore)}`}>
                      <div className="flex items-center space-x-1">
                        <Star className="w-3 h-3" />
                        <span>{feedback.qualityScore}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 text-sm text-gray-500">
                    <span>{feedback.rewardAmount} kr</span>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{formatTimeAgo(feedback.createdAt)}</span>
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
                {feedback.transcript && (
                  <p className="mt-2 text-sm text-gray-700 line-clamp-2">
                    {feedback.transcript.length > 100 
                      ? `${feedback.transcript.substring(0, 100)}...` 
                      : feedback.transcript
                    }
                  </p>
                )}
                
                {/* Actions */}
                {feedback.transcript && feedback.transcript.length > 100 && (
                  <div className="mt-3">
                    <button className="text-sm text-primary-600 hover:text-primary-800 font-medium">
                      Läs mer →
                    </button>
                  </div>
                )}
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
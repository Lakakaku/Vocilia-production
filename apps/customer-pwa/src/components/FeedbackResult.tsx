import { motion } from 'framer-motion';
import { Award, TrendingUp, MessageSquare, Gift, Star, ArrowRight } from 'lucide-react';

interface FeedbackResultProps {
  result: {
    qualityScore: number;
    rewardAmount: number;
    rewardTier: string;
    feedbackCategories: string[];
    aiEvaluation?: {
      reasoning: string;
      authenticity: number;
      concreteness: number;
      depth: number;
      sentiment: number;
    };
  };
  businessName: string;
  onComplete: () => void;
}

export function FeedbackResult({ result, businessName, onComplete }: FeedbackResultProps) {
  const { qualityScore, rewardAmount, rewardTier, feedbackCategories, aiEvaluation } = result;

  const getTierInfo = (tier: string) => {
    switch (tier) {
      case 'exceptional':
        return {
          label: 'Exceptionell',
          color: 'from-yellow-400 to-orange-500',
          bgColor: 'bg-yellow-50 border-yellow-200',
          textColor: 'text-yellow-800',
          icon: '🏆'
        };
      case 'very_good':
        return {
          label: 'Mycket Bra',
          color: 'from-green-400 to-blue-500',
          bgColor: 'bg-green-50 border-green-200',
          textColor: 'text-green-800',
          icon: '🌟'
        };
      case 'acceptable':
        return {
          label: 'Acceptabel',
          color: 'from-blue-400 to-purple-500',
          bgColor: 'bg-blue-50 border-blue-200',
          textColor: 'text-blue-800',
          icon: '👍'
        };
      default:
        return {
          label: 'Otillräcklig',
          color: 'from-gray-400 to-gray-600',
          bgColor: 'bg-gray-50 border-gray-200',
          textColor: 'text-gray-700',
          icon: '💭'
        };
    }
  };

  const tierInfo = getTierInfo(rewardTier);

  const ScoreCircle = ({ score, label }: { score: number; label: string }) => (
    <div className="text-center">
      <div className="relative w-16 h-16 mx-auto mb-2">
        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-gray-200"
            stroke="currentColor"
            strokeWidth="3"
            fill="transparent"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className="text-blue-500"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${score}, 100`}
            strokeLinecap="round"
            fill="transparent"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-700">{score}</span>
        </div>
      </div>
      <p className="text-xs text-gray-600 font-medium">{label}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="px-4 py-6 max-w-md mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
            className="text-6xl mb-4"
          >
            {tierInfo.icon}
          </motion.div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tack för din feedback!</h1>
          <p className="text-gray-600">Till {businessName}</p>
        </motion.div>

        {/* Main Result Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6"
        >
          {/* Quality Score */}
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6, type: "spring", stiffness: 100 }}
              className="relative w-32 h-32 mx-auto mb-4"
            >
              <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-gray-200"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="transparent"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <motion.path
                  className={`bg-gradient-to-r ${tierInfo.color} text-transparent bg-clip-text`}
                  stroke="url(#gradient)"
                  strokeWidth="2"
                  strokeDasharray={`${qualityScore}, 100`}
                  strokeLinecap="round"
                  fill="transparent"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  initial={{ strokeDasharray: "0, 100" }}
                  animate={{ strokeDasharray: `${qualityScore}, 100` }}
                  transition={{ delay: 1, duration: 1.5, ease: "easeOut" }}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>
              </svg>
              
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.2 }}
                    className="text-3xl font-bold text-gray-900"
                  >
                    {qualityScore}
                  </motion.div>
                  <div className="text-xs text-gray-500">av 100</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4 }}
              className={`inline-block px-4 py-2 rounded-full ${tierInfo.bgColor} border mb-3`}
            >
              <span className={`font-semibold ${tierInfo.textColor}`}>
                {tierInfo.label} Feedback
              </span>
            </motion.div>
          </div>

          {/* Reward Amount */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.6 }}
            className="text-center mb-6"
          >
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Gift className="w-6 h-6 text-green-600" />
              <span className="text-3xl font-bold text-green-600">
                {rewardAmount.toFixed(2)} SEK
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Cashback belöning
            </p>
            
            {rewardAmount > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                <p className="text-sm text-green-800">
                  💳 Belöningen kommer att överföras inom 24 timmar
                </p>
              </div>
            )}
          </motion.div>

          {/* Detailed Scores */}
          {aiEvaluation && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.8 }}
              className="border-t border-gray-100 pt-6"
            >
              <h3 className="font-semibold text-gray-900 mb-4 text-center">Detaljerad Bedömning</h3>
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                <ScoreCircle score={aiEvaluation.authenticity} label="Äkthet" />
                <ScoreCircle score={aiEvaluation.concreteness} label="Specificitet" />
                <ScoreCircle score={aiEvaluation.depth} label="Djup" />
              </div>

              {aiEvaluation.reasoning && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <MessageSquare className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-blue-900 mb-1">AI-analys</p>
                      <p className="text-sm text-blue-800">{aiEvaluation.reasoning}</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Categories */}
        {feedbackCategories && feedbackCategories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6"
          >
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Feedback Kategorier
            </h3>
            
            <div className="flex flex-wrap gap-2">
              {feedbackCategories.map((category, index) => (
                <motion.span
                  key={category}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 2.2 + index * 0.1 }}
                  className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium border border-purple-200"
                >
                  {category}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Tips for Better Feedback */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.4 }}
          className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl p-6 mb-8"
        >
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <Star className="w-5 h-5 mr-2 text-yellow-500" />
            Tips för Nästa Gång
          </h3>
          
          <div className="space-y-2 text-sm text-gray-700">
            {qualityScore < 60 && (
              <>
                <p>• Var mer specifik om vad du upplevde</p>
                <p>• Nämn konkreta detaljer om produkter eller service</p>
                <p>• Förklara vad som var bra och vad som kan förbättras</p>
              </>
            )}
            
            {qualityScore >= 60 && qualityScore < 90 && (
              <>
                <p>• Fortsätt vara specifik i din feedback</p>
                <p>• Inkludera fler detaljer om din upplevelse</p>
                <p>• Förslag på förbättringar uppskattas alltid</p>
              </>
            )}
            
            {qualityScore >= 90 && (
              <>
                <p>• Fantastisk feedback! Fortsätt så här</p>
                <p>• Din detaljerade återkoppling hjälper verkligen</p>
                <p>• Tack för att du tar dig tid att dela dina tankar</p>
              </>
            )}
          </div>
        </motion.div>

        {/* Action Button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.6 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onComplete}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-4 rounded-xl shadow-lg flex items-center justify-center space-x-2"
        >
          <span>Klar</span>
          <ArrowRight className="w-5 h-5" />
        </motion.button>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.8 }}
          className="text-center mt-6"
        >
          <p className="text-xs text-gray-500">
            Tack för att du delar din feedback! 🙏
          </p>
        </motion.div>
      </div>
    </div>
  );
}
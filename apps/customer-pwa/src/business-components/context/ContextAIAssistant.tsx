'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { BusinessContextData } from '../../business-types/context';
import '../../styles/sonic-theme.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: ContextSuggestion[];
}

interface ContextSuggestion {
  type: 'add' | 'remove' | 'modify';
  field: string;
  value: any;
  reason: string;
}

interface ContextAIAssistantProps {
  contextData: BusinessContextData | null;
  onApplySuggestion: (suggestion: ContextSuggestion) => void;
  onChange: (contextData: BusinessContextData) => void;
}

export function ContextAIAssistant({ 
  contextData, 
  onApplySuggestion,
  onChange 
}: ContextAIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hej! Jag är din AI-assistent för företagskontext. Jag kan hjälpa dig att förbättra din kontextdata med förslag på vad du kan lägga till, ändra eller ta bort. Vad behöver du hjälp med?',
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const analyzeContext = () => {
    if (!contextData) return [];
    
    const suggestions: ContextSuggestion[] = [];
    
    // Check layout completeness
    if (contextData.layout.departments.length === 0) {
      suggestions.push({
        type: 'add',
        field: 'layout.departments',
        value: ['Frukt & Grönt', 'Mejeri', 'Kött & Fisk', 'Bröd', 'Torrvaror'],
        reason: 'Lägg till avdelningar för att hjälpa AI:n förstå din butiksstruktur'
      });
    }
    
    // Check staff information
    if (contextData.staff.employees.length === 0) {
      suggestions.push({
        type: 'add',
        field: 'staff.employees',
        value: [{ name: 'Anna', role: 'Butikschef', department: 'Ledning' }],
        reason: 'Lägg till personalinformation för bättre kundserviceanalys'
      });
    }
    
    // Check products
    if (contextData.products.categories.length === 0) {
      suggestions.push({
        type: 'add',
        field: 'products.categories',
        value: ['Livsmedel', 'Färskvaror', 'Frysvaror', 'Hushållsprodukter'],
        reason: 'Definiera produktkategorier för mer relevant feedback'
      });
    }
    
    // Check opening hours
    const hasNoHours = Object.values(contextData.operations.hours).every(
      h => !h.open && !h.close
    );
    if (hasNoHours) {
      suggestions.push({
        type: 'add',
        field: 'operations.hours',
        value: {
          monday: { open: '08:00', close: '20:00', closed: false },
          tuesday: { open: '08:00', close: '20:00', closed: false },
          wednesday: { open: '08:00', close: '20:00', closed: false },
          thursday: { open: '08:00', close: '20:00', closed: false },
          friday: { open: '08:00', close: '21:00', closed: false },
          saturday: { open: '09:00', close: '18:00', closed: false },
          sunday: { open: '10:00', close: '18:00', closed: false }
        },
        reason: 'Lägg till öppettider för bättre förståelse av kundbeteende'
      });
    }
    
    // Check customer patterns
    if (contextData.customerPatterns.commonQuestions.length === 0) {
      suggestions.push({
        type: 'add',
        field: 'customerPatterns.commonQuestions',
        value: ['Var hittar jag...?', 'Har ni...?', 'När kommer...?'],
        reason: 'Lägg till vanliga kundfrågor för bättre AI-träning'
      });
    }
    
    return suggestions;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);
    
    try {
      // Get access token from localStorage
      const accessToken = localStorage.getItem('ai-feedback-access-token');
      const businessId = localStorage.getItem('ai-feedback-business-id');
      
      // Call the AI API
      const response = await fetch('/api/business/context-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          message: inputValue,
          contextData: contextData,
          businessId: businessId
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }
      
      const data = await response.json();
      
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        suggestions: data.suggestions
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Fallback to local analysis
      const suggestions = analyzeContext();
      let responseContent = 'Jag kan hjälpa dig med:\n' +
        '• Förslag på vad som saknas i din kontext\n' +
        '• Tips för specifika avsnitt\n' +
        '• Best practices för kontextdata\n' +
        '• Automatiska förbättringsförslag\n\n' +
        'Vad vill du veta mer om?';
      
      if (suggestions.length > 0) {
        responseContent = `Baserat på din nuvarande kontext har jag ${suggestions.length} förslag:\n\n`;
        suggestions.forEach((s, i) => {
          responseContent += `${i + 1}. ${s.reason}\n`;
        });
        responseContent += '\nKlicka på "Tillämpa" för att implementera förslagen.';
      }
      
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        suggestions: suggestions.length > 0 ? suggestions : undefined
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const applySuggestion = (suggestion: ContextSuggestion) => {
    if (!contextData) return;
    
    const newContext = { ...contextData };
    const fieldParts = suggestion.field.split('.');
    
    // Navigate to the field and apply the suggestion
    let target: any = newContext;
    for (let i = 0; i < fieldParts.length - 1; i++) {
      target = target[fieldParts[i]];
    }
    
    const lastField = fieldParts[fieldParts.length - 1];
    
    if (suggestion.type === 'add') {
      if (Array.isArray(target[lastField])) {
        target[lastField] = [...target[lastField], ...suggestion.value];
      } else {
        target[lastField] = suggestion.value;
      }
    } else if (suggestion.type === 'remove') {
      if (Array.isArray(target[lastField])) {
        target[lastField] = target[lastField].filter((item: any) => item !== suggestion.value);
      } else {
        target[lastField] = null;
      }
    } else if (suggestion.type === 'modify') {
      target[lastField] = suggestion.value;
    }
    
    onChange(newContext);
    
    // Add confirmation message
    const confirmMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `✅ Förslaget har tillämpats! ${suggestion.reason}`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, confirmMessage]);
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 p-4 rounded-full transition-all duration-300 hover:scale-110 sonic-breathing"
          style={{
            background: 'var(--gradient-waveform)',
            boxShadow: 'var(--shadow-wave)',
            zIndex: 9999
          }}
        >
          <div className="relative">
            <MessageCircle className="w-6 h-6 text-white" />
            <Sparkles className="w-3 h-3 absolute -top-1 -right-1 text-yellow-300 sonic-modulating" />
          </div>
        </button>
      )}
      
      {/* Chat window */}
      {isOpen && (
        <div className={`fixed bottom-6 right-6 w-96 sonic-card transition-all duration-300 ${
          isMinimized ? 'h-14' : 'h-[600px]'
        }`} style={{
          boxShadow: 'var(--shadow-2xl)',
          zIndex: 9999
        }}>
          {/* Header */}
          <div className="p-4 rounded-t-lg flex items-center justify-between" style={{
            background: 'var(--gradient-waveform)'
          }}>
            <div className="flex items-center space-x-2">
              <Bot className="w-5 h-5 text-white sonic-oscillating" />
              <span className="font-semibold text-white">AI Kontextassistent</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="hover:bg-white/20 p-1 rounded transition-colors"
              >
                {isMinimized ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/20 p-1 rounded transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
          
          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[450px]">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] p-3 sonic-modulating`} style={{
                      borderRadius: 'var(--radius-xl)',
                      background: message.role === 'user' 
                        ? 'var(--gradient-mid-freq)' 
                        : 'var(--elevation-2)',
                      color: message.role === 'user' ? 'white' : 'var(--color-ocean-primary)'
                    }}>
                      <p className="text-sm whitespace-pre-line">{message.content}</p>
                      
                      {/* Suggestions */}
                      {message.suggestions && message.suggestions.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {message.suggestions.map((suggestion, index) => (
                            <div key={index} className="bg-white/10 backdrop-blur p-2 rounded">
                              <p className="text-xs mb-1">{suggestion.reason}</p>
                              <button
                                onClick={() => applySuggestion(suggestion)}
                                className="text-xs bg-white text-blue-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                              >
                                Tillämpa
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString('sv-SE', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="p-3" style={{
                      background: 'var(--elevation-2)',
                      borderRadius: 'var(--radius-xl)'
                    }}>
                      <div className="waveform-visualizer" style={{ height: '20px' }}>
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="waveform-bar" style={{ 
                            animationDelay: `${i * 0.1}s`,
                            height: '100%'
                          }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
              
              {/* Input */}
              <div className="border-t p-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ställ en fråga om din kontext..."
                    className="sonic-input flex-1"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isTyping}
                    className="sonic-btn-primary p-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ padding: 'var(--space-3)' }}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    onClick={() => setInputValue('Ge mig förslag')}
                    className="sonic-btn-secondary text-xs"
                    style={{ padding: 'var(--space-2) var(--space-3)' }}
                  >
                    Ge förslag
                  </button>
                  <button
                    onClick={() => setInputValue('Vad saknas?')}
                    className="sonic-btn-secondary text-xs"
                    style={{ padding: 'var(--space-2) var(--space-3)' }}
                  >
                    Vad saknas?
                  </button>
                  <button
                    onClick={() => setInputValue('Hjälp med personal')}
                    className="sonic-btn-secondary text-xs"
                    style={{ padding: 'var(--space-2) var(--space-3)' }}
                  >
                    Personal
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
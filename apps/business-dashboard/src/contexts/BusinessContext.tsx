'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface BusinessContextType {
  businessId: string | null;
  setBusinessId: (id: string) => void;
  isLoading: boolean;
}

const BusinessContext = createContext<BusinessContextType>({
  businessId: null,
  setBusinessId: () => {},
  isLoading: true,
});

export function useBusinessContext() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusinessContext must be used within a BusinessProvider');
  }
  return context;
}

interface BusinessProviderProps {
  children: ReactNode;
}

export function BusinessProvider({ children }: BusinessProviderProps) {
  const [businessId, setBusinessIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Try to get business ID from URL params first
    const urlParams = new URLSearchParams(window.location.search);
    const urlBusinessId = urlParams.get('businessId');
    
    if (urlBusinessId) {
      setBusinessIdState(urlBusinessId);
      localStorage.setItem('businessId', urlBusinessId);
    } else {
      // Fall back to localStorage
      const storedBusinessId = localStorage.getItem('businessId');
      if (storedBusinessId) {
        setBusinessIdState(storedBusinessId);
      } else {
        // TODO: In production, redirect to login/business selection
        console.warn('No business ID found. User should select/login to a business.');
      }
    }
    
    setIsLoading(false);
  }, []);

  const setBusinessId = (id: string) => {
    setBusinessIdState(id);
    localStorage.setItem('businessId', id);
  };

  return (
    <BusinessContext.Provider value={{ businessId, setBusinessId, isLoading }}>
      {children}
    </BusinessContext.Provider>
  );
}
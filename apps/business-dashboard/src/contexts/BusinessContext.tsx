'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface BusinessContextType {
  businessId: string | null;
  businessName: string | null;
  setBusinessId: (id: string) => void;
  isLoading: boolean;
}

const const BusinessContext = createContext<BusinessContextType>({
  businessId: null,
  businessName: null,
  setBusinessId: () => {},
  isLoading: true,
});;

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
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBusinessData = async (id: string) => {
    try {
      const response = await fetch(`/api/businesses/${id}`);
      if (response.ok) {
        const data = await response.json();
        setBusinessName(data.name);
      }
    } catch (error) {
      console.error('Failed to fetch business data:', error);
      // Fallback to a default name for now
      setBusinessName('Ultrathink');
    }
  };

  useEffect(() => {
    // Try to get business ID from URL params first
    const urlParams = new URLSearchParams(window.location.search);
    const urlBusinessId = urlParams.get('businessId');
    
    if (urlBusinessId) {
      setBusinessIdState(urlBusinessId);
      localStorage.setItem('businessId', urlBusinessId);
      fetchBusinessData(urlBusinessId);
    } else {
      // Fall back to localStorage
      const storedBusinessId = localStorage.getItem('businessId');
      if (storedBusinessId) {
        setBusinessIdState(storedBusinessId);
        fetchBusinessData(storedBusinessId);
      } else {
        // TODO: In production, redirect to login/business selection
        console.warn('No business ID found. User should select/login to a business.');
        // Set default for now
        setBusinessName('Ultrathink');
      }
    }
    
    setIsLoading(false);
  }, []);

  const setBusinessId = (id: string) => {
    setBusinessIdState(id);
    localStorage.setItem('businessId', id);
    fetchBusinessData(id);
  };

  return (
    <BusinessContext.Provider value={{ businessId, businessName, setBusinessId, isLoading }}>
      {children}
    </BusinessContext.Provider>
  );
}>
      {children}
    </BusinessContext.Provider>
  );
}
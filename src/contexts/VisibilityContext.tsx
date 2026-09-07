import React, { createContext, useContext, useState, useEffect } from 'react';

interface VisibilityContextType {
  isVisible: boolean;
  toggleVisibility: () => void;
}

const VisibilityContext = createContext<VisibilityContextType | undefined>(undefined);

export function VisibilityProvider({ children }: { children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(() => {
    const saved = localStorage.getItem('mkt_values_visibility') || localStorage.getItem('omega_values_visibility');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const toggleVisibility = () => {
    setIsVisible((prev: boolean) => !prev);
  };

  useEffect(() => {
    localStorage.setItem('mkt_values_visibility', JSON.stringify(isVisible));
  }, [isVisible]);

  return (
    <VisibilityContext.Provider value={{ isVisible, toggleVisibility }}>
      {children}
    </VisibilityContext.Provider>
  );
}

export function useVisibility() {
  const context = useContext(VisibilityContext);
  if (context === undefined) {
    throw new Error('useVisibility must be used within a VisibilityProvider');
  }
  return context;
}

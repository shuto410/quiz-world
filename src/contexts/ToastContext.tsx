/**
 * Toast Context for Quiz World application
 * - Global toast notification management
 * - Provides useToast hook for easy integration
 * - Supports multiple concurrent toasts with auto-cleanup
 * - Non-blocking user feedback system
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastItem, ToastPosition, ToastContainer } from '../components/ui/Toast';

/**
 * Toast context value interface
 */
interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
  showSuccess: (message: string, title?: string) => string;
  showError: (message: string, title?: string) => string;
  showWarning: (message: string, title?: string) => string;
  showInfo: (message: string, title?: string) => string;
}

/**
 * Toast provider props interface
 */
interface ToastProviderProps {
  children: ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
}

/**
 * Toast context
 */
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/**
 * Generate unique ID for toasts
 */
function generateToastId(): string {
  return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Toast provider component
 */
export function ToastProvider({ 
  children, 
  position = 'top-right', 
  maxToasts = 5 
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>): string => {
    const id = generateToastId();
    const newToast: ToastItem = {
      ...toast,
      id,
    };

    setToasts(prevToasts => {
      const updatedToasts = [newToast, ...prevToasts];
      // Limit the number of concurrent toasts
      return updatedToasts.slice(0, maxToasts);
    });

    return id;
  }, [maxToasts]);

  const removeToast = useCallback((id: string) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showSuccess = useCallback((message: string, title?: string): string => {
    return addToast({
      type: 'success',
      message,
      title,
      duration: 4000,
    });
  }, [addToast]);

  const showError = useCallback((message: string, title?: string): string => {
    return addToast({
      type: 'error',
      message,
      title,
      duration: 6000, // Error messages stay longer
    });
  }, [addToast]);

  const showWarning = useCallback((message: string, title?: string): string => {
    return addToast({
      type: 'warning',
      message,
      title,
      duration: 5000,
    });
  }, [addToast]);

  const showInfo = useCallback((message: string, title?: string): string => {
    return addToast({
      type: 'info',
      message,
      title,
      duration: 4000,
    });
  }, [addToast]);

  const contextValue: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer 
        toasts={toasts} 
        onRemove={removeToast} 
        position={position} 
      />
    </ToastContext.Provider>
  );
}

/**
 * Hook to use toast notifications
 * @returns Toast context value
 * @throws Error if used outside ToastProvider
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  
  return context;
} 
/**
 * Toast notification component for Quiz World application
 * - Supports different notification types (success, error, warning, info)
 * - Auto-dismiss functionality with configurable duration
 * - Follows anime pop style design with animations
 * - Non-blocking user-friendly feedback
 */

import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '../../lib/utils';

/**
 * Toast notification types
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast position options
 */
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

/**
 * Individual toast item interface
 */
export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  persistent?: boolean;
}

/**
 * Toast props interface
 */
export interface ToastProps {
  toast: ToastItem;
  onRemove: (id: string) => void;
  position?: ToastPosition;
}

/**
 * Toast container props interface
 */
export interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
  position?: ToastPosition;
}

/**
 * Individual toast notification component
 */
export function Toast({ toast, onRemove }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = useCallback(() => {
    setIsRemoving(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 200);
  }, [onRemove, toast.id]);

  useEffect(() => {
    // Trigger enter animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast.persistent && toast.duration !== 0) {
      const duration = toast.duration || 4000;
      const timer = setTimeout(() => {
        handleRemove();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, toast.persistent, handleRemove]);

  const baseClasses = [
    'flex items-start gap-3 p-4 rounded-lg border shadow-lg',
    'backdrop-blur-sm transition-all duration-200 ease-out',
    'transform max-w-sm cursor-pointer',
    'hover:scale-105 active:scale-95',
  ];

  const typeClasses = {
    success: [
      'bg-gradient-to-r from-green-50 to-emerald-50',
      'border-green-200 text-green-800',
      'shadow-green-100',
    ],
    error: [
      'bg-gradient-to-r from-red-50 to-pink-50',
      'border-red-200 text-red-800',
      'shadow-red-100',
    ],
    warning: [
      'bg-gradient-to-r from-yellow-50 to-orange-50',
      'border-yellow-200 text-yellow-800',
      'shadow-yellow-100',
    ],
    info: [
      'bg-gradient-to-r from-blue-50 to-cyan-50',
      'border-blue-200 text-blue-800',
      'shadow-blue-100',
    ],
  };

  const animationClasses = isRemoving
    ? 'opacity-0 scale-95 translate-x-full'
    : isVisible
    ? 'opacity-100 scale-100 translate-x-0'
    : 'opacity-0 scale-95 translate-x-full';

  const iconMap = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const classes = cn(
    baseClasses,
    typeClasses[toast.type],
    animationClasses
  );

  return (
    <div className={classes} onClick={handleRemove} data-testid={`toast-${toast.id}`}>
      <div className="flex-shrink-0 text-xl">
        {iconMap[toast.type]}
      </div>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <h4 className="text-sm font-semibold mb-1">
            {toast.title}
          </h4>
        )}
        <p className="text-sm leading-relaxed">
          {toast.message}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleRemove();
        }}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}

/**
 * Toast container component for managing multiple toasts
 */
export function ToastContainer({ toasts, onRemove, position = 'top-right' }: ToastContainerProps) {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2',
  };

  if (toasts.length === 0) return null;

  return (
    <div
      className={cn(
        'fixed z-50 flex flex-col gap-2',
        positionClasses[position]
      )}
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onRemove={onRemove}
          position={position}
        />
      ))}
    </div>
  );
} 
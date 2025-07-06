/**
 * Animated button component for Quiz World application
 * - Supports different variants and sizes
 * - Includes hover and click animations
 * - Follows anime pop style design
 */
import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Button variant types
 */
export type ButtonVariant = 
  | 'primary' 
  | 'secondary' 
  | 'success' 
  | 'danger' 
  | 'ghost';

/**
 * Button size types
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Button props interface
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

/**
 * Button component with anime pop style animations
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = [
    'inline-flex items-center justify-center',
    'font-semibold rounded-lg',
    'transition-all duration-200 ease-out',
    'transform hover:scale-105 active:scale-95',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'disabled:transform-none',
  ];

  const variantClasses = {
    primary: [
      'bg-gradient-to-r from-pink-500 to-purple-600',
      'text-white shadow-lg',
      'hover:from-pink-600 hover:to-purple-700',
      'focus:ring-pink-500',
      'border border-pink-400',
    ],
    secondary: [
      'bg-gradient-to-r from-blue-500 to-cyan-500',
      'text-white shadow-lg',
      'hover:from-blue-600 hover:to-cyan-600',
      'focus:ring-blue-500',
      'border border-blue-400',
    ],
    success: [
      'bg-gradient-to-r from-green-500 to-emerald-500',
      'text-white shadow-lg',
      'hover:from-green-600 hover:to-emerald-600',
      'focus:ring-green-500',
      'border border-green-400',
    ],
    danger: [
      'bg-gradient-to-r from-red-500 to-pink-500',
      'text-white shadow-lg',
      'hover:from-red-600 hover:to-pink-600',
      'focus:ring-red-500',
      'border border-red-400',
    ],
    ghost: [
      'bg-transparent text-gray-700',
      'hover:bg-gray-100',
      'focus:ring-gray-500',
      'border border-gray-300',
    ],
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const classes = cn(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className
  );

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
} 
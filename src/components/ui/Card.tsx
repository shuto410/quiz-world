/**
 * Animated card component for Quiz World application
 * - Supports different variants and hover effects
 * - Includes anime pop style animations
 * - Responsive design with gradient backgrounds
 */

import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Card variant types
 */
export type CardVariant = 'default' | 'elevated' | 'gradient' | 'glass';

/**
 * Card props interface
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  children: React.ReactNode;
}

/**
 * Card header props interface
 */
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Card content props interface
 */
export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Card footer props interface
 */
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Main card component with anime pop style
 */
export function Card({ variant = 'default', className, children, ...props }: CardProps) {
  const baseClasses = [
    'rounded-xl border',
    'transition-all duration-300 ease-out',
    'transform hover:scale-105',
    'backdrop-blur-sm',
  ];

  const variantClasses = {
    default: [
      'bg-white border-gray-200',
      'shadow-md hover:shadow-lg',
      'hover:border-gray-300',
    ],
    elevated: [
      'bg-white border-gray-200',
      'shadow-lg hover:shadow-xl',
      'hover:border-gray-300',
      'hover:-translate-y-1',
    ],
    gradient: [
      'bg-gradient-to-br from-pink-50 to-purple-50',
      'border-pink-200 shadow-lg',
      'hover:shadow-xl hover:border-pink-300',
      'hover:from-pink-100 hover:to-purple-100',
    ],
    glass: [
      'bg-white/80 border-white/20',
      'shadow-lg backdrop-blur-md',
      'hover:bg-white/90 hover:shadow-xl',
    ],
  };

  const classes = cn(baseClasses, variantClasses[variant], className);

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

/**
 * Card header component
 */
export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn('px-6 py-4 border-b border-gray-100', className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Card content component
 */
export function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div className={cn('px-6 py-4', className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Card footer component
 */
export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div className={cn('px-6 py-4 border-t border-gray-100', className)} {...props}>
      {children}
    </div>
  );
} 
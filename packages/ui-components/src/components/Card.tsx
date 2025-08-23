import React, { forwardRef } from 'react';
import { cn } from '../utils/cn';
import { CardProps } from '../types';

const cardVariants = {
  default: 'bg-white border border-gray-200',
  elevated: 'bg-white shadow-lg border border-gray-100',
  outline: 'bg-transparent border-2 border-gray-200'
};

const cardPadding = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6'
};

export const Card = forwardRef<HTMLDivElement, CardProps>(({
  className,
  variant = 'default',
  padding = 'md',
  children,
  ...props
}, ref) => {
  return (
    <div
      className={cn(
        'rounded-lg transition-all duration-200',
        cardVariants[variant],
        cardPadding[padding],
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';
import React, { ReactNode, MouseEvent } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const shadowClasses = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
};

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  shadow = 'md',
  hover = false,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-[#091D41] rounded-xl
        ${paddingClasses[padding]}
        ${shadowClasses[shadow]}
        ${hover ? 'transition-smooth hover:shadow-xl hover:scale-[1.01]' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default Card;


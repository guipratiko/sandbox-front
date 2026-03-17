import React, { ButtonHTMLAttributes } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const { t } = useLanguage();
  const baseClasses = 'font-semibold rounded-lg transition-smooth focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center';
  
  const variantClasses = {
    primary: 'bg-clerky-backendButton text-white hover:opacity-90 shadow-md hover:shadow-lg',
    secondary: 'bg-gray-200 dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600',
    outline: 'border-2 border-clerky-backendButton text-clerky-backendButton dark:text-clerky-backendButton hover:bg-clerky-backendButton hover:text-white dark:hover:text-white',
    ghost: 'text-clerky-backendButton dark:text-gray-200 hover:bg-clerky-backendButton/10 dark:hover:bg-gray-700',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-md hover:shadow-lg',
  };
  
  const sizeClasses = {
    xs: 'px-2 py-1 text-xs rounded-md',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {t('common.loading')}
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;


import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: 'py-2 px-3.5 text-xs',
    md: 'py-3 px-6 text-xs sm:text-sm',
    lg: 'py-4 px-8 text-sm sm:text-base'
  };

  const variantClasses = {
    primary:
      'bg-[#3B2F2A] hover:bg-[#4D3E37] active:bg-[#2E2420] text-[#FAF7F2] border border-[#3B2F2A] shadow-md hover:shadow-lg',
    outline:
      'bg-transparent hover:bg-[#3B2F2A] text-[#3B2F2A] hover:text-[#FAF7F2] border-2 border-[#3B2F2A] active:bg-[#2E2420]',
    ghost:
      'bg-transparent hover:bg-[#3B2F2A]/10 text-[#3B2F2A] border border-transparent'
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center font-bold uppercase tracking-wider rounded-xl
        transition-all duration-250 cursor-pointer active:scale-98 select-none
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Processing...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};

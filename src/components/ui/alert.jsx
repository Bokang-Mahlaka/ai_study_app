// components/ui/alert.jsx
import React from 'react';
import { cn } from "@/lib/utils"

export function Alert({ variant = 'default', className = '', children }) {
    const baseStyles = 'p-4 rounded-lg';
    const variantStyles = {
        default: 'bg-gray-50 text-gray-800',
        destructive: 'bg-red-50 text-red-800',
        success: 'bg-green-50 text-green-800',
        warning: 'bg-yellow-50 text-yellow-800'
    };

    return (
        <div className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
            {children}
        </div>
    );
}

export function AlertDescription({ className = '', children }) {
    return (
        <div className={`text-sm ${className}`}>
            {children}
        </div>
    );
}
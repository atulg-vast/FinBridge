import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRoleRedirect(role: string): string {
  switch (role) {
    case 'platform_admin': return '/admin'
    case 'firm_admin': return '/firm'
    case 'accountant': return '/accountant'
    case 'company_admin':
    case 'company_user': return '/company'
    default: return '/login'
  }
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
}

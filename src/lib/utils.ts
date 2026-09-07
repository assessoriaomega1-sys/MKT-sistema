import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (value: number | undefined | null) => {
  const val = typeof value === 'number' ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val);
};

export const formatPercent = (value: number | undefined | null) => {
  const val = typeof value === 'number' ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(val / 100);
};

export const formatNumber = (value: number | undefined | null) => {
  const val = typeof value === 'number' ? value : 0;
  return new Intl.NumberFormat('pt-BR').format(val);
};

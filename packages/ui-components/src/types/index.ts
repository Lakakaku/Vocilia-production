import { ReactNode, HTMLAttributes, ButtonHTMLAttributes, InputHTMLAttributes } from 'react';

// Base component props
export interface BaseProps {
  className?: string;
  children?: ReactNode;
}

// Button component props
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

// Input component props
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  variant?: 'default' | 'filled' | 'outline';
}

// Card component props
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outline';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

// Modal component props
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: ReactNode;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

// Toast component props
export interface ToastProps {
  id: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Alert component props
export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

// Quality Score Display props (AI Feedback specific)
export interface QualityScoreProps {
  score: {
    authenticity: number;
    concreteness: number;
    depth: number;
    total: number;
  };
  showBreakdown?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// Reward Display props (AI Feedback specific)
export interface RewardDisplayProps {
  amount: number;
  percentage: number;
  currency?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  tier?: 'basic' | 'good' | 'excellent' | 'premium';
}

// Audio Visualizer props (Voice feedback specific)
export interface AudioVisualizerProps {
  audioData?: number[];
  isRecording?: boolean;
  size?: 'sm' | 'md' | 'lg';
  barCount?: number;
  className?: string;
}

// Voice Waveform props
export interface VoiceWaveformProps {
  audioBuffer?: ArrayBuffer;
  isPlaying?: boolean;
  onSeek?: (position: number) => void;
  className?: string;
}

// Form Field props
export interface FormFieldProps {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}
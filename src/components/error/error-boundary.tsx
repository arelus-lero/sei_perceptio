'use client';

import React, { type ErrorInfo, type ReactNode } from 'react';

import { ErrorRecoveryCard } from '@/components/error/error-recovery-card';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  compact?: boolean;
  title?: string;
  message?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    // TODO: integrar observabilidade (Sentry/Datadog)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorRecoveryCard
          compact={this.props.compact ?? true}
          title={this.props.title ?? 'Erro nesta seção'}
          message={
            this.props.message ?? 'Não foi possível exibir este conteúdo. Tente novamente.'
          }
          onRetry={this.handleReset}
          showHomeLink={false}
        />
      );
    }

    return this.props.children;
  }
}

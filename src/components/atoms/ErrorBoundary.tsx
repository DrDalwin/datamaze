"use client";
import React from 'react';

export class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-900 text-white overflow-auto w-full h-full relative z-[9999]">
          <h2 className="text-xl font-bold">App Crashed</h2>
          <pre className="text-xs mt-2 whitespace-pre-wrap">{this.state.error?.toString()}</pre>
          <pre className="text-xs mt-2 whitespace-pre-wrap">{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

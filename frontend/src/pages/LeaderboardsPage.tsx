import { Component, ErrorInfo, ReactNode } from 'react';
import { TopTen } from '../components/TopTen';
import { MarketDiscovery } from '../components/MarketDiscovery';
import { CategoryFilter } from '../components/CategoryFilter';

// Error boundary to prevent components from crashing the page
class ErrorBoundary extends Component<{ children: ReactNode; name: string }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; name: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`${this.props.name} error:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="text-center text-gray-400">
            Failed to load {this.props.name}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function LeaderboardsPage() {
  return (
    <div className="space-y-8">
      {/* Top 10 Boards */}
      <ErrorBoundary name="Top 10 Boards">
        <TopTen />
      </ErrorBoundary>

      {/* Market Discovery */}
      <ErrorBoundary name="Market Discovery">
        <MarketDiscovery />
      </ErrorBoundary>

      {/* Category Filter */}
      <ErrorBoundary name="Category Filter">
        <CategoryFilter />
      </ErrorBoundary>
    </div>
  );
}

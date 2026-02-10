import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { captureException } from '../src/config/sentry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary component to catch and handle React errors gracefully.
 * Prevents the entire app from crashing when an error occurs in a component tree.
 *
 * In production, this displays a user-friendly error message with a recovery action.
 * In development, it shows detailed error information for debugging.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for monitoring (dev only)
    if (__DEV__) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    this.setState({
      error,
      errorInfo,
    });

    // Send error to Sentry for tracking
    captureException(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      const isDevelopment = __DEV__;

      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Error icon */}
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{'⚠️'}</Text>
            </View>

            {/* Error message */}
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              We're sorry, but something unexpected happened. Please try again.
            </Text>

            {/* Recovery button */}
            <TouchableOpacity
              style={styles.button}
              onPress={this.handleReset}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>

            {/* Development mode: Show error details */}
            {isDevelopment && this.state.error && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorDetailsTitle}>Error Details (DEV only):</Text>
                <Text style={styles.errorText}>{this.state.error.toString()}</Text>
                {this.state.errorInfo && (
                  <Text style={styles.stackTrace}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B4332',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    maxWidth: 320,
  },
  button: {
    backgroundColor: '#1B4332',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    shadowColor: '#1B4332',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  errorDetails: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    width: '100%',
  },
  errorDetailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991B1B',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  stackTrace: {
    fontSize: 11,
    color: '#B91C1C',
    fontFamily: 'monospace',
  },
});

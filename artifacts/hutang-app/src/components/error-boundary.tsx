import { Component, type ErrorInfo, type ReactNode } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// 1. Class-based ErrorBoundary — catches render/lifecycle crashes
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Tampilkan tombol Kembali ke Dashboard */
  showHomeButton?: boolean;
  /** Fallback kustom (override default UI) */
  fallback?: (props: { error: Error; resetErrorBoundary: () => void }) => ReactNode;
  /** Callback saat error tertangkap */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          resetErrorBoundary: this.resetErrorBoundary,
        });
      }

      return (
        <ErrorFallbackUI
          error={this.state.error}
          resetErrorBoundary={this.resetErrorBoundary}
          showHomeButton={this.props.showHomeButton}
        />
      );
    }

    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// 2. QueryErrorBoundary — wraps ErrorBoundary with react-query reset
//    Agar saat user tekan "Coba Lagi", query cache juga di-reset.
// ---------------------------------------------------------------------------

export function QueryErrorBoundary({
  children,
  showHomeButton,
}: {
  children: ReactNode;
  showHomeButton?: boolean;
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          showHomeButton={showHomeButton}
          onError={() => reset()}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

// ---------------------------------------------------------------------------
// 3. Reusable fallback UI — juga bisa dipakai langsung oleh halaman
//    untuk menampilkan state error query (isError).
// ---------------------------------------------------------------------------

export function ErrorFallbackUI({
  error,
  resetErrorBoundary,
  showHomeButton = false,
  title = "Terjadi Kesalahan",
  description,
}: {
  error?: Error | null;
  resetErrorBoundary?: () => void;
  showHomeButton?: boolean;
  title?: string;
  description?: string;
}) {
  const errorMessage =
    description ??
    error?.message ??
    "Terjadi kesalahan yang tidak terduga. Silakan coba lagi.";

  return (
    <div className="flex min-h-[40vh] w-full items-center justify-center p-4">
      <Card className="w-full max-w-md border-red-200/80 bg-gradient-to-b from-red-50/50 to-white shadow-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            {/* Icon */}
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-red-100">
              <AlertTriangle className="h-7 w-7 text-red-600" />
            </div>

            {/* Title */}
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>

            {/* Message */}
            <p className="text-sm leading-relaxed text-gray-600">
              {errorMessage}
            </p>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {resetErrorBoundary && (
                <Button onClick={resetErrorBoundary} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Coba Lagi
                </Button>
              )}
              {showHomeButton && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    window.location.href =
                      (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") +
                      "/dashboard";
                  }}
                >
                  <Home className="h-4 w-4" />
                  Ke Dashboard
                </Button>
              )}
            </div>

            {/* Detail teknis (collapsible) */}
            {error && import.meta.env.DEV && (
              <details className="mt-3 w-full rounded-lg bg-gray-100 p-3 text-left">
                <summary className="cursor-pointer text-xs font-medium text-gray-500">
                  Detail teknis
                </summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-gray-600">
                  {error.stack ?? error.message}
                </pre>
              </details>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. QueryErrorState — komponen ringan untuk state error per-query
//    Dipakai di halaman yang perlu menampilkan error inline + tombol retry.
// ---------------------------------------------------------------------------

export function QueryErrorState({
  error,
  onRetry,
  title = "Gagal Memuat Data",
  description,
}: {
  error?: Error | unknown;
  onRetry?: () => void;
  title?: string;
  description?: string;
}) {
  const message =
    description ??
    (error instanceof Error ? error.message : null) ??
    "Data tidak dapat dimuat. Periksa koneksi atau coba beberapa saat lagi.";

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-red-100">
        <AlertTriangle className="h-6 w-6 text-red-500" />
      </div>
      <h3 className="text-base font-semibold text-gray-800">{title}</h3>
      <p className="max-w-sm text-sm text-gray-500">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1 gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Coba Lagi
        </Button>
      )}
    </div>
  );
}

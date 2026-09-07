import React from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 glass rounded-3xl border border-accent-coral/20 text-center">
          <div className="w-16 h-16 rounded-full bg-accent-coral/10 flex items-center justify-center text-accent-coral mb-6">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold mb-2">Ops! Algo deu errado</h2>
          <p className="text-text-secondary text-sm mb-8 max-w-md">
            Ocorreu um erro ao carregar esta parte do dashboard. Tente atualizar a página ou use o botão abaixo.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
          >
            <RefreshCcw size={16} />
            Atualizar Dashboard
          </button>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-8 p-4 bg-black/40 rounded-lg text-left text-[10px] text-accent-coral overflow-auto max-w-full">
              {this.state.error?.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

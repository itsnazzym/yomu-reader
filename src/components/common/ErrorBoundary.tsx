import { Component, ErrorInfo, ReactNode } from "react";
import { Icon } from "./Icon";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[🛡️ ERROR BOUNDARY] Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-[#0d0d14] text-white p-6 select-none font-sans">
          <div className="max-w-md w-full bg-[#181822] border border-[#2b2b3a] rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-950/80 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Icon name="warning" size={26} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-100">Une erreur inattendue est survenue</h2>
              <p className="text-xs text-gray-400 mt-1">
                L'application a intercepté une anomalie sans planter l'environnement.
              </p>
            </div>
            {this.state.error && (
              <div className="p-3 rounded-lg bg-black/50 border border-white/5 font-mono text-[11px] text-rose-300 text-left overflow-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-xl bg-[#262636] hover:bg-[#343448] text-xs font-bold text-gray-200 transition-colors cursor-pointer"
              >
                Continuer
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-xl bg-[#ed2553] hover:bg-[#f43f5e] text-xs font-bold text-white transition-colors cursor-pointer shadow-lg shadow-rose-950/40"
              >
                Recharger l'application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

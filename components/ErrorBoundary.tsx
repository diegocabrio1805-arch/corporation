import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-6 text-center">
                    <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full">
                        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                            <i className="fa-solid fa-bug"></i>
                        </div>
                        <h1 className="text-xl font-black text-slate-800 mb-2 uppercase">Algo salió mal</h1>
                        <p className="text-slate-500 text-xs mb-6">
                            Se ha producido un error inesperado en la interfaz.
                        </p>
                        <details className="text-left text-[10px] bg-slate-50 p-2 rounded border mb-4 text-slate-400 overflow-auto max-h-32">
                            <summary>Ver detalle técnico</summary>
                            {this.state.error?.toString()}
                        </details>
                        <button
                            onClick={() => {
                                (this as any).setState({ hasError: false });
                                window.location.reload();
                            }}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-colors"
                        >
                            Reiniciar Aplicación
                        </button>
                    </div>
                </div>
            );
        }

        return (this as any).props.children;
    }
}

export default ErrorBoundary;

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled application error", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <main className="app-shell" role="main">
        <section
          className="home-card fatal-error-card"
          role="alert"
          aria-live="assertive"
        >
          <p className="eyebrow">RECOVERY</p>
          <h1>画面を表示できませんでした</h1>
          <p>
            保存済みデータは削除されていません。再読み込みして復旧をお試しください。
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={() => window.location.reload()}
          >
            再読み込み
          </button>
          <details>
            <summary>診断情報</summary>
            <code>{this.state.error.message}</code>
          </details>
        </section>
      </main>
    );
  }
}


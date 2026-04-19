import { Component, type ErrorInfo, type ReactNode } from "react"

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
}

/**
 * Catches React render errors and logs full stacks (helps on iOS Safari where
 * window.onerror often shows only "Script error.").
 */
export class RootErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[RootErrorBoundary]", error.stack ?? error.message)
    console.error("[RootErrorBoundary] componentStack", errorInfo.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-lg font-semibold">Something went wrong</p>
          <p className="text-muted-foreground text-sm">
            Check the console for details (use <code className="rounded bg-muted px-1">?debug=1</code> on
            mobile).
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

import React from "react";

type AppErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  private resetApp = async () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem("BLOCKOPOLY_ROOM_SERVICE");
      localStorage.removeItem("BLOCKOPOLY_GAME_SERVICE");

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith("blockopoly-assets-"))
            .map((key) => caches.delete(key))
        );
      }

      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.update()));
      }
    } catch (error) {
      console.warn("[AppErrorBoundary] Reset cleanup failed", error);
    } finally {
      window.location.assign("/");
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f6f0df",
          color: "#1b1b1b",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <section
          style={{
            width: "min(440px, 100%)",
            border: "2px solid #1b1b1b",
            borderRadius: "8px",
            padding: "24px",
            background: "#fffaf0",
            boxShadow: "6px 6px 0 #1b1b1b",
          }}
        >
          <h1 style={{ margin: "0 0 12px", fontSize: "1.5rem" }}>
            Blockopoly needs a refresh
          </h1>
          <p style={{ margin: "0 0 18px", lineHeight: 1.45 }}>
            The game hit a browser-side error. Refreshing clears the stale game
            session and reconnects to the current server.
          </p>
          <button
            type="button"
            onClick={this.resetApp}
            style={{
              width: "100%",
              border: "2px solid #1b1b1b",
              borderRadius: "6px",
              padding: "12px 16px",
              background: "#1b1b1b",
              color: "#ffffff",
              font: "inherit",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Refresh Blockopoly
          </button>
        </section>
      </main>
    );
  }
}

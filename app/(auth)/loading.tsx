export default function AuthLoading() {
  return (
    <main aria-label="Loading secure access" className="auth-shell auth-shell-placeholder" role="status">
      <aside aria-hidden="true" className="auth-aside">
        <div className="auth-aside-rule" />
        <div className="auth-placeholder-top">
          <span className="skeleton auth-placeholder-logo" />
          <span className="skeleton auth-placeholder-small-button" />
        </div>
        <div className="auth-story auth-placeholder-story">
          <span className="skeleton auth-placeholder-kicker" />
          <span className="skeleton auth-placeholder-hero" />
          <span className="skeleton auth-placeholder-hero short" />
          <span className="skeleton auth-placeholder-copy" />
        </div>
        <div className="auth-aside-footer" />
      </aside>
      <section className="auth-main">
        <div className="auth-main-inner">
          <div className="auth-form-heading auth-placeholder-heading">
            <span className="skeleton auth-placeholder-kicker" />
            <span className="skeleton auth-placeholder-title" />
            <span className="skeleton auth-placeholder-copy" />
          </div>
          <div className="auth-placeholder-form">
            <span className="skeleton auth-placeholder-control" />
            <span className="skeleton auth-placeholder-divider" />
            <span className="skeleton auth-placeholder-label" />
            <span className="skeleton auth-placeholder-control" />
            <span className="skeleton auth-placeholder-label" />
            <span className="skeleton auth-placeholder-control" />
            <span className="skeleton auth-placeholder-submit" />
          </div>
        </div>
      </section>
    </main>
  );
}

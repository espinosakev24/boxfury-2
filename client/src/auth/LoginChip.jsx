export function LoginChip({ ready, authenticated, loading, profile, user, onLogin, onLogout }) {
  if (!ready) {
    return (
      <div className="auth-chip auth-chip--loading">
        <span className="auth-chip__eyebrow">◣ Auth</span>
        <span className="auth-chip__status">…</span>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <button type="button" className="auth-chip auth-chip--login" onClick={onLogin}>
        <span className="auth-chip__eyebrow">◣ Account</span>
        <span className="auth-chip__status">LOG IN</span>
      </button>
    );
  }

  const display =
    profile?.username ||
    user?.email?.address ||
    user?.google?.email ||
    user?.wallet?.address?.slice(0, 8) ||
    'Player';
  const coins = profile?.coins ?? 0;

  return (
    <div className="auth-chip auth-chip--profile">
      <div className="auth-chip__main">
        <span className="auth-chip__eyebrow">◣ Logged in</span>
        <span className="auth-chip__name">{display}</span>
        <span className="auth-chip__coins">
          {loading ? '…' : `${coins} ⬢`}
        </span>
      </div>
      <button type="button" className="auth-chip__logout" onClick={onLogout}>
        Log out
      </button>
    </div>
  );
}

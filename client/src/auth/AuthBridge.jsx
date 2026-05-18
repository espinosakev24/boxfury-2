import { useEffect, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { fetchMyProfile } from './api.js';
import { AUTH_EVENTS } from './config.js';
import { LoginChip } from './LoginChip.jsx';

// Bridges Privy state into vanilla JS via window.boxfuryAuth + custom events,
// and renders the login chip. The rest of the app (vanilla menus, game scenes)
// reads from window.boxfuryAuth and subscribes to AUTH_EVENTS.
export function AuthBridge() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const tokenRef = useRef(null);

  useEffect(() => {
    window.boxfuryAuth = {
      isReady: () => ready,
      isAuthenticated: () => authenticated,
      getUser: () => user,
      getProfile: () => profile,
      getAccessToken: async () => {
        if (!authenticated) return null;
        const t = await getAccessToken();
        tokenRef.current = t;
        return t;
      },
      login,
      logout,
    };
  }, [ready, authenticated, user, profile, login, logout, getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    window.dispatchEvent(new CustomEvent(AUTH_EVENTS.READY, { detail: { authenticated } }));
  }, [ready, authenticated]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      setProfile(null);
      window.dispatchEvent(new CustomEvent(AUTH_EVENTS.LOGOUT));
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingProfile(true);
      try {
        const token = await getAccessToken();
        if (!token) return;
        tokenRef.current = token;
        const p = await fetchMyProfile(token);
        if (cancelled) return;
        setProfile(p);
        window.dispatchEvent(new CustomEvent(AUTH_EVENTS.LOGIN, {
          detail: { user, profile: p },
        }));
        window.dispatchEvent(new CustomEvent(AUTH_EVENTS.PROFILE, { detail: { profile: p } }));
      } catch (err) {
        console.error('[auth] failed to load profile', err);
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ready, authenticated, user, getAccessToken]);

  return (
    <LoginChip
      ready={ready}
      authenticated={authenticated}
      loading={loadingProfile}
      profile={profile}
      user={user}
      onLogin={login}
      onLogout={logout}
    />
  );
}

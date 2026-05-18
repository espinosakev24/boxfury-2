import { PrivyProvider } from '@privy-io/react-auth';
import { PRIVY_APP_ID } from './config.js';
import { AuthBridge } from './AuthBridge.jsx';

const PRIVY_CONFIG = {
  appearance: {
    theme: 'dark',
    accentColor: '#4ee08a',
    logo: undefined,
    showWalletLoginFirst: false,
  },
  loginMethods: ['email', 'google', 'wallet'],
  embeddedWallets: {
    createOnLogin: 'users-without-wallets',
  },
};

export function Root() {
  if (!PRIVY_APP_ID) {
    return (
      <div className="auth-chip auth-chip--error" title="Set VITE_PRIVY_APP_ID in .env">
        <span className="auth-chip__eyebrow">◣ Auth</span>
        <span className="auth-chip__status">NOT CONFIGURED</span>
      </div>
    );
  }
  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={PRIVY_CONFIG}>
      <AuthBridge />
    </PrivyProvider>
  );
}

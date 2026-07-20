import { StatusBar } from 'expo-status-bar';
import React from 'react';

import { AppShell } from '@/components/app-shell';
import { ChangePasswordScreen, LoginScreen } from '@/components/auth-screen';
import { ScreenLoader } from '@/components/ui';
import { AppStoreProvider, useAppStore } from '@/store/app-store';

function AppContent() {
  const { ready, isAuthenticated, currentUser, passwordRecovery } = useAppStore();
  if (!ready) return <ScreenLoader />;
  if (!isAuthenticated) return <LoginScreen />;
  if (currentUser.mustChangePassword || passwordRecovery) return <ChangePasswordScreen />;
  return (
    <>
      <StatusBar style="dark" />
      <AppShell />
    </>
  );
}

export default function Index() {
  return (
    <AppStoreProvider>
      <AppContent />
    </AppStoreProvider>
  );
}

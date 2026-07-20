import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type WebPushSubscriptionPayload = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type PushRegistrationResult = {
  ok: boolean;
  provider?: 'expo' | 'web';
  token?: string;
  subscription?: WebPushSubscriptionPayload;
  permission: string;
  projectId?: string;
  deviceName?: string;
  error?: string;
};

function readableError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  return 'Errore sconosciuto durante la registrazione push.';
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function getExpoTokenWithRetry(projectId: string) {
  const delays = [0, 1000, 3000];
  let lastError: unknown;
  for (const delay of delays) {
    if (delay) await wait(delay);
    try {
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      if (token.data) return token.data;
      lastError = new Error('Expo non ha restituito un token push.');
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Token Expo Push non disponibile.');
}

export function getConfiguredWebPushPublicKey() {
  return '';
}

export function cacheWebPushPublicKey(_value: string) {
  return false;
}

export async function prepareWebPushServiceWorker() {
  return undefined;
}

export async function registerForPushNotificationsAsync(requestPermission = false): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') {
    return { ok: false, permission: 'unsupported', error: 'Usa il modulo Web Push della versione browser.' };
  }

  if (Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient') {
    return {
      ok: false,
      permission: 'unsupported',
      error: 'Le notifiche remote Android richiedono una build installata di Marilab Mover, non Expo Go.',
    };
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('deliveries', {
        name: 'Consegne e aggiornamenti',
        description: 'Richieste, stati, chat e promemoria di Marilab Mover',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        sound: 'default',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;
    if (existing.status !== 'granted') {
      if (!requestPermission) {
        return {
          ok: false,
          permission: existing.status === 'denied' ? 'denied' : 'prompt',
          error: existing.status === 'denied'
            ? 'Permesso notifiche non concesso nelle impostazioni del telefono.'
            : 'Apri “Notifiche push” e premi “Attiva su questo dispositivo”.',
        };
      }
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }
    if (finalStatus !== 'granted') {
      return { ok: false, permission: finalStatus, error: 'Permesso notifiche non concesso nelle impostazioni del telefono.' };
    }

    const projectId =
      process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      return { ok: false, permission: finalStatus, error: 'EAS projectId non trovato nella configurazione dell’app.' };
    }

    const token = await getExpoTokenWithRetry(projectId);
    return {
      ok: true,
      provider: 'expo',
      token,
      permission: finalStatus,
      projectId,
      deviceName: Device.deviceName ?? `${Platform.OS} device`,
    };
  } catch (error) {
    return { ok: false, permission: 'error', error: readableError(error) };
  }
}

export function subscribeToPushTokenRefresh(listener: (result: PushRegistrationResult) => void) {
  if (Platform.OS === 'web') return () => undefined;
  const subscription = Notifications.addPushTokenListener(() => {
    void registerForPushNotificationsAsync(false).then(listener);
  });
  return () => subscription.remove();
}

export function subscribeToNotificationActivity(listener: () => void) {
  if (Platform.OS === 'web') return () => undefined;
  const received = Notifications.addNotificationReceivedListener(listener);
  const responded = Notifications.addNotificationResponseReceivedListener(listener);
  const dropped = Platform.OS === 'android' ? Notifications.addNotificationsDroppedListener(listener) : undefined;
  return () => {
    received.remove();
    responded.remove();
    dropped?.remove();
  };
}

export async function showDemoNotification(title: string, body: string) {
  if (Platform.OS === 'web') return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default', badge: 1 },
    trigger: null,
  });
}

export async function syncAppBadgeCount(count: number) {
  if (Platform.OS === 'web') return false;
  try {
    return await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    return false;
  }
}

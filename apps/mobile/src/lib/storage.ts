import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); the app still works for the session.
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

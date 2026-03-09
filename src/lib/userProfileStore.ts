// User Profile Store — persists user name and preferences to localStorage

const STORAGE_KEY = "user-profile";

export interface UserProfile {
  name: string;
  setupComplete: boolean;
}

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  setupComplete: false,
};

export function getUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveUserProfile(profile: Partial<UserProfile>): void {
  const current = getUserProfile();
  const updated = { ...current, ...profile };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function getUserName(): string {
  return getUserProfile().name || "";
}

export function isSetupComplete(): boolean {
  return getUserProfile().setupComplete;
}

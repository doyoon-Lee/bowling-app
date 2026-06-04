export const APP_LOGGED_OUT_KEY = "bowling_app_logged_out";

export function createGuestName() {
  const randomNumber = Math.floor(10000 + Math.random() * 90000);
  return `Guest_${randomNumber}`;
}

export function isGuestUser(user) {
  return Boolean(user?.is_anonymous || user?.user_metadata?.guest_name);
}

export function getDisplayUserName(user) {
  const metadata = user?.user_metadata || {};
  const identityData = user?.identities?.[0]?.identity_data || {};

  const candidates = [
    metadata.guest_name,
    metadata.nickname,
    metadata.name,
    metadata.full_name,
    metadata.preferred_username,
    identityData.nickname,
    identityData.name,
    identityData.full_name,
    identityData.preferred_username,
    metadata.email,
    user?.email,
  ];

  const displayName = candidates.find((value) => typeof value === "string" && value.trim());

  if (!displayName) return "로그인 사용자";

  const trimmed = displayName.trim();
  return trimmed.includes("@") ? trimmed.split("@")[0] : trimmed;
}

export function isInAppBrowser() {
  const ua = navigator.userAgent.toLowerCase();

  return (
    ua.includes("naver") ||
    ua.includes("kakaotalk") ||
    ua.includes("instagram") ||
    ua.includes("fbav") ||
    ua.includes("line")
  );
}

export function openCurrentPageInExternalBrowser() {
  const currentUrl = window.location.href;
  const urlWithoutProtocol = currentUrl.replace(/^https?:\/\//, "");
  const ua = navigator.userAgent.toLowerCase();

  if (/android/i.test(ua)) {
    window.location.href = `intent://${urlWithoutProtocol}#Intent;scheme=https;package=com.android.chrome;end`;
    return;
  }

  window.location.href = currentUrl;
}

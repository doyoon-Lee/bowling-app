export const APP_LOGGED_OUT_KEY = "bowling_app_logged_out";

export function createGuestName() {
  const randomNumber = Math.floor(10000 + Math.random() * 90000);
  return `Guest_${randomNumber}`;
}

export function isGuestUser(user) {
  return Boolean(user?.is_anonymous || user?.user_metadata?.guest_name);
}

export function getDisplayUserName(user) {
  return (
    user?.user_metadata?.guest_name ||
    user?.email ||
    user?.user_metadata?.email ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.nickname ||
    "로그인 사용자"
  );
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

export const APP_LOGGED_OUT_KEY = "bowling_app_logged_out";

export function createGuestName() {
  const randomNumber = Math.floor(10000 + Math.random() * 90000);
  return `Guest_${randomNumber}`;
}

export function isGuestUser(user) {
  return Boolean(user?.is_anonymous || user?.user_metadata?.guest_name);
}

function cleanName(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.includes("@")) return "";
  return trimmed;
}

function emailLocalPart(user) {
  const email =
    user?.email ||
    user?.user_metadata?.email ||
    user?.user_metadata?.kakao_account?.email ||
    user?.identities?.find((identity) => identity?.identity_data?.email)?.identity_data?.email ||
    "";

  return typeof email === "string" && email.includes("@") ? email.split("@")[0] : "";
}

export function getDisplayUserName(user) {
  const metadata = user?.user_metadata || {};
  const identityDataList = Array.isArray(user?.identities)
    ? user.identities.map((identity) => identity?.identity_data || {})
    : [];

  const candidates = [
    metadata.guest_name,
    metadata.nickname,
    metadata.preferred_username,
    metadata.name,
    metadata.full_name,
    metadata.user_name,
    metadata.screen_name,
    metadata.kakao_account?.profile?.nickname,
    metadata.properties?.nickname,
    metadata.profile?.nickname,
    ...identityDataList.flatMap((data) => [
      data.nickname,
      data.preferred_username,
      data.name,
      data.full_name,
      data.user_name,
      data.screen_name,
      data.kakao_account?.profile?.nickname,
      data.properties?.nickname,
      data.profile?.nickname,
    ]),
  ];

  const profileName = candidates.map(cleanName).find(Boolean);
  return profileName || emailLocalPart(user) || "로그인 사용자";
}

export function isEmailLikeDisplayName(value, user) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  const email =
    user?.email ||
    user?.user_metadata?.email ||
    user?.user_metadata?.kakao_account?.email ||
    "";

  return trimmed.includes("@") || trimmed === email || trimmed === emailLocalPart(user);
}

export function getUserEmail(user) {
  const metadata = user?.user_metadata || {};
  const identityEmail = Array.isArray(user?.identities)
    ? user.identities.find((identity) => identity?.identity_data?.email)?.identity_data?.email
    : "";

  return (
    user?.email ||
    metadata.email ||
    metadata.kakao_account?.email ||
    identityEmail ||
    "게스트 사용자"
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

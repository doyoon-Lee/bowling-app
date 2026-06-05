import React from "react";

export default function AuthScreen({
  authLoading,
  inAppBrowser,
  onGoogleLogin,
  onKakaoLogin,
  onGuestLogin,
}) {
  if (authLoading) {
    return (
      <main className="app authPage">
        <section className="authContainer">
          <div className="loginCard loadingCard">
            <div className="logoBadge">🎳</div>
            <h1>Bowling Score</h1>
            <p>로그인 상태를 확인하는 중입니다...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app authPage">
      <section className="authContainer">
        <div className="loginCard">
          <div className="logoBadge">🎳</div>
          <h1>Bowling Score</h1>
          <p className="loginSubtitle">개인 볼링 기록을 날짜별로 저장하고 점수 변화를 확인하세요.</p>

          <div className="loginFeatureGrid">
            <div>
              <strong>개인 기록</strong>
              <span>계정별 점수 저장</span>
            </div>
            <div>
              <strong>날짜별 관리</strong>
              <span>일자별 평균/최고점</span>
            </div>
          </div>

          {inAppBrowser && (
            <div className="browserNotice">
              <strong>외부 브라우저가 필요합니다.</strong>
              <span>네이버/카카오 앱 내부 브라우저에서는 Google 로그인이 차단될 수 있습니다. Kakao 로그인 또는 Chrome 열기를 사용하세요.</span>
            </div>
          )}

          <div className="loginButtonGroup">
            <button className="googleLoginButton" onClick={onGoogleLogin}>
              <span className="loginButtonInner">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
                <span>{inAppBrowser ? "Chrome으로 열기" : "Google 계정으로 로그인"}</span>
              </span>
            </button>

            <button className="kakaoLoginButton" onClick={onKakaoLogin}>
              <span className="loginButtonInner">
                <span className="kakaoLogoText">K</span>
                <span>Kakao 계정으로 로그인</span>
              </span>
            </button>

            <button className="guestLoginButton" onClick={onGuestLogin}>
              <span className="loginButtonInner">
                <span className="guestLogoText">G</span>
                <span>게스트로 시작하기</span>
              </span>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

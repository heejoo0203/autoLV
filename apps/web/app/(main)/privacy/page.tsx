export default function PrivacyPolicyPage() {
  return (
    <>
      <section className="panel">
        <h2>개인정보처리방침</h2>
        <p className="hint">
          필지랩(이하 &quot;서비스&quot;)은 개인정보보호법 등 관련 법령을 준수하며, 이용자의 개인정보를 안전하게 보호하기 위해
          본 방침을 공개합니다.
        </p>
        <p className="hint">시행일: 2026-03-05</p>
      </section>

      <section className="panel privacy-section">
        <h3>1. 수집하는 개인정보 항목</h3>
        <ul>
          <li>회원가입 시: 이름(닉네임), 연락처, 이메일, 비밀번호(암호화 저장)</li>
          <li>서비스 이용 시: 조회 이력, 파일 조회 작업 이력, 접속 로그, 쿠키/세션 정보</li>
          <li>프로필 설정 시: 프로필 이미지(선택)</li>
        </ul>
      </section>

      <section className="panel privacy-section">
        <h3>2. 개인정보의 수집 및 이용 목적</h3>
        <ul>
          <li>회원 식별 및 본인 인증, 계정 관리</li>
          <li>개별조회/지도조회/파일조회 기능 제공 및 결과 저장</li>
          <li>고객 문의 대응 및 서비스 품질 개선</li>
          <li>부정 이용 방지 및 보안 모니터링</li>
        </ul>
      </section>

      <section className="panel privacy-section">
        <h3>3. 개인정보의 보유 및 이용 기간</h3>
        <ul>
          <li>회원정보: 회원 탈퇴 시까지 보관</li>
          <li>조회 이력/작업 이력: 서비스 운영 목적 범위 내에서 보관</li>
          <li>관계 법령에 따른 보존이 필요한 경우 해당 기간 동안 보관 후 파기</li>
        </ul>
      </section>

      <section className="panel privacy-section">
        <h3>4. 개인정보의 제3자 제공 및 처리위탁</h3>
        <ul>
          <li>원칙적으로 이용자 동의 없이 제3자에게 제공하지 않습니다.</li>
          <li>서비스 제공을 위해 클라우드/인프라 사업자를 이용할 수 있습니다.</li>
          <li>외부 공공 API(VWorld 등)는 조회 기능 제공 목적 범위에서만 연동됩니다.</li>
        </ul>
      </section>

      <section className="panel privacy-section">
        <h3>5. 이용자의 권리와 행사 방법</h3>
        <ul>
          <li>이용자는 언제든지 개인정보 조회·수정·삭제(회원 탈퇴)를 요청할 수 있습니다.</li>
          <li>회원은 마이페이지에서 정보 수정, 비밀번호 변경, 탈퇴 기능을 이용할 수 있습니다.</li>
        </ul>
      </section>

      <section className="panel privacy-section">
        <h3>6. 개인정보의 안전성 확보 조치</h3>
        <ul>
          <li>비밀번호 암호화 저장, 접근 통제, 전송 구간 암호화(HTTPS)</li>
          <li>세션/쿠키 기반 인증 보호 및 운영 로그 관리</li>
          <li>정기적 보안 점검 및 최소 권한 원칙 적용</li>
        </ul>
      </section>

      <section className="panel privacy-section">
        <h3>7. 쿠키 사용 안내</h3>
        <ul>
          <li>로그인 상태 유지, 인증 처리, 사용자 편의 기능 제공을 위해 쿠키를 사용합니다.</li>
          <li>브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나 일부 기능이 제한될 수 있습니다.</li>
        </ul>
      </section>

      <section className="panel privacy-section">
        <h3>8. 문의처</h3>
        <p className="hint">
          개인정보 관련 문의는 운영자 이메일로 접수할 수 있습니다.
          <br />
          문의: <a href="mailto:kr.autolv@gmail.com">kr.autolv@gmail.com</a>
        </p>
        <p className="hint">
          계정 삭제 요청 절차는 <a href="/account-deletion">계정삭제 안내</a> 페이지에서 확인할 수 있습니다.
        </p>
      </section>
    </>
  );
}

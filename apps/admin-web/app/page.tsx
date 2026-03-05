export default function AdminHomePage() {
  return (
    <main style={{ maxWidth: 900, margin: "24px auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>냉장고 관리자 콘솔 (M2 초기)</h1>
      <p>초기 단계에서는 API 기반 운영 점검을 우선합니다.</p>
      <ul>
        <li>등록/수정 이력은 API와 DB에서 확인</li>
        <li>알림 전송은 worker 로그로 확인</li>
        <li>고도화 UI는 M4에서 구현</li>
      </ul>
    </main>
  );
}

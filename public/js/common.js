// 공통 유틸리티 함수

// 일정 데이터 변경 이벤트 처리를 위한 커스텀 이벤트
const SCHEDULE_UPDATED_EVENT = 'scheduleUpdated';

// 종합보고서 관련 데이터 제거
(function cleanupReportData() {
  // 종합보고서 관련 localStorage 항목 제거
  localStorage.removeItem('last_active_tab');
  localStorage.removeItem('calendar_from_report');
  
  console.log('종합보고서 관련 데이터가 정리되었습니다.');
})();

// 일정 변경 이벤트 리스너 등록 함수
function addScheduleUpdateListener(callback) {
  window.addEventListener(SCHEDULE_UPDATED_EVENT, function(event) {
    callback(event.detail.type, event.detail.data);
  });
}

// 이전 화면으로 돌아가기 함수
function goBack() {
  console.log('이전 화면으로 돌아가기 함수 호출');
  
  // 이전 페이지 정보가 있는지 확인
  if (document.referrer && document.referrer.includes(window.location.hostname)) {
    console.log('이전 페이지 찾음:', document.referrer);
    window.location.href = document.referrer;
  } else {
    // localStorage에 저장된 사용자 정보 확인
    try {
      const userData = JSON.parse(localStorage.getItem('userData'));
      const committeeData = JSON.parse(localStorage.getItem('currentCommittee'));
      
      if (userData || committeeData) {
        console.log('사용자 정보 찾음, 대시보드로 이동');
        // 대시보드로 이동
        window.location.href = '/dashboard';
        return;
      }
    } catch (e) {
      console.warn('사용자 데이터 파싱 오류:', e);
    }
    
    // 사용자 정보가 없으면 메인 페이지로 이동
    console.log('이전 페이지 정보 없음, 메인 페이지로 이동');
    window.location.href = '/';
  }
}

// 일정 업데이트 알림 함수 (다른 모듈에서 사용)
function notifyScheduleUpdated(type, data) {
  // 이벤트를 발생시켜 다른 모듈에 알림
  const event = new CustomEvent('scheduleUpdated', {
    detail: {
      type: type,
      data: data
    }
  });
  
  window.dispatchEvent(event);
  document.dispatchEvent(event);
  
  console.log(`일정 ${type} 이벤트가 발생되었습니다:`, data);
  return true;
} 
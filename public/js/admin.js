// 관리자 페이지 기능
document.addEventListener('DOMContentLoaded', () => {
  // 권한 확인
  checkAdminPermission();
  
  // 정리 버튼 이벤트 연결
  const cleanupBtn = document.getElementById('cleanup-results-btn');
  if (cleanupBtn) {
    cleanupBtn.addEventListener('click', cleanupDuplicateResults);
  }
});

// 관리자 권한 확인
async function checkAdminPermission() {
  try {
    const response = await fetch('/api/committees/me', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      showMessage('로그인이 필요합니다.', 'error');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      return;
    }
    
    const isAdmin = result.data?.committee?.isAdmin === true;
    if (!isAdmin) {
      showMessage('관리자 권한이 없습니다.', 'error');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
      return;
    }
    
    // 관리자 정보 표시
    const adminNameEl = document.getElementById('admin-name');
    if (adminNameEl && result.data?.committee?.name) {
      adminNameEl.textContent = result.data.committee.name;
    }
    
    // 관리자 UI 활성화
    document.getElementById('admin-panel').classList.remove('hidden');
    
  } catch (error) {
    console.error('관리자 권한 확인 중 오류:', error);
    showMessage('서버 오류가 발생했습니다.', 'error');
  }
}

// 중복 데이터 정리
async function cleanupDuplicateResults() {
  if (!confirm('중복 데이터 정리를 실행하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
    return;
  }
  
  try {
    // 버튼 비활성화 및 로딩 상태 표시
    const cleanupBtn = document.getElementById('cleanup-results-btn');
    if (cleanupBtn) {
      cleanupBtn.disabled = true;
      cleanupBtn.innerHTML = '<span class="animate-pulse">정리 중...</span>';
    }
    
    // 정리 API 호출
    const response = await resultApi.cleanupDuplicateResults();
    
    if (response.status === 'success') {
      const cleanedCount = response.data?.cleanupResult?.cleaned || 0;
      const totalRows = response.data?.cleanupResult?.totalRows || 0;
      
      showMessage(`중복 데이터 정리 완료: ${cleanedCount}개 항목 제거됨, 총 ${totalRows}개 항목 유지됨`, 'success');
      
      // 결과 표시
      const resultEl = document.getElementById('cleanup-result');
      if (resultEl) {
        resultEl.innerHTML = `
          <div class="bg-green-50 p-4 rounded-md border border-green-200 mt-4">
            <h3 class="font-bold text-green-800">정리 결과</h3>
            <p class="text-green-700">중복 데이터 정리가 완료되었습니다.</p>
            <ul class="mt-2 list-disc list-inside text-green-700">
              <li>${cleanedCount}개 중복 항목 제거</li>
              <li>${totalRows}개 항목 유지</li>
              <li>처리 시간: ${new Date().toLocaleTimeString()}</li>
            </ul>
          </div>
        `;
        resultEl.classList.remove('hidden');
      }
    } else {
      showMessage(`정리 실패: ${response.message || '알 수 없는 오류'}`, 'error');
    }
  } catch (error) {
    console.error('중복 데이터 정리 중 오류:', error);
    showMessage('중복 데이터 정리 중 오류가 발생했습니다.', 'error');
  } finally {
    // 버튼 상태 복원
    const cleanupBtn = document.getElementById('cleanup-results-btn');
    if (cleanupBtn) {
      cleanupBtn.disabled = false;
      cleanupBtn.innerHTML = '중복 데이터 정리';
    }
  }
}

// 메시지 표시
function showMessage(message, type = 'info') {
  const messageEl = document.getElementById('message');
  if (!messageEl) return;
  
  messageEl.textContent = message;
  messageEl.className = 'p-4 mb-4 rounded-md';
  
  // 메시지 타입에 따른 스타일 설정
  if (type === 'error') {
    messageEl.classList.add('bg-red-100', 'text-red-700', 'border', 'border-red-200');
  } else if (type === 'success') {
    messageEl.classList.add('bg-green-100', 'text-green-700', 'border', 'border-green-200');
  } else {
    messageEl.classList.add('bg-blue-100', 'text-blue-700', 'border', 'border-blue-200');
  }
  
  messageEl.classList.remove('hidden');
  
  // 3초 후 메시지 숨기기
  setTimeout(() => {
    messageEl.classList.add('hidden');
  }, 3000);
} 
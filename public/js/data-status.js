/**
 * 데이터 상태 관리 및 알림 컴포넌트
 * API 응답을 모니터링하고 fallback 데이터 사용 시 사용자에게 알림
 */

// 데이터 소스 상태 저장
const dataSourceStatus = {
  sources: {},
  notifications: [],
  lastSyncTimes: {},
  container: null
};

/**
 * API 응답을 처리하고 데이터 상태 업데이트
 * @param {string} dataType - 데이터 타입(committees, organizations 등)
 * @param {Object} response - API 응답 객체
 */
function trackDataSource(dataType, response) {
  if (!response || !response.meta) return;
  
  // 데이터 소스 정보 저장
  dataSourceStatus.sources[dataType] = response.meta.source;
  
  // 마지막 동기화 시간 저장
  if (response.meta.lastSync) {
    dataSourceStatus.lastSyncTimes[dataType] = response.meta.lastSync;
  }
  
  // fallback 데이터 사용 중인 경우 알림
  if (response.meta.usingFallback) {
    addNotification(dataType, response.meta.source);
  }
  
  // 상태 알림 UI 업데이트
  updateStatusUI();
}

/**
 * 알림 추가
 * @param {string} dataType - 데이터 타입
 * @param {string} source - 데이터 소스
 */
function addNotification(dataType, source) {
  // 중복 알림 방지
  const existingIndex = dataSourceStatus.notifications.findIndex(
    n => n.dataType === dataType && n.source === source
  );
  
  if (existingIndex >= 0) return;
  
  dataSourceStatus.notifications.push({
    dataType,
    source,
    timestamp: new Date().toISOString()
  });
}

/**
 * 상태 UI 업데이트
 */
function updateStatusUI() {
  // 알림 컨테이너가 없으면 생성
  if (!dataSourceStatus.container) {
    createStatusContainer();
  }
  
  // 알림이 없으면 컨테이너 숨기기
  if (dataSourceStatus.notifications.length === 0) {
    dataSourceStatus.container.style.display = 'none';
    return;
  }
  
  // 알림 컨테이너 표시
  dataSourceStatus.container.style.display = 'block';
  
  // 알림 내용 업데이트
  const statusContent = dataSourceStatus.container.querySelector('.status-content');
  statusContent.innerHTML = '';
  
  // 알림 메시지 추가
  dataSourceStatus.notifications.forEach(notification => {
    const item = document.createElement('div');
    item.className = 'status-item';
    
    // 데이터 타입에 따른 표시 이름 설정
    const dataTypeName = getDataTypeName(notification.dataType);
    
    // 소스에 따른 메시지 설정
    let message = '';
    let icon = '';
    
    switch (notification.source) {
      case 'cache':
        message = `${dataTypeName} 데이터는 캐시된 데이터를 사용 중입니다.`;
        icon = '⚠️';
        break;
      case 'static-fallback':
        message = `${dataTypeName} 데이터는 기본 데이터를 사용 중입니다.`;
        icon = '⚠️';
        break;
      case 'error-fallback':
        message = `${dataTypeName} 데이터 로드 중 오류가 발생하여 기본 데이터를 사용 중입니다.`;
        icon = '❌';
        break;
      default:
        message = `${dataTypeName} 데이터가 최신 상태가 아닐 수 있습니다.`;
        icon = 'ℹ️';
    }
    
    // 마지막 동기화 시간이 있으면 메시지에 추가
    const lastSync = dataSourceStatus.lastSyncTimes[notification.dataType];
    if (lastSync) {
      const syncDate = new Date(lastSync);
      message += ` (마지막 업데이트: ${formatDate(syncDate)})`;
    }
    
    item.innerHTML = `
      <span class="status-icon">${icon}</span>
      <span class="status-message">${message}</span>
    `;
    
    statusContent.appendChild(item);
  });
}

/**
 * 상태 알림 컨테이너 생성
 */
function createStatusContainer() {
  const container = document.createElement('div');
  container.className = 'data-status-container';
  container.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    max-width: 400px;
    background-color: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
    padding: 1rem;
    z-index: 1050;
    display: none;
  `;
  
  container.innerHTML = `
    <div class="status-header">
      <h5 style="margin: 0 0 10px 0; font-size: 1rem;">데이터 상태 알림</h5>
      <button class="close-btn" style="position: absolute; top: 10px; right: 10px; background: none; border: none; cursor: pointer; font-size: 1.2rem;">&times;</button>
    </div>
    <div class="status-content"></div>
    <div class="status-footer" style="margin-top: 10px; font-size: 0.8rem; text-align: right;">
      <button class="refresh-btn" style="background-color: #007bff; color: white; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer;">
        새로고침
      </button>
    </div>
  `;
  
  document.body.appendChild(container);
  dataSourceStatus.container = container;
  
  // 닫기 버튼 이벤트
  const closeBtn = container.querySelector('.close-btn');
  closeBtn.addEventListener('click', () => {
    container.style.display = 'none';
  });
  
  // 새로고침 버튼 이벤트
  const refreshBtn = container.querySelector('.refresh-btn');
  refreshBtn.addEventListener('click', () => {
    // 페이지 새로고침
    window.location.reload();
  });
}

/**
 * 데이터 타입에 따른 표시 이름 반환
 * @param {string} dataType - 데이터 타입 키
 * @returns {string} 표시 이름
 */
function getDataTypeName(dataType) {
  const nameMap = {
    'committees': '위원회',
    'organizations': '기관',
    'schedules': '일정'
  };
  
  return nameMap[dataType] || dataType;
}

/**
 * 날짜 포맷팅
 * @param {Date} date - 날짜 객체
 * @returns {string} 포맷된 날짜
 */
function formatDate(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 60) {
    return `${diffMins}분 전`;
  } else if (diffMins < 1440) {
    return `${Math.floor(diffMins / 60)}시간 전`;
  } else {
    return `${Math.floor(diffMins / 1440)}일 전`;
  }
}

// 글로벌 스코프에 노출
window.dataStatus = {
  trackDataSource,
  getStatus: () => dataSourceStatus
}; 
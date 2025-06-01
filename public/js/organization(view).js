// 기관 관련 함수들

// 현재 선택된 기관 정보
let selectedOrganization = null;

// 간단한 메시지 표시 함수
const displayOrgMessage = (message, type = 'info') => {
  console.log(`${type.toUpperCase()}: ${message}`);
  
  // 메시지를 UI에 표시
  const messageContainer = document.getElementById('message-container');
  if (messageContainer) {
    // 메시지 요소 생성
    const messageElement = document.createElement('div');
    messageElement.className = `p-4 mb-4 rounded ${
      type === 'error' ? 'bg-red-100 text-red-800' : 
      type === 'success' ? 'bg-green-100 text-green-800' : 
      'bg-blue-100 text-blue-800'
    }`;
    messageElement.innerHTML = `
      <p class="mb-0">${message}</p>
    `;
    
    // 기존 메시지 삭제
    messageContainer.innerHTML = '';
    messageContainer.appendChild(messageElement);
    
    // 3초 후 메시지 삭제
    setTimeout(() => {
      messageElement.remove();
    }, 5000);
  } else {
    // 메시지 컨테이너가 없으면 alert 사용
    alert(message);
  }
};

// 기관 목록 가져오기 및 표시
const loadOrganizations = async () => {
  try {
    // 로딩 상태 표시
    const mainOrgsContainer = document.getElementById('main-organizations');
    const subOrgsContainer = document.getElementById('sub-organizations');
    
    if (mainOrgsContainer) {
      mainOrgsContainer.innerHTML = '<p class="text-gray-500">기관 목록을 불러오는 중...</p>';
    }
    
    if (subOrgsContainer) {
      subOrgsContainer.innerHTML = '<p class="text-gray-500">기관 목록을 불러오는 중...</p>';
    }
    
    console.log('기관 목록 로딩 시작');
    // getMyOrganizations 함수가 이미 api.js에서 JWT 토큰을 사용하도록 수정됨
    const response = await api.organizations.getMyOrganizations();
    console.log('받은 응답:', response);
    
    if (response && response.status === 'success') {
      const mainOrgs = response.data.mainOrganizations || [];
      const subOrgs = response.data.subOrganizations || [];
      console.log(`로드된 기관: 주담당 ${mainOrgs.length}개, 부담당 ${subOrgs.length}개`);
      
      renderOrganizations(mainOrgs, subOrgs);
      updateDashboardStatistics(mainOrgs, subOrgs);
      
      // 메시지가 있으면 표시
      if (response.message) {
        displayOrgMessage(response.message, 'info');
      }
      
      return true;
    } else {
      console.error('응답 형식 오류:', response);
      displayOrgMessage('기관 목록을 가져오는데 실패했습니다.', 'error');
      
      // 빈 데이터로 UI 렌더링하여 깨지지 않도록 함
      renderOrganizations([], []);
      updateDashboardStatistics([], []);
      return false;
    }
  } catch (error) {
    console.error('ERROR: 기관 목록을 가져오는데 실패했습니다.', error);
    displayOrgMessage('기관 목록을 불러오는 중 오류가 발생했습니다.', 'error');
    
    // 오류 발생해도 UI 렌더링
    renderOrganizations([], []);
    updateDashboardStatistics([], []);
    return false;
  }
};

// 대시보드 통계 업데이트
const updateDashboardStatistics = (mainOrgs, subOrgs) => {
  // 담당 기관 수 계산
  const totalOrgsCount = (mainOrgs ? mainOrgs.length : 0) + (subOrgs ? subOrgs.length : 0);
  
  // UI 업데이트
  document.getElementById('total-orgs-count').textContent = totalOrgsCount;
  document.getElementById('total-all-orgs').textContent = totalOrgsCount;
  document.getElementById('completed-orgs-count').textContent = '0'; // 실제 완료된 기관 수로 업데이트 필요
  document.getElementById('total-orgs-count-2').textContent = totalOrgsCount;
  document.getElementById('total-completion-rate').textContent = '0%'; // 실제 완료율로 업데이트 필요
  document.getElementById('completion-progress-bar').style.width = '0%'; // 실제 완료율로 업데이트 필요
};

// 기관 목록 렌더링
const renderOrganizations = (mainOrgs, subOrgs) => {
  const mainOrgsContainer = document.getElementById('main-organizations');
  const subOrgsContainer = document.getElementById('sub-organizations');
  
  if (!mainOrgsContainer || !subOrgsContainer) return;
  
  // 주담당 기관 렌더링
  mainOrgsContainer.innerHTML = '';
  if (mainOrgs && mainOrgs.length > 0) {
    mainOrgs.forEach(org => {
      const orgCard = createOrganizationCard(org, true);
      mainOrgsContainer.appendChild(orgCard);
    });
  } else {
    mainOrgsContainer.innerHTML = '<p class="text-gray-500">주담당 기관이 없습니다.</p>';
  }
  
  // 부담당 기관 렌더링
  subOrgsContainer.innerHTML = '';
  if (subOrgs && subOrgs.length > 0) {
    subOrgs.forEach(org => {
      const orgCard = createOrganizationCard(org, false);
      subOrgsContainer.appendChild(orgCard);
    });
  } else {
    subOrgsContainer.innerHTML = '<p class="text-gray-500">부담당 기관이 없습니다.</p>';
  }
};

// 기관 카드 생성
const createOrganizationCard = (org, isMainOrg) => {
  const orgCard = document.createElement('div');
  orgCard.className = 'org-card bg-white p-4 hover:bg-gray-50 cursor-pointer shadow-sm rounded-lg border border-gray-200';
  
  const orgName = org.name;
  const orgCode = org.code;
  const orgRegion = org.region;
  
  orgCard.innerHTML = `
    <div class="flex justify-between items-start mb-4">
      <div>
        <h4 class="text-lg font-semibold text-gray-900">${orgName}</h4>
        <p class="text-sm text-gray-600">${orgCode}</p>
        <p class="text-sm text-gray-500">${orgRegion}</p>
      </div>
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isMainOrg ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
      }">
        ${isMainOrg ? '주담당' : '부담당'}
      </span>
    </div>
  `;
  
  orgCard.dataset.orgCode = orgCode;
  orgCard.addEventListener('click', () => selectOrganization(org));
  
  return orgCard;
};

// 기관 선택 처리
const selectOrganization = (org) => {
  try {
    // 로그인 후 API 호출 허용 플래그 설정
    window.skipInitialApiCalls = false;
    
    // 선택된 기관 정보 설정
    selectedOrganization = org;
    
    console.log('선택된 기관:', org);
    console.log('API 호출 플래그:', window.skipInitialApiCalls);
    
    // 전역 변수에 선택된 기관 저장 (다른 스크립트에서 접근 가능하도록)
    window.selectedOrganization = org;
    
    // 기관명 표시 업데이트
    const selectedOrgNameElement = document.getElementById('selected-org-name');
    if (selectedOrgNameElement) {
      selectedOrgNameElement.textContent = org.name || org.기관명 || '선택된 기관';
    }

    // 기관 선택 화면 숨기기
    document.getElementById('organization-selection').classList.add('hidden');
    
    // 모니터링 지표 화면 표시
    const monitoringIndicatorsElement = document.getElementById('monitoring-indicators');
    monitoringIndicatorsElement.classList.remove('hidden');
    
    // 주기 탭 중 매월 점검 탭 자동 선택
    const monthlyTab = document.querySelector('.period-tab[data-period="매월"]');
    
    if (monthlyTab) {
      console.log('매월 탭 클릭 이벤트 실행');
      
      // periodTabClick 함수가 있는 경우 사용 (index.html에 정의됨)
      if (typeof window.periodTabClick === 'function') {
        console.log('window.periodTabClick 함수 사용');
        window.periodTabClick(monthlyTab, '매월');
      } else {
        // 없으면 직접 클릭 이벤트 실행
        console.log('직접 클릭 이벤트 실행');
        monthlyTab.click();
      }
      
      // 지표별 완료 현황 업데이트
      if (typeof updateAllPeriodCompletion === 'function') {
        updateAllPeriodCompletion();
      }
    } else {
      // 탭이 없는 경우 직접 지표 로드 시도
      if (typeof loadIndicatorsByPeriod === 'function') {
        console.log('loadIndicatorsByPeriod 함수 직접 호출 (매월)');
        loadIndicatorsByPeriod('매월');
      } else {
        console.error('지표 로드 함수를 찾을 수 없습니다. indicator.js가 로드되었는지 확인하세요.');
        displayOrgMessage('지표 로드 중 오류가 발생했습니다. 페이지를 새로고침해 주세요.', 'error');
      }
    }
    
    // 지표 로드 확인을 위한 타임아웃 설정
    setTimeout(() => {
      const indicatorsList = document.getElementById('indicators-list-sidebar');
      if (indicatorsList && (indicatorsList.children.length === 0 || indicatorsList.innerHTML.includes('지표가 없습니다'))) {
        console.warn('지표가 로드되지 않았습니다. 다시 시도합니다.');
        
        // 지표 로드 재시도
        if (typeof loadIndicatorsByPeriod === 'function') {
          console.log('loadIndicatorsByPeriod 함수 재시도 (매월)');
          loadIndicatorsByPeriod('매월');
        }
      }
    }, 2000); // 2초 후 확인
    
  } catch (error) {
    console.error('기관 선택 처리 중 오류:', error);
    displayOrgMessage('기관 선택 중 오류가 발생했습니다.', 'error');
  }
};

// 기관 목록으로 돌아가기
const backToOrganizationList = () => {
  selectedOrganization = null;
  loadOrganizations();
};

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  console.log('organization.js - DOMContentLoaded 이벤트 발생');
  
  // 로그인 화면인지 확인
  if (window.skipInitialApiCalls) {
    console.log('organization.js - 초기 API 호출 건너뛰기 플래그 감지');
    return;
  }
  
  const loginContainer = document.getElementById('login-container');
  if (loginContainer && !loginContainer.classList.contains('hidden')) {
    console.log('organization.js - 로그인 화면 감지, API 호출 건너뛰기');
    return;
  }
  
  console.log('organization.js - 기관 목록 로드 시작');
  loadOrganizations();
}); 
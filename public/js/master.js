// 마스터 대시보드 관련 기능

// 시군 리스트 regions.js에서 import
if (!window.SIGUN_LIST) {
  const script = document.createElement('script');
  script.src = '/js/regions.js';
  document.head.appendChild(script);
}

// 구글 시트 연동 기능 import
if (typeof window.syncSchedulesWithSheet !== 'function') {
  const sheetScript = document.createElement('script');
  sheetScript.src = '/js/googleSheetSync.js';
  document.head.appendChild(sheetScript);
}

// 전역 변수: 기관 목록
let allOrganizations = [];
// 전역 변수: 위원 목록
let allCommittees = [];
// 전역 변수: 위원-기관 매칭 정보
let allMatchings = [];

// 특별 기관 목록 (committeeSchedule.js와 동일하게 유지)
const specialOrganizations = [
  '진주노인통합지원센터',
  '함안군재가노인통합지원센터',
  '창녕군새누리노인통합지원센터',
  '효능원노인통합지원센터',
  '진해서부노인종합복지관'
];

// 특별 기관 확인 함수
const isSpecialOrganization = (orgName) => {
  if (!orgName) return false;
  
  // 정확한 일치 확인
  if (specialOrganizations.includes(orgName.trim())) {
    return true;
  }
  
  // 부분 일치 확인 (더 유연한 매칭)
  for (const specialOrg of specialOrganizations) {
    if (orgName.includes(specialOrg) || specialOrg.includes(orgName)) {
      return true;
    }
  }
  
  return false;
};

// 데이터 로드 상태 관리 변수
let isLoadingMasterData = false;
let isRefreshingMatchings = false;
let masterDataLoaded = false;

// 마스터 페이지인지 확인
window.isMasterDashboard = true;

// 로컬 스토리지에서 일정 데이터 초기화
function initScheduleDataFromLocalStorage() {
  try {
    // 로컬 스토리지에서 일정 데이터 확인
    const savedSchedules = localStorage.getItem('calendar_schedules');
    if (savedSchedules) {
      const parsedSchedules = JSON.parse(savedSchedules);
      if (parsedSchedules.length > 0) {
        console.log(`[DEBUG] 마스터 페이지 초기화 시 로컬 스토리지에서 ${parsedSchedules.length}개의 일정 가져옴`);
        
        // 일정 데이터 형식 확인 및 정리
        const formattedSchedules = parsedSchedules.map(schedule => {
          // 필수 필드가 있는지 확인하고 없으면 추가
          return {
            id: schedule.id || `schedule_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`,
            date: schedule.date || schedule.visitDate || new Date().toISOString().split('T')[0],
            visitDate: schedule.visitDate || schedule.date || new Date().toISOString().split('T')[0],
            committeeName: schedule.committeeName || '미지정',
            organizationName: schedule.organizationName || schedule.orgName || '미지정',
            orgName: schedule.orgName || schedule.organizationName || '미지정',
            orgCode: schedule.orgCode || '',
            startTime: schedule.startTime || '미지정',
            endTime: schedule.endTime || '미지정',
            status: schedule.status || 'pending',
            notes: schedule.notes || schedule.memo || '',
            memo: schedule.memo || schedule.notes || '',
            createdAt: schedule.createdAt || new Date().toISOString()
          };
        });
        
        // 전역 변수에 데이터 저장
        window.allCommitteeSchedules = formattedSchedules;
        window.schedulesLoaded = true;
        
        // 일정 데이터가 업데이트되었음을 알림
        const updateEvent = new CustomEvent('masterDashboardDataUpdated', {
          detail: {
            type: 'update',
            data: {
              schedules: formattedSchedules
            }
          }
        });
        document.dispatchEvent(updateEvent);
        
        return true;
      }
    }
  } catch (e) {
    console.error('로컬 스토리지에서 일정 데이터 가져오기 실패:', e);
  }
  return false;
}

// 마스터 대시보드 초기화 및 표시
async function showMasterDashboard() {
  console.log('마스터 대시보드 초기화 시작 - ' + new Date().toISOString());
  
  // API 객체 초기화 (없는 경우 생성)
  if (!window.api) {
    console.log('API 객체가 없습니다. 기본 API 객체를 생성합니다.');
    window.api = {
      // 기본 API 메서드 제공
      getOrganizations: async function() {
        console.log('기본 getOrganizations 메서드 호출');
        return { status: 'success', organizations: { main: [], sub: [] } };
      },
      organizations: {
        getMyOrganizations: async function() {
          console.log('기본 getMyOrganizations 메서드 호출');
          return { status: 'success', organizations: { main: [], sub: [] } };
        }
      }
    };
    
    // API 초기화 이벤트 발생
    document.dispatchEvent(new CustomEvent('apiInitialized', { detail: { api: window.api } }));
  }
  
  // 마스터 페이지 로드 시 일정 데이터 초기화
  initScheduleDataFromLocalStorage();

  // 이미 대시보드가 표시되어 있는지 확인
  const existingDashboard = document.getElementById('master-dashboard');
  if (existingDashboard && existingDashboard.classList.contains('initialized')) {
    console.log('마스터 대시보드가 이미 초기화되어 있습니다.');
    // 이미 초기화되어 있더라도 데이터 새로고침 시도
    loadMasterDashboardData();
    return;
  }
  
  try {
    console.log('마스터 대시보드 초기화 시작');
    
    // 일반 화면 숨기기
    document.getElementById('organization-selection').classList.add('hidden');
    document.getElementById('monitoring-indicators').classList.add('hidden');
    
    // committeeSchedule.js가 제대로 로드되었는지 확인
    if (typeof window.initializeCommitteeSchedulesView !== 'function') {
      console.log('일정 뷰 초기화 함수가 아직 로드되지 않음. 로딩 중...');
      
      // 스크립트 강제 로드 시도
      const script = document.createElement('script');
      script.src = '/js/committeeSchedule.js';
      script.onload = () => console.log('committeeSchedule.js 스크립트 추가 로드 완료');
      script.onerror = (e) => console.error('committeeSchedule.js 로드 오류:', e);
      document.head.appendChild(script);
    } else {
      console.log('일정 뷰 초기화 함수가 이미 로드되어 있음');
    }
    
    // 마스터 대시보드 컨테이너 가져오기 또는 생성
    let masterDashboard = document.getElementById('master-dashboard');
    if (!masterDashboard) {
      masterDashboard = document.createElement('div');
      masterDashboard.id = 'master-dashboard';
      masterDashboard.className = 'flex-1 container mx-auto px-4 py-6';
      document.querySelector('main').appendChild(masterDashboard);
    }
    
    // 마스터 대시보드 기본 내용
    masterDashboard.innerHTML = `
      <div class="bg-white p-6 rounded-lg shadow-sm mb-6">
        <h2 class="text-xl font-bold text-blue-700 mb-4">마스터 관리자 대시보드</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" id="dashboard-stats">
          <div class="bg-blue-50 p-4 rounded-lg">
            <h3 class="text-md font-medium text-blue-800 mb-2">전체 기관</h3>
            <div class="text-3xl font-bold" id="total-orgs-count">51</div>
            <p class="text-sm text-gray-500 mt-1">모니터링 대상 기관</p>
          </div>
          <div class="bg-green-50 p-4 rounded-lg">
            <h3 class="text-md font-medium text-green-800 mb-2">전체 완료율</h3>
            <div class="text-3xl font-bold" id="monitoring-completion-rate">0%</div>
            <div class="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div id="monitoring-progress-bar" class="bg-green-600 h-2.5 rounded-full" style="width: 0%"></div>
            </div>
            <p class="text-sm text-gray-500 mt-1">지표 점검 완료</p>
          </div>
          <div class="bg-purple-50 p-4 rounded-lg">
            <h3 class="text-md font-medium text-purple-800 mb-2">위원 수</h3>
            <div class="text-3xl font-bold" id="committees-count">5</div>
            <p class="text-sm text-gray-500 mt-1">활동 중인 모니터링 위원</p>
          </div>
        </div>
        
        <div class="mb-6">
          <h3 class="text-lg font-medium mb-3">기관-담당자 매칭 관리</h3>
          <div class="bg-blue-50 p-4 rounded-lg mb-4">
            <p class="text-sm text-blue-800">이 화면에서 모니터링 위원을 기관의 주담당 또는 부담당으로 배정할 수 있습니다.</p>
          </div>
          
          <div class="flex items-center justify-between mb-4">
            <div class="flex space-x-2">
              <button class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition" id="add-match-btn">
                담당자 매칭 추가
              </button>
              <button class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition" id="sync-sheet-btn">
                구글 시트 연동
              </button>
              <button class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition" id="add-org-btn">
                기관 추가
              </button>
              <button class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition" id="refresh-matches-btn">
                새로고침
              </button>
            </div>
            <div class="flex items-center">
              <label for="org-filter" class="mr-2 text-sm">기관 필터:</label>
              <select id="org-filter" class="border rounded px-2 py-1">
                <option value="">전체 기관</option>
                <option value="main">주담당 미배정</option>
                <option value="sub">부담당 미배정</option>
              </select>
            </div>
          </div>
          
          <div class="overflow-x-auto bg-white rounded-lg border border-gray-200">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">기관명</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">기관코드</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주담당</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">부담당</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">진행률</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시군</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                </tr>
              </thead>
              <tbody id="matching-table-body" class="bg-white divide-y divide-gray-200">
                <tr>
                  <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    // 마스터 대시보드 표시
    masterDashboard.classList.remove('hidden');
    
    // 데이터 로드
    await loadMasterDashboardData();
    
    // 이벤트 리스너 등록
    document.getElementById('add-match-btn').addEventListener('click', showAddMatchingModal);
    document.getElementById('add-org-btn').addEventListener('click', showAddOrgModal);
    document.getElementById('refresh-matches-btn').addEventListener('click', refreshMatchingData);
    document.getElementById('org-filter').addEventListener('change', filterOrganizations);
    
    // 담당자별 기관방문일정 뷰 초기화 (직접 호출)
    if (typeof window.initializeCommitteeSchedulesView === 'function') {
      console.log('[DEBUG] 담당자별 기관방문일정 뷰 직접 초기화 시도 (showMasterDashboard)');
      try {
        window.initializeCommitteeSchedulesView();
      } catch (e) {
        console.error('[DEBUG] 담당자별 기관방문일정 뷰 초기화 중 오류:', e);
      }
    } else {
      console.warn('[DEBUG] 담당자별 기관방문일정 뷰 초기화 함수를 찾을 수 없습니다 (showMasterDashboard)');
    }
    
    // 담당자별 기관방문일정 뷰 초기화를 위한 커스텀 이벤트 발생
    console.log('[DEBUG] 마스터 대시보드 준비 이벤트 발생');
    const dashboardReadyEvent = new Event('masterDashboardReady');
    document.dispatchEvent(dashboardReadyEvent);
    
    // 완료율 계산 함수 추가
    updateCompletionRate();
    
    // 일정 데이터가 변경될 때마다 완료율 업데이트
    document.addEventListener('masterDashboardDataUpdated', function(event) {
      console.log('[DEBUG] 마스터 대시보드 데이터 업데이트 이벤트 감지 - 완료율 업데이트');
      updateCompletionRate();
    });
    
    // 마스터 대시보드 초기화 완료 표시
    masterDashboard.classList.add('initialized');
    console.log('마스터 대시보드 초기화 완료');
    
    // 데이터 로드 시작
    await window.loadMasterDashboardData();
    
    // 매칭 테이블 자동 업데이트 (새로고침 버튼 클릭 없이도 표시되도록)
    if (allMatchings && allMatchings.length > 0) {
      console.log('로드된 매칭 정보로 테이블 자동 업데이트');
      updateMatchingTable();
    } else {
      // 매칭 정보가 없으면 자동으로 새로고침 시도
      await refreshMatchingData();
    }
  } catch (error) {
    console.error('마스터 대시보드 초기화 중 오류:', error);
    alert('마스터 대시보드를 초기화하는 중 오류가 발생했습니다.');
  }
};

// 완료율 계산 및 표시 함수
function updateCompletionRate() {
  try {
    console.log('[DEBUG] 완료율 계산 함수 실행');
    
    // 로컬 스토리지에서 일정 데이터 가져오기
    let schedules = [];
    try {
      const savedSchedules = localStorage.getItem('calendar_schedules');
      if (savedSchedules) {
        schedules = JSON.parse(savedSchedules);
        console.log(`[DEBUG] 로컬 스토리지에서 ${schedules.length}개의 일정 가져옴`);
      }
    } catch (e) {
      console.error('로컬 스토리지에서 일정 데이터 가져오기 실패:', e);
    }
    
    // 완료된 일정 수와 완료율 계산
    const completedSchedules = schedules.filter(schedule => schedule.status === 'completed').length;
    const totalSchedules = schedules.length;
    
    // 완료율 계산 (일정이 없으면 0%)
    const completionRate = totalSchedules > 0 ? Math.floor((completedSchedules / totalSchedules) * 100) : 0;
    
    // 대시보드에 표시
    const rateElement = document.getElementById('monitoring-completion-rate');
    const progressBarElement = document.getElementById('monitoring-progress-bar');
    
    if (rateElement) {
      rateElement.textContent = `${completionRate}%`;
      console.log(`[DEBUG] 완료율 텍스트 업데이트: ${completionRate}%`);
    } else {
      console.error('[DEBUG] monitoring-completion-rate 요소를 찾을 수 없습니다.');
    }
    
    if (progressBarElement) {
      progressBarElement.style.width = `${completionRate}%`;
      console.log(`[DEBUG] 완료율 프로그레스바 업데이트: ${completionRate}%`);
    } else {
      console.error('[DEBUG] monitoring-progress-bar 요소를 찾을 수 없습니다.');
    }
    
    console.log(`[DEBUG] 완료율 계산 결과: ${completedSchedules}/${totalSchedules} = ${completionRate}%`);
    return completionRate;
  } catch (error) {
    console.error('완료율 계산 중 오류:', error);
    return 0;
  }
}

// 마스터 대시보드 데이터 로드
window.loadMasterDashboardData = async () => {
  console.log('마스터 대시보드 데이터 로드 시작');
  
  // 이미 로드 중인 경우 중복 호출 방지
  if (isLoadingMasterData) {
    console.log('마스터 대시보드 데이터가 이미 로드 중입니다.');
    return;
  }
  
  // 항상 새로운 데이터를 로드하도록 수정
  // 기존 데이터가 있더라도 새로고침 시도
  console.log('마스터 대시보드 데이터 새로고침 시작');
  
  // 로드 상태 설정
  isLoadingMasterData = true;
  
  // 구글 시트에서 일정 데이터 동기화 시도
  if (typeof window.syncSchedulesWithSheet === 'function') {
    try {
      console.log('구글 시트에서 일정 데이터 동기화 시도');
      const syncResult = await window.syncSchedulesWithSheet();
      if (syncResult) {
        console.log('구글 시트에서 일정 데이터 동기화 성공');
      } else {
        console.warn('구글 시트에서 일정 데이터 동기화 실패, 로컬 데이터 사용');
      }
    } catch (syncError) {
      console.error('구글 시트 동기화 오류:', syncError);
    }
  } else {
    console.log('구글 시트 동기화 기능이 로드되지 않았습니다.');
  }
  
  try {
    // 0. 로컬 스토리지에서 저장된 기관 정보 가져오기
    let localOrganizations = [];
    try {
      const savedOrgs = localStorage.getItem('all_organizations');
      if (savedOrgs) {
        localOrganizations = JSON.parse(savedOrgs);
        console.log(`로컬 스토리지에서 ${localOrganizations.length}개의 기관 정보를 가져왔습니다.`);
      }
    } catch (storageError) {
      console.error('로컬 스토리지에서 기관 정보 가져오기 실패:', storageError);
    }
    
    // 1. 기관 목록 가져오기
    const response = await fetch('/api/organizations', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.warn(`기관 목록 API 조회 실패: ${response.status}. 로컬 데이터를 사용합니다.`);
      // API 실패 시 로컬 스토리지 데이터 사용
      if (localOrganizations.length > 0) {
        allOrganizations = localOrganizations;
        console.log(`로컬 스토리지에서 가져온 ${allOrganizations.length}개의 기관 정보를 사용합니다.`);
        document.getElementById('total-orgs-count').textContent = allOrganizations.length.toString();
      } else {
        document.getElementById('total-orgs-count').textContent = '55'; // 기본값
      }
    } else {
      const data = await response.json();
      
      if (data.status === 'success') {
        // API에서 가져온 기관 정보
        const mainOrgs = data.organizations.main || [];
        const subOrgs = data.organizations.sub || [];
        const apiOrgs = [];
        
        // 주담당 기관 추가
        mainOrgs.forEach(org => {
          apiOrgs.push({
            ...org,
            role: '주담당'
          });
        });
        
        // 부담당 기관 추가
        subOrgs.forEach(org => {
          apiOrgs.push({
            ...org,
            role: '부담당'
          });
        });
        
        // 로컬 스토리지에서 가져온 기관도 통합
        if (localOrganizations.length > 0) {
          // 로컬 스토리지에만 있는 기관 추가 (중복 방지)
          localOrganizations.forEach(localOrg => {
            const localOrgCode = localOrg.code || localOrg.기관코드;
            const exists = apiOrgs.some(apiOrg => {
              const apiOrgCode = apiOrg.code || apiOrg.기관코드;
              return apiOrgCode === localOrgCode;
            });
            
            if (!exists && localOrgCode) {
              console.log(`로컬 스토리지에서 추가 기관 발견: ${localOrg.name || localOrg.기관명} (${localOrgCode})`);
              apiOrgs.push(localOrg);
            }
          });
        }
        
        // 전체 기관 목록 업데이트
        allOrganizations = apiOrgs;
        
        // 로컬 스토리지 업데이트
        localStorage.setItem('all_organizations', JSON.stringify(allOrganizations));
        console.log(`로컬 스토리지에 총 ${allOrganizations.length}개의 기관 정보 업데이트`);
        
        // 기관 수 표시
        document.getElementById('total-orgs-count').textContent = allOrganizations.length.toString();
      } else {
        console.error('조직 목록 조회 실패:', data.message);
        // 실패해도 로컬 스토리지 데이터 사용
        if (localOrganizations.length > 0) {
          allOrganizations = localOrganizations;
          document.getElementById('total-orgs-count').textContent = allOrganizations.length.toString();
        } else {
          document.getElementById('total-orgs-count').textContent = '55'; // 기본값
        }
      }
    }
      
      // 실제 일정 데이터를 기반으로 완료율 계산
      // 로컬 스토리지에서 일정 데이터 가져오기
      let schedules = [];
      try {
        const savedSchedules = localStorage.getItem('calendar_schedules');
        if (savedSchedules) {
          schedules = JSON.parse(savedSchedules);
          console.log(`[DEBUG] 로컬 스토리지에서 ${schedules.length}개의 일정 가져옴`);
        }
      } catch (e) {
        console.error('로컬 스토리지에서 일정 데이터 가져오기 실패:', e);
      }
      
      // 완료된 일정 수와 완료율 계산
      const completedSchedules = schedules.filter(schedule => schedule.status === 'completed').length;
      const totalSchedules = schedules.length;
      
      // 완료율 계산 (일정이 없으면 0%)
      const completionRate = totalSchedules > 0 ? Math.floor((completedSchedules / totalSchedules) * 100) : 0;
      
      // 대시보드에 표시
      document.getElementById('monitoring-completion-rate').textContent = `${completionRate}%`;
      document.getElementById('monitoring-progress-bar').style.width = `${completionRate}%`;
      
      console.log(`[DEBUG] 완료율 계산: ${completedSchedules}/${totalSchedules} = ${completionRate}%`);
      
      console.log('기관 목록 로드 완료:', allOrganizations.length);
    

    // 2. 위원 목록 - 임시 데이터 사용
    try {
      // 임시 위원 데이터
      const sampleCommittees = [
        { id: 'M001', name: '마스터', role: 'master' },
        { id: 'C001', name: '신용기', role: 'committee' },
        { id: 'C002', name: '문일지', role: 'committee' },
        { id: 'C003', name: '김수연', role: 'committee' },
        { id: 'C004', name: '이연숙', role: 'committee' },
        { id: 'C005', name: '이정혜', role: 'committee' }
      ];
      
      allCommittees = sampleCommittees;
      
      // 위원 수 표시
      const committeesCountElement = document.getElementById('committees-count');
      if (committeesCountElement) {
        committeesCountElement.textContent = allCommittees.length.toString();
      }
      
      console.log('위원 목록 로드 완료:', allCommittees.length);
    } catch (error) {
      console.error('위원 목록 처리 중 오류:', error);
      allCommittees = [];
      
      // 위원 수 기본값 설정
      const committeesCountElement = document.getElementById('committees-count');
      if (committeesCountElement) {
        committeesCountElement.textContent = '5';
      }
    }

    // 3. 매칭 정보 - Google Sheets API에서 가져오기
    try {
      console.log('매칭 정보 새로고침 시작');
      
      // 인증 헤더 생성
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // API를 통해 위원별 담당기관 매칭 데이터 가져오기
      const response = await fetch('/api/committees/matching', { method: 'GET', headers });
      
      if (!response.ok) {
        throw new Error(`매칭 정보 API 오류: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('매칭 정보 API 응답:', result);
      
      // 응답 데이터 검사 - 다양한 구조의 API 응답을 처리
      let matchingData = [];
      
      // 응답이 배열인지 먼저 확인
      if (Array.isArray(result)) {
        console.log('응답이 바로 배열 형태임');
        matchingData = result;
      } else if (result && result.status === 'success') {
        // 성공 응답이며 data 필드가 있을 경우
        if (Array.isArray(result.data)) {
          matchingData = result.data;
          console.log('응답에서 배열 형태의 data 필드 발견');
        } else if (result.data && Array.isArray(result.data.matchings)) {
          matchingData = result.data.matchings;
          console.log('응답에서 data.matchings 배열 필드 발견');
        } else if (result.data) {
          matchingData = result.data;
          console.log('응답에서 data 객체 발견, 객체 자체를 사용');
        }
        
        // 기관 데이터가 없는 경우 매칭 데이터에서 추출
        if (!allOrganizations || allOrganizations.length === 0) {
          const uniqueOrgs = new Map();
          
          // 매칭 데이터에서 기관 정보 추출 - 디버깅 로그 추가
          console.log('매칭 데이터에서 기관 정보 추출 시작:', allMatchings.length, '개의 매칭 데이터');
          console.log('매칭 데이터 첫 번째 항목 예시:', allMatchings[0]);
          
          // 매칭 데이터에서 기관 정보 추출 - 조건 완화
          allMatchings.forEach((match, index) => {
            // 기관 코드가 있으면 추출 시도
            if (match.orgCode) {
              // 기관명이 없으면 기관 코드를 기관명으로 사용
              const orgName = match.orgName || `기관 ${match.orgCode}`;
              const region = match.region || '경상남도'; // region 필드가 없으면 기본값 사용
              
              uniqueOrgs.set(match.orgCode, {
                code: match.orgCode,
                name: orgName,
                region: region
              });
              
              // 처음 10개의 기관 정보만 로그로 출력
              if (index < 10) {
                console.log(`기관 정보 추출 [${index}]: ${match.orgCode} - ${orgName} (${region})`);
              }
            }
          });
          
          allOrganizations = Array.from(uniqueOrgs.values());
          console.log('매칭 데이터에서 추출한 기관 정보:', allOrganizations.length, '개');
          
          // 추출된 기관 정보가 있는지 확인
          if (allOrganizations.length > 0) {
            console.log('추출된 기관 정보 예시:', allOrganizations.slice(0, 3));
          } else {
            console.warn('기관 정보를 추출하지 못했습니다. 매칭 데이터를 확인하세요.');
          }
        }
        
        // 위원 데이터가 없는 경우 매칭 데이터에서 추출
        if (!allCommittees || allCommittees.length === 0) {
          const uniqueCommittees = new Map();
          
          // 매칭 데이터에서 위원 정보 추출
          allMatchings.forEach(match => {
            if (match.committeeId && match.committeeName) {
              uniqueCommittees.set(match.committeeId, {
                id: match.committeeId,
                name: match.committeeName,
                role: 'committee'
              });
            }
          });
          
          allCommittees = Array.from(uniqueCommittees.values());
          console.log('매칭 데이터에서 추출한 위원 정보:', allCommittees.length);
          
          // 위원 수 표시 업데이트
          const committeesCountElement = document.getElementById('committees-count');
          if (committeesCountElement) {
            committeesCountElement.textContent = allCommittees.length.toString();
          }
        }
      } else {
        console.error('매칭 정보 조회 실패: 유효한 배열이 아님');
        
        // 샘플 데이터 대신 실제 데이터만 사용
        allMatchings = [];
        console.log('매칭 데이터가 없습니다. 새로고침을 통해 실제 데이터를 가져오세요.', allMatchings.length);
        // refreshMatchingData 함수 호출을 통해 실제 데이터를 가져오도록 유도
        setTimeout(() => {
          refreshMatchingData();
        }, 1000);
      }
    } catch (error) {
      console.error('매칭 정보 처리 중 오류:', error);
      
      // 오류 발생 시 샘플 데이터 대신 실제 데이터만 사용
      allMatchings = [];
      console.log('오류 발생 시 매칭 데이터가 없습니다. 새로고침을 통해 실제 데이터를 가져오세요.');
      
      // refreshMatchingData 함수 호출을 통해 실제 데이터를 가져오도록 유도
      setTimeout(() => {
        refreshMatchingData();
      }, 1000);
    }

    // 지역별 기관 분류 및 출력 시도
    try {
      showOrganizationsByRegion();
    } catch (error) {
      console.error('지역별 기관 분류 처리 중 오류:', error);
    }

    // 4. 모니터링 결과 데이터 - 임시 데이터 사용
    try {
      console.log('모니터링 결과 데이터 처리 시작');
      
      // 임시 데이터 생성
      const monitoringResultsData = {
        status: 'success',
        data: {
          results: {
            total: 25,
            completed: 10,
            rate: 40
          }
        }
      };
      
      // 모니터링 결과 처리
      console.log('결과 데이터 처리 완료');
      
      // 임시 데이터를 사용하여 처리
      if (monitoringResultsData.status === 'success' && monitoringResultsData.data && monitoringResultsData.data.results) {
        // 전역 변수에 모니터링 결과 저장 (기관별 진행률 계산에 사용)
        window.monitoringResults = monitoringResultsData.data.results;
        
        // 임시 완료 데이터 사용
        const completedCount = monitoringResultsData.data.results.completed || 10;
        const totalCount = monitoringResultsData.data.results.total || 25;
        const resultRate = monitoringResultsData.data.results.rate || 40;
        
        // 총 수행해야 할 지표 수 (기관 수 x 지표 수)
        const totalIndicatorsPerOrg = 63; // 각 기관당 지표 수
        const totalOrgs = allOrganizations.length || 51; // 전체 기관 수
        const totalTasks = totalOrgs * totalIndicatorsPerOrg;
        
        // 완료율 계산 - 임시 데이터 사용
        const completionRate = resultRate;
        
        console.log(`전체 완료율 계산: ${completedCount}/${totalCount} = ${completionRate}%`);
        
        // UI 업데이트 - 진행률 표시 및 프로그레스 바
        document.getElementById('monitoring-completion-rate').textContent = `${completionRate}%`;
        
        // 프로그레스 바가 있으면 업데이트
        const progressBar = document.getElementById('monitoring-progress-bar');
        if (progressBar) {
          progressBar.style.width = `${completionRate}%`;
        }
      } else {
        // 데이터가 없거나 오류가 발생한 경우
        console.warn('유효한 결과 데이터를 받지 못함');
        document.getElementById('monitoring-completion-rate').textContent = '0%';
        window.monitoringResults = [];
      }
    } catch (error) {
      console.error('완료율 계산 중 오류:', error);
      document.getElementById('monitoring-completion-rate').textContent = '0%';
      window.monitoringResults = [];
    }
    
    console.log('마스터 대시보드 데이터 로드 완료');
    
    // 데이터 로드 완료 후, 담당자별 기관방문일정 뷰 초기화
    // 함수가 없는 경우를 대비해 재시도 로직 추가
    let retryCount = 0;
    const maxRetries = 5;
    
    const initScheduleView = () => {
      // 일정 뷰 초기화 상태 확인
      const scheduleContainer = document.getElementById('committee-schedules-container');
      
      // 이전에 초기화된 일정 뷰가 있더라도 일정 데이터를 다시 로드하기 위해 클래스 제거
      if (scheduleContainer && scheduleContainer.classList.contains('initialized')) {
        console.log('[DEBUG] 담당자별 기관방문일정 뷰가 이미 초기화되어 있지만 데이터를 다시 로드합니다.');
        scheduleContainer.classList.remove('initialized');
        
        // 저장된 일정이 있는지 확인
        if (typeof window.loadCommitteeSchedules === 'function') {
          console.log('[DEBUG] 일정 데이터 강제 재로드');
          window.loadCommitteeSchedules();
          scheduleContainer.classList.add('initialized');
          return;
        }
      }
      
      console.log(`[DEBUG] initScheduleView 호출 (시도 ${retryCount + 1}/${maxRetries + 1})`);
      
      if (typeof window.initializeCommitteeSchedulesView === 'function') {
        console.log('[DEBUG] 마스터 대시보드 데이터 로드 완료: 담당자별 기관방문일정 뷰 초기화 시작');
        try {
          // 기존 데이터 초기화
          if (window.allCommitteeSchedules) {
            window.allCommitteeSchedules = [];
          }
          if (window.schedulesLoaded) {
            window.schedulesLoaded = false;
          }
          
          window.initializeCommitteeSchedulesView();
          console.log('[DEBUG] 담당자별 기관방문일정 뷰 초기화 성공');
          
          // 초기화 완료 표시
          if (scheduleContainer) {
            scheduleContainer.classList.add('initialized');
          }
        } catch (e) {
          console.error('[DEBUG] 담당자별 기관방문일정 뷰 초기화 중 오류:', e);
        }
      } else {
        retryCount++;
        console.log(`[DEBUG] 함수 확인: window.initializeCommitteeSchedulesView = ${typeof window.initializeCommitteeSchedulesView}`);
        
        if (retryCount <= maxRetries) {
          console.log(`[DEBUG] 담당자별 기관방문일정 초기화 함수가 아직 로드되지 않았습니다. 재시도 중... (${retryCount}/${maxRetries})`);
          // 지수 백오프로 대기 시간 증가 (500ms, 1000ms, 2000ms, 4000ms, 8000ms)
          const delay = Math.min(500 * Math.pow(2, retryCount - 1), 8000);
          console.log(`[DEBUG] ${delay}ms 후 재시도 예정`);
          setTimeout(initScheduleView, delay);
        } else {
          console.error('[DEBUG] 담당자별 기관방문일정 초기화 함수를 찾을 수 없습니다. 최대 재시도 횟수 초과.');
        }
      }
    };
    
    // 초기화 함수 호출 시작
    console.log('[DEBUG] 일정 초기화 함수 호출 시작 (loadMasterDashboardData)');
    initScheduleView();
    
    // 데이터 로드 완료 상태 설정
    masterDataLoaded = true;
    isLoadingMasterData = false;
  } catch (error) {
    // 오류 정보 상세히 기록
    console.error('대시보드 데이터 로드 중 오류:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // 사용자에게는 간단한 오류 메시지만 표시
    // alert(`데이터 로드 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
    
    // 기본값 설정
    document.getElementById('committees-count').textContent = '0';
    document.getElementById('total-orgs-count').textContent = '51';
    document.getElementById('monitoring-completion-rate').textContent = '0%';
    allCommittees = [];
    allOrganizations = [];
    window.monitoringResults = [];
    
    // 오류 발생 시에도 로드 상태 초기화
    isLoadingMasterData = false;
  }
};

// 매칭 정보 새로고침
window.refreshMatchingData = async () => {
  // 이미 새로고침 중인 경우 중복 호출 방지
  if (isRefreshingMatchings) {
    console.log('매칭 정보가 이미 새로고침 중입니다.');
    return;
  }
  
  try {
    console.log('매칭 정보 새로고침 시작 - ' + new Date().toISOString());
    
    // 새로고침 상태 설정
    isRefreshingMatchings = true;
    
    // API 호출 실패 시에도 실제 데이터만 사용하도록 수정
    window.defaultMatchings = [];
    console.log('기본 매칭 데이터를 빈 배열로 초기화했습니다.');
    
    console.log('매칭 정보 새로고침 시작');
    
    // API 호출 전 로딩 표시
    const tableBody = document.getElementById('matching-table-body');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="px-6 py-4 text-center text-gray-500">
            <div class="flex justify-center items-center space-x-2">
              <svg class="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>매칭 정보를 불러오는 중...</span>
            </div>
          </td>
        </tr>
      `;
    }
    
    // 오류 발생 가능성이 높은 API 호출 구간에 더 자세한 로그 추가
    console.log('1. API 호출 준비 - 인증 헤더 가져오기');
    let headers = {};
    try {
      if (typeof getAuthHeaders === 'function') {
        headers = getAuthHeaders();
      } else {
        console.log('getAuthHeaders 함수가 정의되지 않았습니다. 기본 헤더를 사용합니다.');
        headers = { 'Content-Type': 'application/json' };
      }
    } catch (e) {
      console.error('인증 헤더 가져오기 실패:', e);
      headers = { 'Content-Type': 'application/json' };
    }
    console.log('인증 헤더:', headers ? '설정됨' : '없음');
    
    // 기존 매칭 데이터 보존 (API 호출 실패 시 대비) - 더미 데이터 대신 실제 데이터만 사용
    const existingMatchings = allMatchings.length > 0 ? [...allMatchings] : [];
    console.log(`기존 매칭 데이터 백업: ${existingMatchings.length}개 항목`);
    
    let matchingData = {
      status: 'success',
      data: {
        matchings: existingMatchings 
      }
    };
    
    // Google Sheets API에서 매칭 데이터 가져오기 시도
    console.log('2. API로 매칭 정보 가져오기 시작');
      
    // API 요청 옵션 설정
    const requestOptions = {
      credentials: 'include', // 세션 쿠키 포함
      headers: headers
    };
    console.log('API 요청 옵션:', requestOptions);
    
    try {
      const committeeMatchingsResponse = await fetch('/api/committees/matching');
      
      if (!committeeMatchingsResponse.ok) {
        throw new Error(`API 응답 오류: ${committeeMatchingsResponse.status}`);
      }
      
      const committeeMatchingsData = await committeeMatchingsResponse.json();
      console.log('3. Google Sheets API 응답 수신:', committeeMatchingsData);
      
      if (committeeMatchingsData) {
        // API 응답 형식 확인 및 처리
        if (Array.isArray(committeeMatchingsData)) {
          // 배열 형태로 직접 반환된 경우
          matchingData = {
            status: 'success',
            data: {
              matchings: committeeMatchingsData
            }
          };
          console.log('매칭 정보 API 호출 성공 (배열 형식):', matchingData.data.matchings.length);
        } else if (committeeMatchingsData.matchings && Array.isArray(committeeMatchingsData.matchings)) {
          // { matchings: [...] } 형태로 반환된 경우
          matchingData = {
            status: 'success',
            data: {
              matchings: committeeMatchingsData.matchings
            }
          };
          console.log('매칭 정보 API 호출 성공 (객체 형식):', matchingData.data.matchings.length);
        } else if (committeeMatchingsData.data && committeeMatchingsData.data.matchings) {
          // { data: { matchings: [...] } } 형태로 반환된 경우
          matchingData = committeeMatchingsData;
          console.log('매칭 정보 API 호출 성공 (중첩 객체 형식):', matchingData.data.matchings.length);
        } else {
          console.error('매칭 정보 조회 실패: 예상치 못한 응답 형식', committeeMatchingsData);
          showMessage('매칭 정보를 불러오는데 실패했습니다. 기존 데이터를 사용합니다.', 'warning');
        }
      } else {
        console.error('매칭 정보 조회 실패: 유효한 배열이 아님');
        showMessage('매칭 정보를 불러오는데 실패했습니다. 기존 데이터를 사용합니다.', 'warning');
      }
    } catch (apiError) {
      console.error('Google Sheets API 호출 중 오류:', apiError);
      showMessage(`매칭 정보를 불러오는데 실패했습니다: ${apiError.message}`, 'warning');
      // 매칭 데이터 유효성 확인 - 더미 데이터 참조 제거
      if (!matchingData.data || !matchingData.data.matchings || !Array.isArray(matchingData.data.matchings)) {
        console.warn('매칭 데이터가 유효하지 않음. 기존 실제 데이터 사용');
        matchingData.data = { matchings: existingMatchings.length > 0 ? existingMatchings : [] };
      }
    }
    
    // 성공하든 실패하든 여기서 데이터 처리
    const rawMatchings = matchingData.data.matchings || [];
    
    // 매칭 데이터가 비어있으면 비어있는 그대로 사용
    if (rawMatchings.length === 0) {
      console.log('매칭 데이터가 비어있습니다.');
      // 더미 데이터를 사용하지 않고 비어있는 그대로 유지
    }
    
    // 받은 데이터 필드명 표준화 처리
    allMatchings = rawMatchings.map(matching => {
      // 필드명 표준화
      return {
        committeeId: matching.committeeId || matching.위원ID || matching.committee_id || '',
        committeeName: matching.committeeName || matching.위원명 || matching.committee_name || '',
        orgCode: matching.orgCode || matching.organizationCode || matching.기관코드 || '',
        orgName: matching.orgName || matching.organizationName || matching.기관명 || '',
        role: matching.role || matching.담당유형 || '',
        region: matching.region || matching.지역 || '',
        checkType: matching.checkType || matching.점검유형 || '전체'
      };
    });
    
    console.log('매칭 정보 처리 완료:', allMatchings.length);
    console.log('매칭 정보 샘플:', allMatchings.length > 0 ? allMatchings[0] : '없음');
    
    // 매칭 데이터 기반으로 테이블 업데이트
    updateMatchingTable();
    
    // 새로고침 상태 초기화
    isRefreshingMatchings = false;
    
    return true;
  } catch (error) {
    console.error('매칭 정보 새로고침 중 오류:', error);
    
    // 오류가 발생해도 UI는 유지하기 위해 현재 데이터로 테이블 업데이트
    updateMatchingTable();
    
    // 새로고침 상태 초기화
    isRefreshingMatchings = false;
    
    // 오류 경고 표시
    showMessage(`매칭 정보를 새로고침하는 중 오류가 발생했습니다: ${error.message}`, 'error');
    return false;
  }
}

// 매칭 테이블 업데이트
window.updateMatchingTable = () => {
  console.log('매칭 테이블 업데이트 시작 - ' + new Date().toISOString());
  
  // 로컬 스토리지에서 기관 정보 확인
  try {
    const savedOrgs = localStorage.getItem('all_organizations');
    if (savedOrgs && (!allOrganizations || allOrganizations.length === 0)) {
      allOrganizations = JSON.parse(savedOrgs);
      console.log(`로컬 스토리지에서 ${allOrganizations.length}개의 기관 정보를 가져왔습니다.`);
    }
  } catch (storageError) {
    console.error('로컬 스토리지에서 기관 정보 가져오기 실패:', storageError);
  }
  
  // 디버깅용 로그 추가
  console.log('매칭 데이터 현황:', {
    allMatchings: allMatchings?.length || 0,
    allOrganizations: allOrganizations?.length || 0,
    allCommittees: allCommittees?.length || 0
  });
  
  const tableBody = document.getElementById('matching-table-body');
  if (!tableBody) {
    console.error('매칭 테이블 본문을 찾을 수 없습니다');
    return;
  }
  
  // 매칭 데이터에서 기관 정보 추출 - 항상 실행
  console.log('매칭 데이터에서 기관 정보 새로 추출 시작...');
  
  // 매칭 데이터에서 기관 정보 추출 시도
  if (allMatchings && allMatchings.length > 0) {
    console.log('매칭 데이터에서 기관 정보 추출 시도:', allMatchings.length, '개의 매칭 데이터 처리');
    
    const uniqueOrgs = new Map();
    
    // 매칭 데이터에서 기관 정보 추출 - 모든 기관 추출
    allMatchings.forEach((match, index) => {
      // 다양한 필드명 확인
      const orgCode = match.orgCode || match.organizationCode || match.기관코드 || '';
      const orgName = match.orgName || match.organizationName || match.기관명 || `기관 ${orgCode}`;
      const region = match.region || match.지역 || '경상남도';
      
      // 기관 코드가 있는 경우에만 추가하던 조건을 완화
      // 기관명만 있는 경우도 추출
      const key = orgCode || `name_${orgName}`;
      if (key) {
        uniqueOrgs.set(key, {
          code: orgCode,
          orgCode: orgCode, // 추가 필드
          name: orgName,
          region: region
        });
      }
    });
    
    // 이전 기관 데이터가 있는 경우 보존
    if (allOrganizations && allOrganizations.length > 0) {
      console.log('기존 기관 데이터 보존:', allOrganizations.length, '개');
      
      // 기존 기관 데이터도 통합
      allOrganizations.forEach(org => {
        const orgCode = org.code || org.orgCode || org.기관코드 || org.organizationCode || '';
        const key = orgCode || `name_${org.name}`;
        
        if (key && !uniqueOrgs.has(key)) {
          uniqueOrgs.set(key, org);
        }
      });
    }
    
    // 더미 데이터 추가 코드 제거 (2025-05-26)
    
    // 새로 추출한 기관 정보로 업데이트
    allOrganizations = Array.from(uniqueOrgs.values());
    console.log('매칭 데이터에서 추출한 기관 정보:', allOrganizations.length, '개');
    
    if (allOrganizations.length > 0) {
      console.log('추출된 기관 정보 예시:', allOrganizations.slice(0, 3));
      
      // 로컬 스토리지에 저장
      try {
        localStorage.setItem('all_organizations', JSON.stringify(allOrganizations));
      } catch (e) {
        console.warn('기관 정보 저장 중 오류:', e);
      }
    }
  } else {
    // 매칭 데이터가 없는 경우 비어있는 배열 사용
    console.log('매칭 데이터가 없습니다.');
    
    // 비어있는 배열 사용 (샘플 데이터 사용하지 않음)
    if (!allOrganizations || allOrganizations.length === 0) {
      allOrganizations = [];
    }
  }
  
  // 필터 값 가져오기 및 필터링된 기관 목록 생성
  const filterValue = document.getElementById('org-filter')?.value?.trim() || '';
  console.log('Applying org filter:', filterValue, 'with total matchings:', allMatchings.length);
  
  // 필터링 로직 개선 - 모든 기관이 표시되도록 수정
  const filteredOrgs = allOrganizations.filter(org => {
    // 조직 코드 키 대응 - 더 많은 필드 확인
    const orgCodeVal = org.code || org.orgCode || org.기관코드 || org.organizationCode || '';
    
    // 기관 코드 확인 - 코드가 없어도 기관명이 있으면 표시
    if (!orgCodeVal) {
      // 기관 코드가 없는 경우에도 표시하도록 수정
      // 기관 ID나 이름이 있는 경우에는 표시
      return org.id || org.name;
    }
    
    // 매칭 정보 확인 - 필드명 및 대소문자/공백 등 다양성 처리
    const hasMain = allMatchings.some(m => {
      const matchCode = m.orgCode || m.organizationCode || m.기관코드 || '';
      const matchRole = (m.role || m.담당유형 || '').toString().trim().toLowerCase();
      return matchCode === orgCodeVal && (matchRole === '주담당' || matchRole === 'main');
    });
    
    const hasSub = allMatchings.some(m => {
      const matchCode = m.orgCode || m.organizationCode || m.기관코드 || '';
      const matchRole = (m.role || m.담당유형 || '').toString().trim().toLowerCase();
      return matchCode === orgCodeVal && (matchRole === '부담당' || matchRole === 'sub');
    });
    
    // 필터 로직 수정 - 필터가 없으면 모든 기관 표시
    if (filterValue === '') {
      return true; // 필터가 없으면 모든 기관 표시
    }
    
    // 필터 로직 수정 - 필터에 따라 적절히 표시
    if (filterValue === 'main') {
      return hasMain; // 주담당이 있는 기관만 표시
    }
    if (filterValue === 'sub') {
      return hasSub; // 부담당이 있는 기관만 표시
    }
    if (filterValue === 'none') {
      return !hasMain && !hasSub; // 담당자가 없는 기관만 표시
    }
    
    return true; // 기본적으로 모든 기관 표시
  });
  
  // 기관이 없는 경우
  if (filteredOrgs.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500">
          표시할 기관이 없습니다.
        </td>
      </tr>
    `;
    return;
  }
  
  // 시군별로 그룹화
  const regionGroups = {};
  
  filteredOrgs.forEach(org => {
    let region = org.region || org.지역 || '미분류';
    if (region.startsWith('창원시')) region = '창원시';
    
    // 기타지역 및 특정 지역 제외 (2025-05-26 요청사항)
    const excludedRegions = ['기타', '기타지역', '광주', '대구', '부산', '서울', '인천'];
    if (excludedRegions.includes(region)) {
      return; // 제외된 지역은 건너뛰기
    }
    
    if (!regionGroups[region]) {
      regionGroups[region] = [];
    }
    regionGroups[region].push(org);
  });
  
  // 테이블 내용 생성
  let tableContent = '';
  
  // 시군 그룹별로 정렬하여 출력
  Object.keys(regionGroups).sort().forEach(region => {
    // 지역 헤더 행 추가 - 더 시각적으로 명확하게 개선
    tableContent += `
      <tr>
        <td colspan="7" class="bg-blue-100 px-6 py-3 text-left">
          <div class="flex items-center">
            <span class="font-bold text-blue-800 text-md">${region}</span>
            <span class="ml-2 bg-blue-200 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
              ${regionGroups[region].length}개 기관
            </span>
          </div>
        </td>
      </tr>
    `;
    
    // 해당 지역의 기관 목록
    regionGroups[region].sort((a, b) => {
      const nameA = a.name || a.기관명 || '';
      const nameB = b.name || b.기관명 || '';
      return nameA.localeCompare(nameB);
    }).forEach(org => {
      // 해당 기관의 매칭 정보 찾기
      // 기관 코드 필드명 다양성 대응
      const orgCodeForMatching = org.code || org.기관코드 || org.orgCode || org.organizationCode || '';
      
      // 다양한 매칭 필드명 대응 및 대소문자, 공백 처리
      const mainMatchings = allMatchings.filter(m => {
        const matchCode = m.orgCode || m.organizationCode || m.기관코드 || '';
        const matchRole = (m.role || m.담당유형 || '').toString().trim().toLowerCase();
        return matchCode === orgCodeForMatching && (matchRole === '주담당' || matchRole === 'main');
      });

      const subMatchings = allMatchings.filter(m => {
        const matchCode = m.orgCode || m.organizationCode || m.기관코드 || '';
        const matchRole = (m.role || m.담당유형 || '').toString().trim().toLowerCase();
        return matchCode === orgCodeForMatching && (matchRole === '부담당' || matchRole === 'sub');
      });
      
      // 주담당, 부담당 위원 정보
      const mainCommitteeName = mainMatchings.length > 0 ? 
        (mainMatchings[0].committeeName || mainMatchings[0].위원명 || mainMatchings[0].name || '') : '-';
      const subCommitteeNames = subMatchings.map(m => 
        m.committeeName || m.위원명 || m.name || '').filter(Boolean).join(', ') || '-';
      
      // 진행률 계산 (실제 데이터 사용)
      const orgCodeForProgress = org.code || org.orgCode || org.기관코드 || org.organizationCode || '';
      const progressRate = calculateOrgProgress(orgCodeForProgress);
      
      // 진행률에 따른 색상 설정
      let progressColorClass = 'bg-blue-600';
      if (progressRate >= 75) {
        progressColorClass = 'bg-green-600';
      } else if (progressRate >= 50) {
        progressColorClass = 'bg-blue-600';
      } else if (progressRate >= 25) {
        progressColorClass = 'bg-yellow-500';
      } else {
        progressColorClass = 'bg-red-500';
      }
      
      // 특별 기관 여부 확인
      const orgName = org.name || org.기관명 || '';
      const isSpecial = isSpecialOrganization(orgName);
      
      // 특별 기관인 경우 배경색 변경
      const rowClass = isSpecial ? 'hover:bg-yellow-50 bg-yellow-100' : 'hover:bg-gray-50';
      
      tableContent += `
        <tr class="${rowClass}">
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-medium ${isSpecial ? 'text-yellow-800' : 'text-gray-900'}">${orgName}</div>
            ${isSpecial ? '<span class="inline-block px-2 py-1 text-xs bg-yellow-200 text-yellow-800 rounded-full">특별 기관</span>' : ''}
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm text-gray-500">${org.code || org.orgCode || org.기관코드 || org.organizationCode || ''}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm ${mainCommitteeName === '-' ? 'text-red-500' : 'text-gray-900'}">${mainCommitteeName}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm ${subCommitteeNames === '-' ? 'text-yellow-500' : 'text-gray-900'}">${subCommitteeNames}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="w-full bg-gray-200 rounded-full h-2.5">
              <div class="${progressColorClass} h-2.5 rounded-full" style="width: ${progressRate}%"></div>
            </div>
            <div class="text-xs text-gray-500 mt-1 text-right">${progressRate}%</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">${region}</span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <div class="flex justify-end space-x-2">
              <button class="text-indigo-600 hover:text-indigo-900 hover:underline edit-match-btn" 
                      data-org-code="${org.code || org.기관코드}" data-org-name="${org.name || org.기관명}">
                담당자 변경
              </button>
              <button class="text-red-600 hover:text-red-900 hover:underline delete-org-btn"
                      data-org-code="${org.code || org.기관코드}" data-org-name="${org.name || org.기관명}">
                삭제
              </button>
            </div>
          </td>
        </tr>
      `;
    });
  });
  
  // 테이블 업데이트
  tableBody.innerHTML = tableContent;
  
  // 담당자 변경 버튼에 이벤트 리스너 등록
  document.querySelectorAll('.edit-match-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const orgCode = e.target.dataset.orgCode;
      const orgName = e.target.dataset.orgName;
      console.log('담당자 변경 버튼 클릭:', orgCode, orgName);
      saveOrgMatching(orgCode);
    });
  });

  // 기관 삭제 버튼에 이벤트 리스너 등록
  document.querySelectorAll('.delete-org-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const orgCode = e.target.dataset.orgCode;
      const orgName = e.target.dataset.orgName;
      console.log('기관 삭제 버튼 클릭:', orgCode, orgName);
      deleteOrganization(orgCode, orgName);
    });
  });
  
  console.log('매칭 테이블 업데이트 완료');
};

// 기관별 진행률 계산 함수
const calculateOrgProgress = (orgCode) => {
  // 기관 코드가 undefined인 경우 처리
  if (!orgCode) {
    // 기관 코드가 없을 경우 처리
    return 0;
  }
  try {
    // 모니터링 결과 데이터가 없는 경우
    if (!window.monitoringResults || !Array.isArray(window.monitoringResults)) {
      console.log(`기관(${orgCode}) 진행률 계산: 모니터링 결과 데이터 없음, 0% 반환`);
      return 0;
    }
    
    // 총 지표 수 (기관당 63개 지표)
    const totalIndicatorsPerOrg = 63;
    
    // 해당 기관의 결과 개수 계산
    const orgResults = window.monitoringResults.filter(result => {
      // 기관코드 필드가 다양한 이름으로 존재할 수 있음
      const resultOrgCode = result.기관코드 || result.orgCode || '';
      return resultOrgCode === orgCode;
    });
    
    // 중복 지표 제거 (같은 지표 여러 번 평가된 경우 한 번만 카운트)
    const uniqueIndicators = new Set();
    orgResults.forEach(result => {
      const indicatorId = result.지표ID || result.indicatorId || '';
      if (indicatorId) {
        uniqueIndicators.add(indicatorId);
      }
    });
    
    // 진행률 계산
    const completedCount = uniqueIndicators.size;
    const progressRate = totalIndicatorsPerOrg > 0 
      ? Math.round((completedCount / totalIndicatorsPerOrg) * 100) 
      : 0;
    
    console.log(`기관(${orgCode}) 진행률 계산: ${completedCount}/${totalIndicatorsPerOrg} = ${progressRate}%`);
    return progressRate;
  } catch (error) {
    console.error(`기관(${orgCode}) 진행률 계산 중 오류:`, error);
    return 0;
  }
};

// 필터링 적용
const filterOrganizations = () => {
  const filter = document.getElementById('org-filter').value;
  updateMatchingTable(filter);
};

// 기관 매칭 저장
const saveOrgMatching = async (orgCode) => {
  try {
    console.log('saveOrgMatching 시작:', orgCode);
    // 기관 찾기
    const organization = allOrganizations.find(org => {
      const code = org.code || org.기관코드 || org.orgCode || '';
      return code === orgCode;
    });
    
    if (!organization) {
      alert(`기관 코드 ${orgCode}에 해당하는 기관을 찾을 수 없습니다.`);
      return;
    }

    console.log('매칭 설정할 기관:', organization);
    
    // 다양한 필드명에 대응
    const orgName = organization.name || organization.기관명 || organization.orgName || '';
    const orgRegion = organization.region || organization.지역 || '';
    const orgNote = organization.note || '';
    
    // 현재 매칭 정보 가져오기
    const mainCommittees = allMatchings.filter(m => m.orgCode === orgCode && m.role === '주담당');
    const subCommittees = allMatchings.filter(m => m.orgCode === orgCode && m.role === '부담당');
    
    console.log('현재 주담당:', mainCommittees);
    console.log('현재 부담당:', subCommittees);
    
    // 모달 내용 구성
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 flex items-center justify-center z-50';
    modal.id = 'matching-modal';
    modal.innerHTML = `
      <div class="absolute inset-0 bg-black opacity-50"></div>
      <div class="bg-white rounded-lg p-6 relative z-10 w-full max-w-md">
        <h2 class="text-xl font-bold mb-4">담당자 설정 - ${orgName}</h2>
        
        <!-- 현재 배정된 담당자 표시 -->
        ${mainCommittees.length > 0 ? `<div class="mb-1 text-blue-700 text-sm">현재 주담당: ${mainCommittees.map(m => m.committeeName || m.name || m.이름).join(', ')}</div>` : ''}
        ${subCommittees.length > 0 ? `<div class="mb-1 text-green-700 text-sm">현재 부담당: ${subCommittees.map(m => m.committeeName || m.name || m.이름).join(', ')}</div>` : ''}
        <div class="mb-2">
          <p class="text-sm text-gray-500">지역: ${orgRegion}</p>
          <p class="text-sm text-gray-500">코드: ${orgCode}</p>
          ${orgNote ? `<p class="text-sm text-gray-500 mb-3">비고: ${orgNote}</p>` : ''}
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">주담당</label>
          <select id="main-committee-select" class="border rounded w-full px-3 py-2">
            <option value="">선택하세요</option>
            ${allCommittees.map(committee => {
              const committeeName = committee.이름 || committee.name || '';
              const committeeId = committee.ID || committee.id || '';
              const isSelected = mainCommittees.length > 0 && mainCommittees[0].committeeId === committeeId;
              return `
                <option value="${committeeId}" ${isSelected ? 'selected' : ''}>
                  ${committeeName} (${committeeId})
                </option>
              `;
            }).join('')}
          </select>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">부담당 (선택사항, 복수 선택 가능)</label>
          <select id="sub-committees-select" class="border rounded w-full px-3 py-2" multiple size="5">
            ${allCommittees.map(committee => {
              const committeeName = committee.이름 || committee.name || '';
              const committeeId = committee.ID || committee.id || '';
              const isSelected = subCommittees.some(sub => sub && sub.committeeId === committeeId);
              return `
                <option value="${committeeId}" ${isSelected ? 'selected' : ''}>
                  ${committeeName} (${committeeId})
                </option>
              `;
            }).join('')}
          </select>
          <p class="text-xs text-gray-500 mt-1">Ctrl 또는 Shift를 누른 채 클릭하여 여러 명 선택 가능 (선택하지 않아도 됩니다)</p>
        </div>
        
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-1">점검 유형</label>
          <div class="flex space-x-4 mt-1">
            <label class="inline-flex items-center">
              <input type="radio" name="check-type" value="전체" class="form-radio" checked>
              <span class="ml-2">전체</span>
            </label>
            <label class="inline-flex items-center">
              <input type="radio" name="check-type" value="매월" class="form-radio">
              <span class="ml-2">매월</span>
            </label>
            <label class="inline-flex items-center">
              <input type="radio" name="check-type" value="반기" class="form-radio">
              <span class="ml-2">반기</span>
            </label>
          </div>
        </div>
        
        <div class="flex justify-end space-x-3">
          <button id="cancel-matching-btn" class="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100 transition">
            취소
          </button>
          <button id="save-matching-confirm-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
            저장
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 이벤트 리스너 등록
    document.getElementById('cancel-matching-btn').addEventListener('click', () => closeModal('matching-modal'));
    document.getElementById('save-matching-confirm-btn').addEventListener('click', async () => {
      try {
        // 선택된 위원 정보 가져오기
        const mainCommitteeId = document.getElementById('main-committee-select').value;
        const subCommitteeSelect = document.getElementById('sub-committees-select');
        const subCommitteeIds = Array.from(subCommitteeSelect.selectedOptions).map(option => option.value);
        
        // 점검 유형 가져오기
        const checkType = document.querySelector('input[name="check-type"]:checked').value;
        
        // 매칭 데이터 생성
        const newMatchings = [];
        
        // 주담당 추가
        if (mainCommitteeId) {
          const mainCommittee = allCommittees.find(c => (c.ID || c.id) === mainCommitteeId);
          if (mainCommittee) {
            const committeeName = mainCommittee.이름 || mainCommittee.name || '';
            newMatchings.push({
              committeeId: mainCommitteeId,
              committeeName: committeeName,
              orgCode: orgCode,
              orgName: orgName,
              region: orgRegion,
              role: '주담당',
              checkType: checkType
            });
          }
        }
        
        // 부담당 추가 (선택적)
        // 부담당이 있는 경우에만 추가
        if (subCommitteeIds && subCommitteeIds.length > 0) {
          for (const subId of subCommitteeIds) {
            const subCommittee = allCommittees.find(c => (c.ID || c.id) === subId);
            if (subCommittee) {
              const committeeName = subCommittee.이름 || subCommittee.name || '';
              newMatchings.push({
                committeeId: subId,
                committeeName: committeeName,
                orgCode: orgCode,
                orgName: orgName,
                region: orgRegion,
                role: '부담당',
                checkType: checkType
              });
            }
          }
        } else {
          console.log('부담당이 선택되지 않았습니다.');
        }
        
        // 기존 매칭에서 현재 기관 매칭 제외
        const otherMatchings = allMatchings.filter(m => m.orgCode !== orgCode);
        
        // 새로운 매칭 데이터 생성
        const updatedMatchings = [...otherMatchings, ...newMatchings];
        
        // API 호출하여 저장
        const response = await fetch('/api/committees/matching', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ matchings: updatedMatchings })
        });
        
        if (!response.ok) {
          throw new Error('매칭 정보 저장에 실패했습니다.');
        }
        
        // 성공 처리
        closeModal('matching-modal');
        alert('담당자 매칭이 성공적으로 저장되었습니다.');
        
        // 매칭 정보 새로고침
        await refreshMatchingData();
        
      } catch (error) {
        console.error('매칭 저장 중 오류:', error);
        alert(`매칭 저장 중 오류가 발생했습니다: ${error.message}`);
      }
    });
  } catch (error) {
    console.error('담당자 설정 모달 표시 중 오류:', error);
    alert('담당자 설정 중 오류가 발생했습니다.');
  }
};

// 매칭 추가 모달 표시
const showAddMatchingModal = async () => {
  // 위원 목록이 비어 있으면 새로 불러오기
  if (!allCommittees || allCommittees.length === 0) {
    const committeesResponse = await committeeApi.getAllCommittees();
    if (committeesResponse.status === 'success') {
      allCommittees = committeesResponse.data.committees || [];
    } else {
      showMessage('위원 목록을 불러오지 못했습니다.', 'error');
      return;
    }
  }
  // 위원 데이터 구조 확인용 로그
  console.log('allCommittees:', allCommittees);
  if (allCommittees.length > 0) console.log('Sample committee:', allCommittees[0]);
  // 위원 목록이 비어 있으면 새로 불러오기
  if (!allCommittees || allCommittees.length === 0) {
    const committeesResponse = await committeeApi.getAllCommittees();
    if (committeesResponse.status === 'success') {
      allCommittees = committeesResponse.data.committees || [];
    } else {
      showMessage('위원 목록을 불러오지 못했습니다.', 'error');
      return;
    }
  }
  // 모달 생성 또는 가져오기
  let modal = document.getElementById('add-matching-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'add-matching-modal';
    modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg">
        <h3 class="text-lg font-medium mb-4">담당자 매칭 추가</h3>
        <form id="add-matching-form" autocomplete="off">
          <div class="mb-4">
            <label for="org-select" class="block mb-1 font-medium">기관 선택</label>
            <select id="org-select" class="border rounded px-3 py-2 w-full">
              <option value="">기관을 선택하세요</option>
              ${allOrganizations.map(org => `<option value="${org.code || org.기관코드}">${org.name || org.기관명} (${org.code || org.기관코드})</option>`).join('')}
            </select>
          </div>
          <div class="mb-4">
            <label for="committee-select" class="block mb-1 font-medium">담당자(위원) 선택</label>
            <select id="committee-select" class="border rounded px-3 py-2 w-full">
              <option value="">담당자를 선택하세요</option>
              ${allCommittees.map(c => {
                // 위원 ID 필드명 다양성 처리
                const committeeId = c.id || c.ID || c.committeeId || '';
                // 위원 이름 필드명 다양성 처리
                const committeeName = c.name || c.이름 || c.committeeName || '';
                return `<option value="${committeeId}">${committeeName} (${committeeId})</option>`;
              }).join('')}
            </select>
          </div>
          <div class="mb-4">
            <label class="block mb-1 font-medium">역할 선택</label>
            <div class="flex space-x-4">
              <label><input type="radio" name="role" value="주담당" checked> 주담당</label>
              <label><input type="radio" name="role" value="부담당"> 부담당</label>
            </div>
          </div>
          <div class="flex justify-end space-x-2 mt-6">
            <button type="button" id="cancel-matching-btn" class="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500">취소</button>
            <button type="submit" id="save-matching-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">저장</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  }
  modal.classList.remove('hidden');

  // 이벤트 리스너 등록
  document.getElementById('cancel-matching-btn').onclick = () => closeModal('add-matching-modal');
  document.getElementById('add-matching-form').onsubmit = async (e) => {
    e.preventDefault();
    const orgCode = document.getElementById('org-select').value;
    const committeeId = document.getElementById('committee-select').value;
    const role = document.querySelector('input[name="role"]:checked').value;
    if (!orgCode || !committeeId || !role) {
      showMessage('기관, 담당자, 역할을 모두 선택하세요.', 'warning');
      return;
    }
    try {
      // 선택된 위원 및 기관 정보 확인
      const committee = allCommittees.find(c => (c.ID || c.id) === committeeId);
      const organization = allOrganizations.find(org => (org.code || org.기관코드) === orgCode);
      
      if (!committee) {
        showMessage('위원 정보를 찾을 수 없습니다.', 'error');
        return;
      }
      
      if (!organization) {
        showMessage('기관 정보를 찾을 수 없습니다.', 'error');
        return;
      }
      
      // 기존 매칭에서 동일 기관, 역할의 매칭 제거
      let filtered = allMatchings.filter(m => !(m.orgCode === orgCode && m.role === role));
      
      // 새 매칭 추가
      const committeeName = committee.이름 || committee.name || '';
      const orgName = organization.name || organization.기관명 || '';
      const region = organization.region || organization.지역 || '';
      
      filtered.push({
        orgCode, 
        orgName,
        region,
        committeeId, 
        committeeName,
        role,
        checkType: '전체' // 기본값은 전체로 설정
      });
      
      // 저장 API 호출
      const response = await fetch('/api/committees/matching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchings: filtered })
      });
      if (!response.ok) throw new Error('저장 실패');
      closeModal('add-matching-modal');
      showMessage('담당자 매칭이 저장되었습니다.', 'success');
      await refreshMatchingData();
    } catch (err) {
      showMessage('저장 중 오류: ' + err.message, 'error');
    }
  };
};

// 모달 닫기
const closeModal = (modalId) => {
  // 명시적 modalId가 있는 경우 해당 모달만 제거
  if (modalId) {
    const modalContainer = document.getElementById(modalId);
    if (modalContainer) {
      modalContainer.remove();
      return;
    }
  }
  
  // modalId가 없거나 찾지 못한 경우 모든 가능한 모달 찾아서 제거
  const matchingModal = document.getElementById('matching-modal');
  const orgModal = document.getElementById('org-modal');
  
  if (matchingModal) {
    matchingModal.remove();
  }
  
  if (orgModal) {
    orgModal.remove();
  }
  
  // 혹시 다른 모달이 있을 경우를 대비해 모달 클래스로도 찾아서 제거
  const otherModals = document.querySelectorAll('.fixed.inset-0.flex.items-center.justify-center.z-50');
  otherModals.forEach(modal => {
    modal.remove();
  });
};

// 지역별 기관 분류 및 출력
const showOrganizationsByRegion = () => {
  try {
    // 모든 기관을 지역별로 분류
    const regionMap = {};
    
    // 각 기관의 지역 정보 수집
    allOrganizations.forEach(org => {
      let region = org.region || '미분류';
      if (region.startsWith('창원시')) region = '창원시';
      if (!regionMap[region]) {
        regionMap[region] = [];
      }
      regionMap[region].push({
        name: org.name || org.기관명,
        code: org.code || org.기관코드
      });
    });
    
    // 지역별로 정렬하여 출력
    console.log('----- 지역별 기관 분류 -----');
    
    // 시 지역과 군 지역으로 구분
    const cities = [];
    const counties = [];

    // 창원시 통합: regionMap의 키 중 '창원시'로 시작하면 모두 '창원시'로 통합
    const unifiedRegionMap = {};
    Object.keys(regionMap).forEach(region => {
      let unified = region;
      if (region.startsWith('창원시')) unified = '창원시';
      if (!unifiedRegionMap[unified]) unifiedRegionMap[unified] = [];
      unifiedRegionMap[unified].push(...regionMap[region]);
    });

    Object.keys(unifiedRegionMap).forEach(region => {
      if (region.includes('시')) {
        cities.push(region);
      } else if (region.includes('군')) {
        counties.push(region);
      }
    });
    // 시 지역 출력
    console.log('=== 시 지역 ===');
    cities.sort().forEach(city => {
      console.log(`[${city}] - ${unifiedRegionMap[city].length}개 기관`);
      unifiedRegionMap[city].forEach(org => {
        console.log(`  - ${org.name} (${org.code})`);
      });
    });
    // 군 지역 출력
    console.log('\n=== 군 지역 ===');
    counties.sort().forEach(county => {
      console.log(`[${county}] - ${unifiedRegionMap[county].length}개 기관`);
      unifiedRegionMap[county].forEach(org => {
        console.log(`  - ${org.name} (${org.code})`);
      });
    });
    
    // 기타 지역 출력 (시나 군이 아닌 경우)
    const others = Object.keys(regionMap).filter(region => 
      !region.includes('시') && !region.includes('군'));
    
    if (others.length > 0) {
      console.log('\n=== 기타 지역 ===');
      others.sort().forEach(region => {
        console.log(`[${region}] - ${regionMap[region].length}개 기관`);
        regionMap[region].forEach(org => {
          console.log(`  - ${org.name} (${org.code})`);
        });
      });
    }
    
    return regionMap;
  } catch (error) {
    console.error('지역별 기관 분류 중 오류:', error);
    return {};
  }
};

// 기관 추가 모달 표시
const showAddOrgModal = async () => {
  // 위원 목록이 비어 있으면 새로 불러오기
  if (!allCommittees || allCommittees.length === 0) {
    const committeesResponse = await committeeApi.getAllCommittees();
    if (committeesResponse.status === 'success') {
      allCommittees = committeesResponse.data.committees || [];
    } else {
      showMessage('위원 목록을 불러오지 못했습니다.', 'error');
      return;
    }
  }
  // 모달 생성 또는 가져오기
  let modal = document.getElementById('add-org-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'add-org-modal';
    modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center';
    modal.innerHTML = `
      <div class="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg">
        <h3 class="text-lg font-medium mb-4">기관 추가</h3>
        <form id="add-org-form">
          <div class="mb-4">
            <label for="org-name-input" class="block text-sm font-medium text-gray-700 mb-1">기관명</label>
            <input id="org-name-input" type="text" class="w-full border rounded px-3 py-2" required />
          </div>
          <div class="mb-4">
            <label for="org-code-input" class="block text-sm font-medium text-gray-700 mb-1">기관코드</label>
            <input id="org-code-input" type="text" class="w-full border rounded px-3 py-2" required />
          </div>
          <div class="mb-4">
            <label for="org-region-select" class="block text-sm font-medium text-gray-700 mb-1">지역(시군)</label>
            <select id="org-region-select" class="w-full border rounded px-3 py-2">
              <option value="">선택</option>
              ${(() => {
                // 실제 allOrganizations에서 시군 추출(중복X, 가나다순)
                const sigunSet = new Set(
                  allOrganizations.map(org => {
                    let region = org.region || '미분류';
                    if (region.startsWith('창원시')) return '창원시';
                    return region;
                  })
                );
                return Array.from(sigunSet).sort().map(region => `<option value="${region}">${region}</option>`).join('');
              })()}
            </select>
          </div>
          <div class="mb-4">
            <label for="org-main-committee-select" class="block text-sm font-medium text-gray-700 mb-1">주담당(위원)</label>
            <select id="org-main-committee-select" class="w-full border rounded px-3 py-2" required>
              <option value="">선택</option>
              ${allCommittees.map(c => `<option value="${c.id}">${c.name} (${c.id})</option>`).join('')}
            </select>
          </div>
          <div class="mb-4">
            <label for="org-sub-committee-select" class="block text-sm font-medium text-gray-700 mb-1">부담당(위원)</label>
            <select id="org-sub-committee-select" class="w-full border rounded px-3 py-2" required>
              <option value="">선택</option>
              ${allCommittees.map(c => `<option value="${c.id}">${c.name} (${c.id})</option>`).join('')}
            </select>
          </div>
          <div class="mb-4">
            <label for="org-note-input" class="block text-sm font-medium text-gray-700 mb-1">비고</label>
            <input id="org-note-input" type="text" class="w-full border rounded px-3 py-2" />
          </div>
          <div class="flex justify-end space-x-2">
            <button type="button" class="px-4 py-2 bg-gray-400 text-white rounded" id="cancel-add-org-btn">취소</button>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">저장</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  }
  modal.classList.remove('hidden');

  // 취소 버튼 이벤트
  document.getElementById('cancel-add-org-btn').onclick = () => closeModal('add-org-modal');
  // 저장 이벤트
  document.getElementById('add-org-form').onsubmit = async (e) => {
    e.preventDefault();
    await saveNewOrganization();
  };
};

// 새 기관 저장
const saveNewOrganization = async () => {
  try {
    const orgName = document.getElementById('org-name-input').value.trim();
    const orgCode = document.getElementById('org-code-input').value.trim();
    const orgRegion = document.getElementById('org-region-select').value;
    const orgNote = document.getElementById('org-note-input').value.trim();
    const mainCommitteeId = document.getElementById('org-main-committee-select').value;
    const subCommitteeId = document.getElementById('org-sub-committee-select').value;

    // 입력 데이터 검증
    if (!orgName) {
      alert('기관명을 입력해주세요.');
      return;
    }
    if (!orgCode || !orgCode.startsWith('A48')) {
      alert('기관코드는 A48로 시작해야 합니다.');
      return;
    }
    if (!mainCommitteeId || !subCommitteeId) {
      alert('주담당, 부담당을 모두 선택해야 합니다.');
      return;
    }
    // 중복 코드 확인
    const isDuplicate = allOrganizations.some(org => 
      (org.code === orgCode || org.기관코드 === orgCode));
    if (isDuplicate) {
      alert('이미 존재하는 기관코드입니다. 다른 코드를 입력해주세요.');
      return;
    }
    
    // 새 기관 객체 생성
    const newOrg = {
      code: orgCode,
      name: orgName,
      region: orgRegion,
      note: orgNote,
      mainCommitteeId,
      subCommitteeId,
      id: `ORG_${Date.now()}`  // 임시 ID 생성
    };
    
    // 구글 시트에 기관 추가하기 위한 API 호출
    try {
      // 구글 시트 API 엔드포인트 사용
      const response = await fetch('/api/sheets/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: orgCode,
          name: orgName,
          region: orgRegion,
          note: orgNote,
          mainCommitteeId,
          subCommitteeId,
          action: 'add' // 액션 타입 명시
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '기관 추가 실패');
      }
      
      const responseData = await response.json();
      console.log('API 응답:', responseData);
      
      // 기관 추가 타임스탬프 저장 - 로그인 시 최신 기관 데이터 불러오기 위해
      const currentTime = Date.now().toString();
      if (responseData.data && responseData.data.timestamp) {
        localStorage.setItem('lastOrganizationUpdateTime', responseData.data.timestamp.toString());
        console.log('기관 추가 타임스탬프 저장:', responseData.data.timestamp);
      } else {
        localStorage.setItem('lastOrganizationUpdateTime', currentTime);
        console.log('기관 추가 타임스탬프 저장 (응답에 없어 현재 시간 사용):', currentTime);
      }
      
      // API 응답에서 기관 ID 가져오기
      if (responseData.data && responseData.data.organization && responseData.data.organization.id) {
        newOrg.id = responseData.data.organization.id;
      }
    } catch (error) {
      console.error('API 호출 중 오류:', error);
      console.log('오류 발생, 로컬 데이터만 업데이트합니다.');
    }
    
    // 로컬 데이터 처리 - API 성공 여부와 관계없이 항상 실행
    // 매칭 정보 추가
    const mainCommittee = allCommittees.find(c => c.id === mainCommitteeId);
    const subCommittee = allCommittees.find(c => c.id === subCommitteeId);
    
    if (mainCommittee) {
      allMatchings.push({
        committeeId: mainCommitteeId,
        committeeName: mainCommittee.name,
        orgCode: orgCode,
        orgName: orgName,
        region: orgRegion,
        role: '주담당'
      });
    }
    
    if (subCommittee) {
      allMatchings.push({
        committeeId: subCommitteeId,
        committeeName: subCommittee.name,
        orgCode: orgCode,
        orgName: orgName,
        region: orgRegion,
        role: '부담당'
      });
    }
    
    // 로컬 스토리지에 매칭 정보 저장
    localStorage.setItem('committee_matchings', JSON.stringify(allMatchings));
    console.log('매칭 정보가 로컬 스토리지에 저장되었습니다.');
    
    // 기관 목록에 추가
    allOrganizations.push(newOrg);
    
    // 로컬 스토리지에 기관 정보 저장 (서버 재시작 후에도 데이터 유지)
    try {
      // 기존 저장된 기관 목록 가져오기
      const savedOrgs = localStorage.getItem('all_organizations');
      let orgsArray = [];
      
      if (savedOrgs) {
        orgsArray = JSON.parse(savedOrgs);
      }
      
      // 중복 체크 후 새 기관 추가
      const existingIndex = orgsArray.findIndex(org => 
        org.code === orgCode || org.기관코드 === orgCode
      );
      
      if (existingIndex >= 0) {
        // 기존 기관 정보 업데이트
        orgsArray[existingIndex] = newOrg;
      } else {
        // 새 기관 추가
        orgsArray.push(newOrg);
      }
      
      // 로컬 스토리지에 저장
      localStorage.setItem('all_organizations', JSON.stringify(orgsArray));
      console.log('기관 정보가 로컬 스토리지에 저장되었습니다. 총', orgsArray.length, '개 기관');
    } catch (storageError) {
      console.error('로컬 스토리지에 기관 정보 저장 중 오류:', storageError);
    }
    
    // 데이터 새로고침
    updateMatchingTable();
    document.getElementById('total-orgs-count').textContent = allOrganizations.length;
    
    // 성공 메시지 표시
    alert('새 기관이 성공적으로 추가되었습니다.');
  } catch (error) {
    console.error('기관 추가 중 오류:', error);
    alert(`기관 추가 중 오류가 발생했습니다: ${error.message}`);
  } finally {
    // 오류 발생 여부와 관계없이 모달창 닫기
    closeModal('add-org-modal');
  }
};

// 기관 삭제 함수
const deleteOrganization = async (orgCode, orgName) => {
  try {
    // 삭제 확인
    if (!confirm(`${orgName} 기관을 정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, 관련된 모든 매칭 정보도 함께 삭제됩니다.`)) {
      return;
    }

    console.log(`기관 삭제 시작: ${orgName} (${orgCode})`);

    // 1. 기관 관련 매칭 정보 삭제
    const updatedMatchings = allMatchings.filter(m => m.orgCode !== orgCode);
    
    // 2. 매칭 정보 업데이트 API 호출
    const matchingResponse = await fetch('/api/committees/matching', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ matchings: updatedMatchings })
    });

    if (!matchingResponse.ok) {
      throw new Error('매칭 정보 삭제 중 오류가 발생했습니다.');
    }

    // 3. 구글 시트에서 기관 삭제 API 호출
    try {
      console.log(`구글 시트에서 기관 삭제 시도: ${orgCode}`);
      
      // 새로 만든 organizations-delete.js 엔드포인트 호출
      const deleteResponse = await fetch(`/api/organizations-delete?code=${orgCode}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        console.warn(`구글 시트에서 기관 삭제 실패 (${deleteResponse.status}): ${errorData.message}`);
        console.log('로컬 데이터만 업데이트합니다.');
      } else {
        const successData = await deleteResponse.json();
        console.log(`구글 시트에서 기관 삭제 성공: ${successData.message}`);
      }
    } catch (apiError) {
      console.warn('구글 시트 삭제 API 호출 오류:', apiError);
      console.log('구글 시트 삭제 API 호출 실패: 로컬 데이터만 업데이트합니다.');
    }

    // 4. 로컬 데이터 업데이트
    allMatchings = updatedMatchings;
    allOrganizations = allOrganizations.filter(org => 
      (org.code !== orgCode && org.기관코드 !== orgCode)
    );

    // 5. UI 업데이트
    updateMatchingTable();
    
    // 6. 성공 메시지 표시
    alert(`${orgName} 기관이 성공적으로 삭제되었습니다.`);
    
    // 7. 통계 업데이트
    document.getElementById('total-orgs-count').textContent = allOrganizations.length;

  } catch (error) {
    console.error('기관 삭제 중 오류:', error);
    alert(`기관 삭제 중 오류가 발생했습니다: ${error.message}`);
  }
};

// 메시지 표시 함수
const showMessage = (message, type = 'info') => {
  // 이미 있는 메시지 제거
  const existingMsg = document.getElementById('toast-message');
  if (existingMsg) {
    existingMsg.remove();
  }
  
  // 타입별 색상 설정
  let bgColor = 'bg-blue-500';
  let iconHtml = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
  
  if (type === 'success') {
    bgColor = 'bg-green-500';
    iconHtml = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
  } else if (type === 'warning') {
    bgColor = 'bg-yellow-500';
    iconHtml = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
  } else if (type === 'error') {
    bgColor = 'bg-red-500';
    iconHtml = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
  }
  
  // 토스트 메시지 요소 생성
  const toast = document.createElement('div');
  toast.id = 'toast-message';
  toast.className = `fixed top-4 right-4 flex items-center p-4 mb-4 text-white ${bgColor} rounded-lg shadow-lg z-50`;
  toast.innerHTML = `
    <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg bg-white/25">
      ${iconHtml}
    </div>
    <div class="ml-3 text-sm font-normal">${message}</div>
    <button type="button" class="ml-4 bg-white/25 text-white rounded-lg inline-flex h-6 w-6 items-center justify-center hover:bg-white/50" onclick="this.parentElement.remove()">
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
    </button>
  `;
  
  // 화면에 표시
  document.body.appendChild(toast);
  
  // 3초 후 자동 제거
  setTimeout(() => {
    if (document.getElementById('toast-message')) {
      document.getElementById('toast-message').remove();
    }
  }, 3000);
};

// 전역 스코프에 필요한 함수들 노출
window.showMessage = showMessage;
window.showAddMatchingModal = showAddMatchingModal;
window.showAddOrgModal = showAddOrgModal;
window.filterOrganizations = filterOrganizations;
window.updateMatchingTable = updateMatchingTable;
window.loadMasterDashboardData = loadMasterDashboardData;
window.showMasterDashboard = showMasterDashboard; // 명시적으로 전역에 노출
// refreshMatchingData는 이미 window 객체에 노출되어 있음

// 페이지 로드 시 마스터 대시보드 초기화
document.addEventListener('DOMContentLoaded', () => {
  // 마스터 페이지인지 확인
  const isMasterPage = window.location.pathname.includes('/master') || 
                      document.getElementById('master-dashboard') !== null;
  
  if (isMasterPage) {
    console.log('마스터 페이지 감지됨, 대시보드 초기화 시작');
    setTimeout(() => {
      showMasterDashboard();
      
      // 새로고침 버튼 이벤트 리스너 추가
      const refreshButton = document.getElementById('refresh-data-btn');
      if (refreshButton) {
        refreshButton.addEventListener('click', async () => {
          console.log('데이터 새로고침 버튼 클릭됨');
          refreshButton.disabled = true;
          refreshButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            새로고침 중...
          `;
          
          try {
            await loadMasterDashboardData();
            showMessage('데이터가 성공적으로 새로고침되었습니다.', 'success');
          } catch (error) {
            console.error('데이터 새로고침 오류:', error);
            showMessage('데이터 새로고침 중 오류가 발생했습니다.', 'error');
          } finally {
            refreshButton.disabled = false;
            refreshButton.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              데이터 새로고침
            `;
          }
        });
      }
      
      // 구글 시트 연동 버튼 이벤트 리스너 추가
      setTimeout(() => {
        const syncSheetButton = document.getElementById('sync-sheet-btn');
        if (syncSheetButton) {
          syncSheetButton.addEventListener('click', async () => {
            console.log('구글 시트 연동 버튼 클릭됨');
            
            // 버튼 비활성화 및 로딩 상태 표시
            syncSheetButton.disabled = true;
            const originalButtonText = syncSheetButton.innerHTML;
            syncSheetButton.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              구글 시트 연동 중...
            `;
            
            try {
              // 구글 시트 연동 기능이 로드되었는지 확인
              if (typeof window.syncSchedulesWithSheet !== 'function') {
                throw new Error('구글 시트 연동 기능이 로드되지 않았습니다.');
              }
              
              // 구글 시트에서 데이터 가져오기
              const syncResult = await window.syncSchedulesWithSheet();
              
              if (syncResult) {
                showMessage('구글 시트에서 일정 데이터를 성공적으로 가져왔습니다.', 'success');
                // 달력 뷰 업데이트
                if (typeof window.loadCommitteeSchedules === 'function') {
                  window.loadCommitteeSchedules();
                }
              } else {
                // 로컬 데이터를 구글 시트로 내보내기 시도
                const exportResult = await window.exportLocalSchedulesToSheet();
                
                if (exportResult) {
                  showMessage('로컬 일정 데이터를 구글 시트로 성공적으로 내보냈습니다.', 'success');
                } else {
                  showMessage('구글 시트 연동에 실패했습니다. 나중에 다시 시도해주세요.', 'error');
                }
              }
            } catch (error) {
              console.error('구글 시트 연동 오류:', error);
              showMessage(`구글 시트 연동 중 오류가 발생했습니다: ${error.message}`, 'error');
            } finally {
              // 버튼 상태 복원
              syncSheetButton.disabled = false;
              syncSheetButton.innerHTML = originalButtonText;
            }
          });
        } else {
          console.warn('구글 시트 연동 버튼을 찾을 수 없습니다.');
        }
      }, 1000); // 버튼이 DOM에 추가될 시간을 주기 위해 약간의 지연 설정
    }, 500); // 약간의 지연을 두고 초기화
  }
});
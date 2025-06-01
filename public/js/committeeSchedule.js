// 마스터 로그인 시 각 담당자별 기관방문일정 관리를 위한 JS 파일

console.log('[DEBUG] committeeSchedule.js 파일 로드 시작');

// 전역 변수들 정의
let allCommitteeSchedules = []; // 모든 위원 일정
let filteredSchedules = []; // 현재 월에 필터링된 일정
let selectedMonth = new Date().getMonth(); // 현재 월 (0-11)
let selectedYear = new Date().getFullYear(); // 현재 연도

// 데이터 로드 상태 관리 변수
let isLoadingMatchings = false;
let isLoadingSchedules = false;
let matchingsLoaded = false;
let schedulesLoaded = false;

// 위원별 색상 기본 정의 (calendar.js와 동일한 색상 사용)
const COMMITTEE_COLORS = {
  '신용기': '#1e40af',  // 진한 파란색
  '문일지': '#b91c1c',  // 진한 빨간색
  '김수연': '#15803d',  // 진한 초록색
  '이연숙': '#c2410c',  // 진한 주황색
  '이정혜': '#7e22ce'   // 진한 보라색
};

// 위원 번호에 따라 실제 이름으로 매핑하는 객체
const committeeNameMapping = {
  '모니터링위원1': '신용기',
  '모니터링위원2': '김수연',
  '모니터링위원3': '문일지',
  '모니터링위원4': '이연숙',
  '모니터링위원5': '이정혜'
};

// 위원 이름 정렬 우선순위 설정 (표시 순서)
const committeeOrder = [
  '신용기', '김수연', '문일지', '이연숙', '이정혜', '미지정'
];

// 동적 색상 배열 (위원 이름에 매핑된 색상이 없을 때 사용)
const colorPalette = [
  '#1e40af', '#b91c1c', '#15803d', '#c2410c', '#7e22ce', '#0e7490',
  '#1e293b', '#0f766e', '#166534', '#1e40af', '#7e22ce', '#a16207'
];

// 동적으로 할당된 색상 저장
const dynamicColors = {};

// 기본 색상
const defaultColor = '#757575'; // 회색

// 위원별 색상 매핑 생성 함수
function generateColorMapping() {
  const colorMapping = {};
  
  // 기본 이름 매핑
  Object.keys(COMMITTEE_COLORS).forEach(name => {
    colorMapping[name] = COMMITTEE_COLORS[name];
    // 모니터링위원 형식 매핑 추가
    Object.entries(committeeNameMapping).forEach(([key, value]) => {
      if (value === name) {
        colorMapping[key] = COMMITTEE_COLORS[name];
      }
    });
  });
  
  return colorMapping;
}

// 위원별 색상 매핑 추가
const committeeColors = generateColorMapping();

// 위원 이름을 실제 이름으로 변환하는 함수
function mapCommitteeName(originalName) {
  if (!originalName) return '미지정';
  
  // 직접 매핑된 이름이 있는 경우
  if (committeeNameMapping[originalName]) {
    return committeeNameMapping[originalName];
  }
  
  // '모니터링위원N' 패턴 확인
  if (originalName.startsWith('모니터링위원')) {
    // 숫자 부분 추출 (예: '모니터링위원1' -> '1')
    const numMatch = originalName.match(/모니터링위원(\d+)/);
    if (numMatch && numMatch[1]) {
      const committeeNum = parseInt(numMatch[1], 10);
      const mappedName = committeeNameMapping[`모니터링위원${committeeNum}`];
      if (mappedName) {
        return mappedName;
      }
    }
  }
  
  // 패턴이 맞지 않으면 원래 이름 반환
  return originalName;
}

// 위원 이름으로 색상 가져오기
function getCommitteeColor(committeeName) {
  if (!committeeName || committeeName === '미지정') return defaultColor;
  
  // 문자열로 변환
  const nameStr = String(committeeName);
  
  // 이미 매핑된 색상이 있으면 반환
  if (committeeColors[nameStr]) {
    return committeeColors[nameStr];
  }
  
  // 위원 이름 변환을 시도하여 매핑 검색
  const mappedName = mapCommitteeName(nameStr);
  if (mappedName !== nameStr && committeeColors[mappedName]) {
    return committeeColors[mappedName];
  }
  
  // 이름 포함 여부 확인 (부분 매칭)
  for (const [key, value] of Object.entries(COMMITTEE_COLORS)) {
    if (nameStr.includes(key) || key.includes(nameStr)) {
      return value;
    }
  }
  
  // 이미 동적으로 할당된 색상이 있으면 반환
  if (dynamicColors[nameStr]) {
    return dynamicColors[nameStr];
  }
  
  // 새로운 위원 이름에는 색상 팔레트에서 동적으로 색상 할당
  const colorIndex = Object.keys(dynamicColors).length % colorPalette.length;
  dynamicColors[nameStr] = colorPalette[colorIndex];
  
  return dynamicColors[nameStr];
}

// 위원 정렬 함수 추가
function sortCommitteeNames(a, b) {
  const indexA = committeeOrder.indexOf(a);
  const indexB = committeeOrder.indexOf(b);
  
  // 둘 다 우선순위 목록에 있는 경우
  if (indexA !== -1 && indexB !== -1) {
    return indexA - indexB;
  }
  
  // a만 우선순위 목록에 있는 경우
  if (indexA !== -1) {
    return -1;
  }
  
  // b만 우선순위 목록에 있는 경우
  if (indexB !== -1) {
    return 1;
  }
  
  // 둘 다 우선순위 목록에 없는 경우 알파벳 순서로 정렬
  return a.localeCompare(b);
}

// 실제 로그인 화면인지 확인하는 함수
function isLoginScreen() {
  const loginContainer = document.getElementById('login-container');
  const dashboardContainer = document.getElementById('dashboard-container');
  
  // 로그인 컨테이너가 표시되고 대시보드가 숨겨져 있으면 로그인 화면으로 간주
  return loginContainer && 
         window.getComputedStyle(loginContainer).display !== 'none' && 
         (!dashboardContainer || dashboardContainer.classList.contains('hidden'));
}

// 위원별 담당기관 매칭 데이터 로드 함수
async function loadCommitteeMatchings() {
  console.log('[DEBUG] 위원별 담당기관 매칭 데이터 로드 함수 호출');
  
  // 이미 로드 중이거나 로드된 경우 중복 호출 방지
  if (isLoadingMatchings) {
    console.log('[DEBUG] 매칭 데이터가 이미 로드 중입니다.');
    return;
  }
  
  if (matchingsLoaded && window.allMatchings && window.allMatchings.length > 0) {
    console.log('[DEBUG] 매칭 데이터가 이미 로드되어 있습니다:', window.allMatchings.length + '개');
    
    // 이미 로드된 데이터 사용 이벤트 발생
    const event = new CustomEvent('matchingsLoaded', { detail: { matchings: window.allMatchings } });
    document.dispatchEvent(event);
    return;
  }
  
  // 로드 상태 설정
  isLoadingMatchings = true;
  
  try {
    // API 호출
    const headers = getAuthHeaders();
    const timestamp = new Date().getTime();
    
    // 서버에서 매칭 데이터 가져오기
    const response = await fetch(`/api/committees/matching?_t=${timestamp}`, {
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error(`매칭 데이터 로드 실패: ${response.status}`);
    }
    
    const data = await response.json();
    
    // API 응답 형식 검사 - 직접 배열이거나 이전 형식(status+matchings) 모두 처리
    if (Array.isArray(data)) {
      // 직접 배열이 반환된 경우 (새 API 형식)
      window.allMatchings = data;
      console.log(`[DEBUG] 로드된 매칭 데이터: ${window.allMatchings.length}개`);
      isLoadingMatchings = false;
      matchingsLoaded = true;
      return true;
    } else if (data.status === 'success' && Array.isArray(data.matchings)) {
      // 이전 형식의 API 응답인 경우
      window.allMatchings = data.matchings;
      console.log(`[DEBUG] 로드된 매칭 데이터(이전 형식): ${window.allMatchings.length}개`);
      isLoadingMatchings = false;
      matchingsLoaded = true;
      return true;
    } else {
      console.error('매칭 데이터가 올바른 형식이 아님:', data);
      window.allMatchings = [];
      return false;
    }
  } catch (error) {
    // 오류 정보 상세히 기록
    console.error('매칭 데이터 로드 중 오류:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // 오류 발생 시 빈 배열로 초기화
    window.allMatchings = [];
    return false;
  }
}

// 함수 즉시 등록 - 스크립트 로드 즉시 실행
window.initializeCommitteeSchedulesView = async function() {
  console.log('[DEBUG] 원본 일정 초기화 함수 호출됨');
  
  // 이미 초기화된 일정 뷰가 있는지 확인
  const scheduleContainerCheck = document.getElementById('committee-schedules-container');
  if (scheduleContainerCheck && scheduleContainerCheck.classList.contains('initialized')) {
    console.log('[DEBUG] 담당자별 기관방문일정 뷰가 이미 초기화되어 있습니다.');
    return;
  }
  
  // 로그인 화면에서는 실행하지 않음
  if (isLoginScreen()) {
    console.log('[DEBUG] 로그인 화면이 감지되어 일정 초기화를 건너뜁니다.');
    return;
  }
  
  // 위원별 담당기관 매칭 데이터 먼저 로드
  await loadCommitteeMatchings();
  
  // 마스터 대시보드에 일정 뷰 컨테이너 추가
  const masterDashboard = document.getElementById('master-dashboard');
  if (!masterDashboard) {
    console.warn('마스터 대시보드 엘리먼트를 찾을 수 없습니다');
    return;
  }
  
  // 이미 있으면 제거
  const existingContainer = document.getElementById('committee-schedules-section');
  if (existingContainer) {
    existingContainer.remove();
  }
  
  // 새로운 섹션 추가
  const schedulesSection = document.createElement('div');
  schedulesSection.id = 'committee-schedules-section';
  schedulesSection.className = 'bg-white p-6 rounded-lg shadow-sm mb-6';
  schedulesSection.innerHTML = `
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg font-semibold">담당자별 기관 방문 일정</h2>
      <div class="flex items-center space-x-2">
        <button id="prev-month-btn" class="bg-gray-200 hover:bg-gray-300 text-gray-700 p-1 rounded">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
        </button>
        <span id="current-month-display" class="text-sm font-medium">${selectedYear}년 ${selectedMonth + 1}월</span>
        <button id="next-month-btn" class="bg-gray-200 hover:bg-gray-300 text-gray-700 p-1 rounded">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
          </svg>
        </button>
        <a href="/calendar" class="ml-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">
          일정 관리
        </a>
      </div>
    </div>
    <div id="committee-schedules-container" class="mt-4">
      <div class="flex justify-center items-center p-8">
        <div class="loader"></div>
        <p class="ml-2">일정 데이터를 불러오는 중...</p>
      </div>
    </div>
  `;
  
  // 마스터 대시보드 상단에 삽입
  masterDashboard.insertBefore(schedulesSection, masterDashboard.firstChild);
  
  // 이벤트 리스너 추가
  document.getElementById('prev-month-btn').addEventListener('click', function() {
    if (typeof window.changeMonth === 'function') {
      window.changeMonth(-1);
    } else {
      console.error('changeMonth 함수를 찾을 수 없습니다');
    }
  });
  
  document.getElementById('next-month-btn').addEventListener('click', function() {
    if (typeof window.changeMonth === 'function') {
      window.changeMonth(1);
    } else {
      console.error('changeMonth 함수를 찾을 수 없습니다');
    }
  });
  
  // 일정 데이터 로드
  if (typeof window.loadCommitteeSchedules === 'function') {
    window.loadCommitteeSchedules();
  } else {
    console.error('loadCommitteeSchedules 함수를 찾을 수 없습니다');
  }
  
  // 초기화 완료 표시
  const scheduleContainerElement = document.getElementById('committee-schedules-container');
  if (scheduleContainerElement) {
    scheduleContainerElement.classList.add('initialized');
    console.log('[DEBUG] 담당자별 기관방문일정 뷰 초기화 완료');
  }
};

// 월 변경 함수 정의
window.changeMonth = function(delta) {
  console.log('[DEBUG] 월 변경 함수 호출됨, delta:', delta);
  
  // 로그인 화면에서는 실행하지 않음
  if (isLoginScreen()) {
    console.log('[DEBUG] 로그인 화면이 감지되어 월 변경을 건너뜁니다.');
    return;
  }
  
  // 월 업데이트
  let newMonth = selectedMonth + delta;
  let newYear = selectedYear;
  
  if (newMonth < 0) {
    newMonth = 11;
    newYear -= 1;
  } else if (newMonth > 11) {
    newMonth = 0;
    newYear += 1;
  }
  
  // 상태 업데이트
  selectedMonth = newMonth;
  selectedYear = newYear;
  
  // 표시 업데이트
  const monthDisplay = document.getElementById('current-month-display');
  if (monthDisplay) {
    monthDisplay.textContent = `${selectedYear}년 ${selectedMonth + 1}월`;
  }
  
  // 데이터 필터링 및 렌더링
  filterSchedulesByMonth(selectedMonth, selectedYear);
  renderCommitteeSchedules();
};

// 샘플 일정 데이터 생성 함수 정의
function generateSampleSchedules() {
  console.log('[DEBUG] 샘플 일정 데이터 생성');
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  
  // 기관 목록 - 실제 데이터 기반 (지역 변수로 선언)
  const sampleOrganizations = [
    { code: 'A48170002', name: '대한노인회 고성군지회', address: '경상남도 고성군 고성읍 중앙로 145' },
    { code: 'A48170003', name: '한올생명의집', address: '경상남도 고성군 개천면 청광리 201-1' },
    { code: 'A48240001', name: '화방남해', address: '경상남도 남해군 남해읍 남해대로 2935-3' },
    { code: 'A48240002', name: '화방재가', address: '경상남도 남해군 남해읍 남해대로 2935-3' },
    { code: 'A48840001', name: '사랑원', address: '경상남도 사천시 사천읍 구암두문로 254-9' },
    { code: 'A48840002', name: '사천노인', address: '경상남도 사천시 용현면 진삼로 447' },
    { code: 'A48850001', name: '나누리', address: '경상남도 진주시 문산읍 동부로 702' },
    { code: 'A48850002', name: '진양', address: '경상남도 진주시 진성면 진성로 1194' },
    { code: 'A48170001', name: '진주', address: '경상남도 진주시 진주대로 875' },
    { code: 'B12345678', name: '경남하동', address: '경상남도 하동군 하동읍 중앙로 70' },
    { code: 'B87654321', name: '하동노인', address: '경상남도 하동군 하동읍 읍내리 291-1' },
    { code: 'C12345678', name: '창원도우누리통합재가센터', address: '경상남도 창원시 의창구 원이대로 450' }
  ];
  
  // 위원 목록
  const committees = [
    { name: '신용기', orgs: ['A48170002', 'A48170003', 'A48240001', 'A48240002'] },
    { name: '김수연', orgs: ['A48840001', 'A48840002'] },
    { name: '문일지', orgs: ['A48850001', 'A48850002'] },
    { name: '이연숙', orgs: ['A48170001', 'B12345678'] },
    { name: '이정혜', orgs: ['B87654321'] }
  ];
  
  // 일정 상태 옵션
  const statusOptions = [
    { value: 'pending', label: '예정', probability: 0.5 },
    { value: 'completed', label: '완료', probability: 0.3 },
    { value: 'canceled', label: '취소', probability: 0.2 }
  ];
  
  // 방문 유형
  const visitTypes = ['정기평가', '수시평가', '컨설팅', '민원조사', '특별점검'];
  
  // 샘플 일정 생성
  const schedules = [];
  
  // 이번 달과 다음 달에 대한 일정 생성
  for (let m = 0; m < 2; m++) {
    const targetMonth = (month + m) % 12;
    const targetYear = year + Math.floor((month + m) / 12);
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    
    // 각 위원별로 담당 기관에 대한 일정 생성
    committees.forEach((committee) => {
      // 이번 달에 담당 기관별로 1개의 일정 생성
      committee.orgs.forEach(orgCode => {
        // 해당 기관 정보 찾기
        const org = sampleOrganizations.find(o => o.code === orgCode);
        if (!org) return;
        
        // 랜덤 날짜 (1-28일)
        const day = 1 + Math.floor(Math.random() * 28);
        const date = new Date(targetYear, targetMonth, day);
        const dateStr = date.toISOString().split('T')[0];
        
        // 방문 시간 (9-17시)
        const startHour = 9 + Math.floor(Math.random() * 7);
        const startMinute = [0, 30][Math.floor(Math.random() * 2)];
        const duration = [60, 90, 120][Math.floor(Math.random() * 3)]; // 1시간, 1시간 30분, 2시간
        
        // 종료 시간 계산
        let endHour = startHour;
        let endMinute = startMinute + duration;
        if (endMinute >= 60) {
          endHour += Math.floor(endMinute / 60);
          endMinute = endMinute % 60;
        }
        
        // 시간 형식 포맷팅
        const startTimeStr = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
        const endTimeStr = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
        
        // 상태 결정 (가중치 적용)
        let status;
        const rand = Math.random();
        let cumulativeProbability = 0;
        for (const option of statusOptions) {
          cumulativeProbability += option.probability;
          if (rand <= cumulativeProbability) {
            status = option.value;
            break;
          }
        }
        
        // 방문 유형 선택
        const visitType = visitTypes[Math.floor(Math.random() * visitTypes.length)];
        
        // 일정 생성
        schedules.push({
          id: `schedule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          date: dateStr,
          visitDate: dateStr,
          scheduleDate: dateStr,
          committeeName: committee.name,
          organizationName: org.name,
          orgName: org.name,
          orgCode: org.code,
          orgAddress: org.address,
          startTime: startTimeStr,
          endTime: endTimeStr,
          time: `${startTimeStr} - ${endTimeStr}`,
          status: status,
          visitType: visitType,
          notes: `${org.name} ${visitType} 방문`,
          memo: `${org.name} ${visitType} 방문 일정 (${org.address})`,
          createdAt: new Date(date.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() // 최대 7일 전에 생성된 것으로 설정
        });
      });
    });
  }
  
  return schedules;
}

// 일정 데이터 로드 함수 정의
async function loadCommitteeSchedules() {
  console.log('[DEBUG] 위원 일정 데이터 로드 함수 호출');
  
  // 이미 로드 중이면 중복 호출 방지
  if (isLoadingSchedules) {
    console.log('[DEBUG] 이미 일정 데이터를 로드 중입니다.');
    return;
  }
  
  isLoadingSchedules = true;
  
  // scheduleContainer 변수를 함수 시작 부분에서 정의
  const scheduleContainer = document.getElementById('committee-schedules-container');
  
  try {
    // 로컬 스토리지에서 일정 데이터 확인
    const savedSchedules = localStorage.getItem('calendar_schedules');
    if (savedSchedules) {
      try {
        const parsedSchedules = JSON.parse(savedSchedules);
        if (parsedSchedules && parsedSchedules.length > 0) {
          console.log(`[DEBUG] 로컬 스토리지에서 ${parsedSchedules.length}개의 일정 가져옴`);
          
          // 일정 데이터 형식 확인 및 정리
          allCommitteeSchedules = parsedSchedules.map(schedule => {
            // 필수 필드가 있는지 확인하고 없으면 추가
            return {
              id: schedule.id || `schedule_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`,
              date: schedule.date || schedule.visitDate || schedule.scheduleDate || new Date().toISOString().split('T')[0],
              visitDate: schedule.visitDate || schedule.date || schedule.scheduleDate || new Date().toISOString().split('T')[0],
              scheduleDate: schedule.scheduleDate || schedule.date || schedule.visitDate || new Date().toISOString().split('T')[0],
              committeeName: schedule.committeeName || '미지정',
              organizationName: schedule.organizationName || schedule.orgName || '미지정',
              orgName: schedule.orgName || schedule.organizationName || '미지정',
              orgCode: schedule.orgCode || '',
              startTime: schedule.startTime || schedule.time?.split('-')[0]?.trim() || '미지정',
              endTime: schedule.endTime || (schedule.time?.includes('-') ? schedule.time.split('-')[1]?.trim() : '미지정'),
              time: schedule.time || `${schedule.startTime || '미지정'} - ${schedule.endTime || '미지정'}`,
              status: schedule.status || 'pending',
              notes: schedule.notes || schedule.memo || '',
              memo: schedule.memo || schedule.notes || '',
              createdAt: schedule.createdAt || new Date().toISOString()
            };
          });
          
          // 전역 변수에 데이터 저장
          window.allCommitteeSchedules = allCommitteeSchedules;
          
          // 데이터 로드 완료 표시
          schedulesLoaded = true;
          window.schedulesLoaded = true;
          
          // 현재 월에 맞게 필터링
          filterSchedulesByMonth(selectedMonth, selectedYear);
          
          // UI 업데이트
          renderCommitteeSchedules();
          
          isLoadingSchedules = false;
          return true;
        }
      } catch (e) {
        console.error('[DEBUG] 로컬 스토리지 일정 데이터 파싱 오류:', e);
      }
    }
    
    console.log('[DEBUG] 로컬 스토리지에 일정 데이터가 없음, 전역 변수 확인');
    
    // 전역 변수에 일정 데이터가 있는지 확인
    if (window.allCommitteeSchedules && window.allCommitteeSchedules.length > 0) {
      console.log('[DEBUG] 전역 변수에서 일정 데이터 가져옴');
      allCommitteeSchedules = window.allCommitteeSchedules;
      schedulesLoaded = true;
      
      // 현재 월에 맞게 일정 필터링
      filterSchedulesByMonth(selectedMonth, selectedYear);
      
      // 일정 목록 렌더링
      renderCommitteeSchedules();
      
      isLoadingSchedules = false;
      return;
    }
    
    // API에서 일정 데이터 가져오기
    console.log('[DEBUG] API에서 일정 데이터 가져오기 시도');
    
    try {
      // 여러 API 엔드포인트를 순차적으로 시도
      const apiEndpoints = [
        '/api/schedules',
        '/api/serverless/schedules',
        '/api/sheets/schedules',
        '/api/committee-schedules'
      ];
      
      let response = null;
      let successEndpoint = null;
      let responseData = null;
      
      // 각 엔드포인트를 순차적으로 시도
      for (const endpoint of apiEndpoints) {
        try {
          console.log(`[DEBUG] API 엔드포인트 시도: ${endpoint}`);
          const fetchOptions = {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            },
            credentials: 'include'
          };
          
          console.log(`[DEBUG] Fetch 옵션:`, fetchOptions);
          
          const tempResponse = await fetch(endpoint, fetchOptions);
          console.log(`[DEBUG] ${endpoint} 응답 상태:`, tempResponse.status, tempResponse.statusText);
          
          if (tempResponse.ok) {
            // 응답 본문 미리 확인
            const clonedResponse = tempResponse.clone();
            const responseText = await clonedResponse.text();
            console.log(`[DEBUG] ${endpoint} 응답 본문:`, responseText.substring(0, 200) + '...');
            
            try {
              // JSON 파싱 시도
              responseData = JSON.parse(responseText);
              console.log(`[DEBUG] ${endpoint} 응답 데이터 형식:`, 
                Array.isArray(responseData) ? '배열' : typeof responseData);
              
              // 유효한 데이터인지 확인
              if (Array.isArray(responseData) && responseData.length > 0) {
                response = tempResponse;
                successEndpoint = endpoint;
                console.log(`[DEBUG] API 엔드포인트 성공: ${endpoint}, 데이터 개수: ${responseData.length}`);
                break;
              } else if (responseData && typeof responseData === 'object' && 
                        (responseData.schedules || responseData.data)) {
                response = tempResponse;
                successEndpoint = endpoint;
                console.log(`[DEBUG] API 엔드포인트 성공: ${endpoint}, 객체 형태 데이터`);
                break;
              } else {
                console.log(`[DEBUG] ${endpoint} 유효한 데이터 형식이 아님`);
              }
            } catch (jsonError) {
              console.log(`[DEBUG] ${endpoint} JSON 파싱 오류:`, jsonError.message);
            }
          } else {
            console.log(`[DEBUG] ${endpoint} 응답 실패: ${tempResponse.status} ${tempResponse.statusText}`);
          }
        } catch (endpointError) {
          console.log(`[DEBUG] API 엔드포인트 실패: ${endpoint}`, endpointError.message);
        }
      }
      
      if (!response || !response.ok) {
        console.log('[DEBUG] 모든 API 엔드포인트 실패, 샘플 데이터 사용');
        
        // 샘플 일정 데이터 생성
        const sampleSchedules = generateSampleSchedules();
        allCommitteeSchedules = sampleSchedules;
        window.allCommitteeSchedules = sampleSchedules;
        schedulesLoaded = true;
        
        // 로컬 스토리지에 일정 데이터 저장
        localStorage.setItem('calendar_schedules', JSON.stringify(sampleSchedules));
        
        // 현재 월에 맞게 필터링
        filterSchedulesByMonth(selectedMonth, selectedYear);
        
        // UI 업데이트
        renderCommitteeSchedules();
        
        isLoadingSchedules = false;
        return;
      }
      
      console.log(`[DEBUG] API 응답 상태: ${response.status} ${response.statusText} (${successEndpoint})`);
      
      const schedules = await response.json();
      console.log('[DEBUG] API에서 가져온 일정 데이터:', Array.isArray(schedules) ? schedules.length : 'N/A', '개');
      
      // 응답 형식 확인 및 처리
      let processedSchedules = [];
      
      if (Array.isArray(schedules)) {
        processedSchedules = schedules;
      } else if (schedules && schedules.status === 'success' && Array.isArray(schedules.schedules)) {
        processedSchedules = schedules.schedules;
      } else if (schedules && typeof schedules === 'object') {
        console.log('[DEBUG] 응답이 배열이 아닌 객체 형태임, 데이터 구조 확인:', Object.keys(schedules));
        // 객체 내부에서 일정 배열 찾기 시도
        for (const key of Object.keys(schedules)) {
          if (Array.isArray(schedules[key])) {
            processedSchedules = schedules[key];
            console.log(`[DEBUG] 객체 내 배열 데이터 발견: ${key}, 항목 수: ${processedSchedules.length}`);
            break;
          }
        }
      }
      
      // 일정 데이터 저장
      allCommitteeSchedules = processedSchedules;
      window.allCommitteeSchedules = processedSchedules;
      schedulesLoaded = true;
      
      // 로컬 스토리지에 일정 데이터 저장
      localStorage.setItem('calendar_schedules', JSON.stringify(processedSchedules));
      
      // 현재 월에 맞게 일정 필터링
      filterSchedulesByMonth(selectedMonth, selectedYear);
      
      // 일정 목록 렌더링
      renderCommitteeSchedules();
    } catch (apiError) {
      console.error('[DEBUG] 일정 데이터 API 호출 중 오류:', apiError);
      
      // API 호출 실패 시 로컬 스토리지의 데이터를 다시 확인
      console.log('[DEBUG] API 호출 실패, 로컬 스토리지 데이터 재확인');
      
      // 로컬 스토리지에서 일정 데이터 다시 확인
      const savedSchedules = localStorage.getItem('calendar_schedules');
      
      if (savedSchedules) {
        try {
          const parsedSchedules = JSON.parse(savedSchedules);
          if (parsedSchedules && parsedSchedules.length > 0) {
            console.log(`[DEBUG] 로컬 스토리지에서 ${parsedSchedules.length}개의 일정 다시 가져옴`);
            
            allCommitteeSchedules = parsedSchedules;
            window.allCommitteeSchedules = parsedSchedules;
            schedulesLoaded = true;
            
            // 현재 월에 맞게 필터링
            filterSchedulesByMonth(selectedMonth, selectedYear);
            
            // UI 업데이트
            renderCommitteeSchedules();
            return;
          }
        } catch (e) {
          console.error('[DEBUG] 로컬 스토리지 일정 데이터 파싱 오류:', e);
        }
      }
      
      // 로컬 스토리지에도 데이터가 없는 경우 샘플 데이터 생성
      console.log('[DEBUG] 샘플 일정 데이터 생성');
      
      const sampleSchedules = generateSampleSchedules();
      
      // 일정 데이터 저장
      allCommitteeSchedules = sampleSchedules;
      window.allCommitteeSchedules = sampleSchedules;
      schedulesLoaded = true;
      
      // 로컬 스토리지에 일정 데이터 저장
      localStorage.setItem('calendar_schedules', JSON.stringify(sampleSchedules));
      
      // 현재 월에 맞게 일정 필터링
      filterSchedulesByMonth(selectedMonth, selectedYear);
      
      // 일정 목록 렌더링
      renderCommitteeSchedules();
    }
  } catch (error) {
    console.error('일정 데이터 로드 중 오류:', error);
    
    // 오류 발생 시 빈 배열로 초기화
    allCommitteeSchedules = [];
    filteredSchedules = [];
    
    // 일정 목록 렌더링 (빈 목록)
    renderCommitteeSchedules();
  } finally {
    isLoadingSchedules = false;
  }
};

// 월별로 일정 필터링
const filterSchedulesByMonth = (month, year) => {
  selectedMonth = month;
  selectedYear = year;
  
  console.log(`[DEBUG] 일정 필터링: ${year}년 ${month + 1}월, 총 ${allCommitteeSchedules.length}개 일정`);
  
  // 날짜 형식 처리 개선
  const filteredSchedules = allCommitteeSchedules.filter(schedule => {
    try {
      // 날짜 값이 없는 경우 건너뛰
      if (!schedule.date && !schedule.visitDate) {
        console.log(`[DEBUG] 날짜 값이 없는 일정 건너뛰:`, schedule);
        return false;
      }
      
      // 날짜 문자열을 Date 객체로 변환
      let dateStr = schedule.date || schedule.visitDate;
      let scheduleDate;
      
      // 날짜 형식 확인 및 처리
      if (dateStr instanceof Date) {
        scheduleDate = dateStr;
      } else if (typeof dateStr === 'string') {
        // YYYY-MM-DD 형식인지 확인
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          scheduleDate = new Date(dateStr);
        } else {
          // 다른 형식의 날짜 문자열 처리
          scheduleDate = new Date(dateStr);
        }
      } else {
        console.log(`[DEBUG] 지원되지 않는 날짜 형식:`, dateStr);
        return false;
      }
      
      // 유효한 날짜인지 확인
      if (isNaN(scheduleDate.getTime())) {
        console.log(`[DEBUG] 유효하지 않은 날짜:`, dateStr);
        return false;
      }
      
      // 월/년 일치 여부 확인
      const matchesMonth = scheduleDate.getMonth() === month;
      const matchesYear = scheduleDate.getFullYear() === year;
      
      if (matchesMonth && matchesYear) {
        console.log(`[DEBUG] 일정 포함: ${scheduleDate.toISOString().split('T')[0]} (${schedule.committeeName} - ${schedule.organizationName || schedule.orgName})`);
      }
      
      return matchesMonth && matchesYear;
    } catch (e) {
      console.error(`[DEBUG] 일정 필터링 중 오류:`, e);
      return false;
    }
  });
  
  // 필터링된 일정을 전역 변수에 저장
  window.filteredSchedules = filteredSchedules;
  
  console.log(`[DEBUG] 필터링 결과: ${filteredSchedules.length}개 일정 해당`);
  
  // 위원 기준으로 그룹화
  const groupedSchedules = {};
  
  // 위원별 일정 그룹화 및 색상 지정
  window.committeeGroups = {};
  
  filteredSchedules.forEach(schedule => {
    const committeeName = schedule.committeeName || '미지정';
    
    // 그룹화된 일정 객체 초기화
    if (!window.committeeGroups[committeeName]) {
      window.committeeGroups[committeeName] = {
        schedules: [],
        color: getRandomColor()
      };
    }
    
    // 일정 추가
    window.committeeGroups[committeeName].schedules.push(schedule);
    
    // 이전 형식의 그룹화된 일정도 유지 (하위 호환성)
    if (!groupedSchedules[committeeName]) {
      groupedSchedules[committeeName] = [];
    }
    groupedSchedules[committeeName].push(schedule);
  });
  
  console.log('[DEBUG] 위원별 일정 그룹화 완료:', Object.keys(window.committeeGroups).length, '개 그룹');
  
  return groupedSchedules;
};

// 랜덤 색상 생성 함수
const getRandomColor = () => {
  const colors = [
    '#4299E1', // blue-500
    '#48BB78', // green-500
    '#ED8936', // orange-500
    '#9F7AEA', // purple-500
    '#F56565', // red-500
    '#667EEA', // indigo-500
    '#38B2AC', // teal-500
    '#ED64A6', // pink-500
    '#ECC94B', // yellow-500
    '#A0AEC0'  // gray-500
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// 일정 목록 렌더링
const renderCommitteeSchedules = () => {
  const scheduleContainer = document.getElementById('committee-schedules-container');
  if (!scheduleContainer) return;
  
  console.log('[DEBUG] renderCommitteeSchedules 호출됨');
  
  // 일정 데이터가 없는 경우 로컬 스토리지에서 다시 확인
  if (!window.allCommitteeSchedules || window.allCommitteeSchedules.length === 0) {
    try {
      const savedSchedules = localStorage.getItem('calendar_schedules');
      if (savedSchedules) {
        const parsedSchedules = JSON.parse(savedSchedules);
        if (parsedSchedules.length > 0) {
          console.log(`[DEBUG] 렌더링 전 로컬 스토리지에서 ${parsedSchedules.length}개의 일정 가져옴`);
          // 전역 변수에 데이터 저장
          window.allCommitteeSchedules = parsedSchedules;
          // 현재 월 필터링
          filterSchedulesByMonth(selectedMonth, selectedYear);
        }
      }
    } catch (e) {
      console.error('로컬 스토리지에서 일정 데이터 가져오기 실패:', e);
    }
  }
  
  // 필터링된 일정 데이터 확인
  console.log('[DEBUG] 필터링된 일정 데이터:', window.filteredSchedules);
  
  // 일정 데이터가 없는 경우 처리
  if (!window.filteredSchedules || window.filteredSchedules.length === 0) {
    console.log('[DEBUG] 필터링된 일정 데이터가 없습니다. 전체 일정 데이터:', window.allCommitteeSchedules);
    scheduleContainer.innerHTML = `
      <div class="bg-blue-50 p-4 rounded-lg text-center">
        <p class="text-blue-600">${selectedYear}년 ${selectedMonth + 1}월에 예정된 일정이 없습니다.</p>
      </div>
    `;
    return;
  }
  
  // 일정 데이터 확인
  if (!window.allCommitteeSchedules || window.allCommitteeSchedules.length === 0) {
    console.log('[DEBUG] 일정 데이터가 없습니다.');
    scheduleContainer.innerHTML = `
      <div class="bg-blue-50 p-4 rounded-lg text-center">
        <p class="text-blue-600">일정 데이터가 없습니다.</p>
      </div>
    `;
    return;
  }
  
  // 필터링된 일정 데이터 확인
  if (!window.filteredSchedules || window.filteredSchedules.length === 0) {
    console.log('[DEBUG] 필터링된 일정 데이터가 없습니다. 필터링을 다시 시도합니다.');
    // 필터링 다시 시도
    filterSchedulesByMonth(selectedMonth, selectedYear);
    
    // 여전히 없는 경우
    if (!window.filteredSchedules || window.filteredSchedules.length === 0) {
      scheduleContainer.innerHTML = `
        <div class="bg-blue-50 p-4 rounded-lg text-center">
          <p class="text-blue-600">${selectedYear}년 ${selectedMonth + 1}월에 예정된 일정이 없습니다.</p>
        </div>
      `;
      return;
    }
  }
  
  // 일정 데이터 직접 그룹화
  const committeeGroups = {};
  
  // 일정 데이터를 위원별로 그룹화
  window.filteredSchedules.forEach(schedule => {
    const committeeName = schedule.committeeName || '미지정';
    
    if (!committeeGroups[committeeName]) {
      committeeGroups[committeeName] = {
        schedules: [],
        color: getRandomColor()
      };
    }
    
    committeeGroups[committeeName].schedules.push(schedule);
  });
  
  // 전역 변수에 저장
  window.committeeGroups = committeeGroups;
  
  // 표시할 위원이 있는지 확인
  const committeeCount = Object.keys(committeeGroups).length;
  
  console.log(`[DEBUG] 렌더링할 위원 수: ${committeeCount}, 일정 그룹:`, committeeGroups);
  
  if (committeeCount === 0) {
    scheduleContainer.innerHTML = `
      <div class="bg-blue-50 p-4 rounded-lg text-center">
        <p class="text-blue-600">${selectedYear}년 ${selectedMonth + 1}월에 예정된 일정이 없습니다.</p>
      </div>
    `;
    return;
  }
  
  // 기관명과 코드 매핑 테이블 생성
  const orgNameToCodeMap = {};
  const orgCodeToNameMap = {};
  
  // 매칭 데이터에서 기관명-코드 매핑 추출
  if (window.allMatchings && Array.isArray(window.allMatchings)) {
    window.allMatchings.forEach(match => {
      if (match.orgCode && match.orgName) {
        orgNameToCodeMap[match.orgName.trim()] = match.orgCode;
        orgCodeToNameMap[match.orgCode] = match.orgName.trim();
      }
    });
    console.log('[DEBUG] 기관명-코드 매핑 테이블 생성 완료:', Object.keys(orgNameToCodeMap).length);
  }
  
  // 부담당자 정보 로드
  let coCommitteeData = {};
  try {
    // 매칭 데이터를 확인 (window.allMatchings에서 가져오기)
    if (window.allMatchings && Array.isArray(window.allMatchings)) {
      console.log('매칭 데이터 처리 시작:', window.allMatchings.length);
      
      // 매칭 데이터 구조 로깅
      if (window.allMatchings.length > 0) {
        console.log('매칭 데이터 예시:', window.allMatchings[0]);
      }
      
      // 기관 코드별 담당자 정보 구성
      window.allMatchings.forEach(match => {
        // 기관 코드가 없으면 건너뜀
        if (!match.orgCode) return;
        
        if (!coCommitteeData[match.orgCode]) {
          coCommitteeData[match.orgCode] = {
            주담당: [],
            부담당: []
          };
        }
        
        // 위원 이름이 없으면 건너뜀
        if (!match.committeeName) return;
        
        // 역할 필드 값 처리 - 대소문자 및 공백 처리
        const roleValue = (match.role || '').toString().trim().toLowerCase();
        
        // 역할에 따라 주담당/부담당 구분
        if (roleValue === '주담당' || roleValue === 'main' || roleValue === '주') {
          if (!coCommitteeData[match.orgCode].주담당.includes(match.committeeName)) {
            coCommitteeData[match.orgCode].주담당.push(match.committeeName);
          }
        } else {
          // 역할이 주담당이 아니면 부담당으로 처리
          if (!coCommitteeData[match.orgCode].부담당.includes(match.committeeName)) {
            coCommitteeData[match.orgCode].부담당.push(match.committeeName);
          }
        }
        
        // 매칭 데이터 처리
      });
      
      // 처리된 매칭 데이터 준비 완료
    } else {
      console.log('매칭 데이터를 찾을 수 없습니다. 부담당자 정보를 표시할 수 없습니다.');
      // 매칭 데이터가 없을 경우 빈 객체 초기화
      window.allMatchings = [];
    }
  } catch (err) {
    console.error('부담당자 데이터 로드 중 오류:', err);
    // 오류 발생 시 빈 객체 초기화
    window.allMatchings = [];
  }
  
  // 특별 구분할 기관 목록 정의
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
  
  // 위원별 일정 목록 생성
  let schedulesHTML = '';
  
  // 위원 이름을 정렬 
  Object.keys(committeeGroups).forEach(committeeName => {
    const committeeData = committeeGroups[committeeName];
    if (!committeeData || !committeeData.schedules || committeeData.schedules.length === 0) {
      console.log(`[DEBUG] ${committeeName} 위원의 일정이 없습니다.`);
      return;
    }
    
    const committeeSchedules = committeeData.schedules;
    console.log(`[DEBUG] ${committeeName} 위원의 일정 ${committeeSchedules.length}개 처리 시작`);
    
    // 위원별 색상 사용
    const committeeColor = committeeData.color || '#4299E1';
    
    schedulesHTML += `
      <div class="bg-white p-4 rounded-lg shadow-sm mb-4" style="border-top: 4px solid ${committeeColor};">
        <div class="flex justify-between items-center mb-2">
          <h3 class="text-lg font-medium" style="color: ${committeeColor};">
            <span style="border-left: 3px solid ${committeeColor}; padding-left: 8px;">
              ${committeeName} 위원
            </span>
          </h3>
          <span class="text-sm text-gray-500">총 ${committeeSchedules.length}건의 일정</span>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead style="background-color: ${committeeColor}10">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">방문일</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시간</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">기관명</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">담당자</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">부담당자</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">메모</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
    `;
    
    // 각 위원의 일정을 기관별로 그룹화한 다음 각 기관 내에서는 날짜순 정렬
    const orgSchedules = {};
    
    // 기관별로 그룹화
    committeeSchedules.forEach(schedule => {
      const orgName = schedule.organizationName || schedule.orgName || '미지정';
      if (!orgSchedules[orgName]) {
        orgSchedules[orgName] = [];
      }
      orgSchedules[orgName].push(schedule);
    });
    
    // 각 기관별 일정을 날짜순으로 정렬
    Object.keys(orgSchedules).forEach(orgName => {
      orgSchedules[orgName].sort((a, b) => {
        const dateA = new Date(a.date || a.visitDate);
        const dateB = new Date(b.date || b.visitDate);
        return dateA - dateB;
      });
    });
    
    // 특별 관리 기관을 먼저 정렬하고, 나머지는 기관명 알파벳 순으로 정렬
    const specialOrgs = [
      '진주노인통합지원센터',
      '함안군재가노인통합지원센터',
      '창녕군새누리노인통합지원센터',
      '효능원노인통합지원센터',
      '진해서부노인종합복지관'
    ];
    
    const sortedOrgNames = Object.keys(orgSchedules).sort((a, b) => {
      const isSpecialA = specialOrgs.some(special => a.includes(special));
      const isSpecialB = specialOrgs.some(special => b.includes(special));
      
      if (isSpecialA && !isSpecialB) return -1;
      if (!isSpecialA && isSpecialB) return 1;
      return a.localeCompare(b);
    });
    
    // 기관별로 정렬된 순서대로 일정 표시
    sortedOrgNames.forEach(orgName => {
      orgSchedules[orgName].forEach(schedule => {
      const scheduleDate = new Date(schedule.date || schedule.visitDate);
      const formattedDate = `${scheduleDate.getFullYear()}-${String(scheduleDate.getMonth() + 1).padStart(2, '0')}-${String(scheduleDate.getDate()).padStart(2, '0')}`;
      
      // 시작/종료 시간 형식화
      const startTime = schedule.startTime || '미지정';
      const endTime = schedule.endTime || '미지정';
      const timeDisplay = startTime === '미지정' ? '미지정' : `${startTime} ~ ${endTime}`;
      
      // 일정 상태에 따른 스타일 설정
      let statusClass = 'bg-gray-100 text-gray-600';
      let statusText = '예정';
      
      if (schedule.status === 'completed') {
        statusClass = 'bg-green-100 text-green-800';
        statusText = '완료';
      } else if (schedule.status === 'canceled') {
        statusClass = 'bg-red-100 text-red-800';
        statusText = '취소';
      } else if (new Date(formattedDate) < new Date()) {
        // 지난 날짜인데 상태가 업데이트되지 않은 경우
        statusClass = 'bg-yellow-100 text-yellow-800';
        statusText = '미확인';
      }
      
      // 기관 정보 가져오기
      const orgName = schedule.organizationName || schedule.orgName || '미지정';
      const orgCode = schedule.orgCode; // 일정 데이터의 기관 코드
      
      // 특별 기관 확인
      const isSpecial = isSpecialOrganization(orgName);
      
      // 기관명으로 매칭 코드 찾기
      let matchingCode = schedule.orgCode || '';
      if (!matchingCode && orgName) {
        matchingCode = orgNameToCodeMap[orgName.trim()] || '';
        if (matchingCode) {
          console.log(`기관명 '${orgName}'에 대한 코드를 찾았습니다: ${matchingCode}`);
        }
      }
      console.log(`기관 매칭 정보 - 기관명: ${orgName}, 매칭코드: ${matchingCode || '없음'}`);
      
      // 부담당자 정보 가져오기
      let coCommitteeDisplay = '-';
      
      // 매칭코드가 있는 경우에만 부담당자 정보 표시
      if (matchingCode && coCommitteeData[matchingCode]) {
        // 부담당자 정보 가져오기
        const coCommittees = coCommitteeData[matchingCode].부담당 || [];
        if (coCommittees.length > 0) {
          // 부담당자가 있는 경우
          coCommitteeDisplay = `
            <span class="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs font-medium">
              ${coCommittees.join(', ')}
            </span>
          `;
          console.log(`기관명 '${orgName}'에 대한 부담당자 정보 찾음: ${coCommittees.join(', ')}`);
        } else if (coCommitteeData[matchingCode].주담당 && coCommitteeData[matchingCode].주담당.length > 0) {
          // 부담당자가 없지만 주담당자가 있는 경우
          coCommitteeDisplay = `
            <span class="bg-green-50 text-green-600 px-2 py-1 rounded text-xs font-medium">
              ${coCommitteeData[matchingCode].주담당.join(', ')} (주담당)
            </span>
          `;
          console.log(`기관명 '${orgName}'에 대한 주담당자 정보 찾음: ${coCommitteeData[matchingCode].주담당.join(', ')}`);
        } else {
          // 담당자 정보가 없는 경우
          coCommitteeDisplay = '-';
          console.log(`기관명 '${orgName}'에 대한 담당자 정보 없음`);
        }
      } else {
        // 매칭코드가 없는 경우
        coCommitteeDisplay = '-';
        console.log(`기관명 '${orgName}'에 대한 매칭코드가 없어 담당자 정보를 표시할 수 없음`);
      }
      // 이미 위에서 처리했으므로 중복 코드 제거
      
      // 디버깅용 로그
      console.log(`기관 매칭 정보 - 기관명: ${orgName}, 매칭코드: ${matchingCode || '없음'}`);
      
      
      // 날짜 클릭 이벤트를 위한 데이터 속성 추가
      // 특별 기관인 경우 다른 배경색 적용
      const rowStyle = isSpecial 
        ? `background-color: #fff9c2;` 
        : `background-color: ${committeeColor}05;`;
      
      // 특별 기관에 대한 추가 스타일
      const orgNameStyle = isSpecial 
        ? `font-weight: 600; color: #b45309; border-left: 3px solid #f59e0b; padding-left: 6px;` 
        : `color: #374151;`;
      
      // 특별 기관 아이콘
      const specialIcon = isSpecial 
        ? `<svg class="inline-block h-4 w-4 mr-1 text-amber-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clip-rule="evenodd"></path></svg>` 
        : ``;
      
      schedulesHTML += `
        <tr class="hover:bg-gray-50 cursor-pointer" onclick="goToCalendarView('${formattedDate}')" style="${rowStyle}">
          <td class="px-4 py-2 whitespace-nowrap text-sm text-blue-600 underline">${formattedDate}</td>
          <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${timeDisplay}</td>
          <td class="px-4 py-2 whitespace-nowrap text-sm" style="${orgNameStyle}">
            ${specialIcon}${orgName}
            ${isSpecial ? '<span class="ml-1 text-xs text-amber-600 bg-amber-50 px-1 rounded">특별관리</span>' : ''}
          </td>
          <td class="px-4 py-2 whitespace-nowrap text-sm">
            <span class="px-2 py-1 rounded text-xs font-medium" 
                  style="background-color: ${committeeColor}20; 
                        color: ${committeeColor}; 
                        border: 1px solid ${committeeColor}40;">
              ${schedule.committeeName || '미지정'}
            </span>
          </td>
          <td class="px-4 py-2 whitespace-nowrap text-sm">
            ${coCommitteeDisplay}
          </td>
          <td class="px-4 py-2 whitespace-nowrap">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
              ${statusText}
            </span>
          </td>
          <td class="px-4 py-2 text-sm text-gray-900">${schedule.notes || schedule.memo || '-'}</td>
        </tr>
      `;
      });
    });
    
    // 테이블 닫는 태그 추가
    schedulesHTML += `
            </tbody>
          </table>
        </div>
      </div>
    `;
  });
  
  // 컨테이너에 HTML 삽입
  scheduleContainer.innerHTML = schedulesHTML;
  
  // 날짜 클릭 시 달력뷰로 이동하는 함수 추가
  window.goToCalendarView = (dateString) => {
    // 날짜 저장
    localStorage.setItem('calendar_target_date', dateString);
    localStorage.setItem('calendar_from_report', 'true');
    
    // 달력 페이지로 이동
    window.location.href = '/calendar';
  };

// 달력뷰에서 일정 변경 이벤트 발생 시 재로드하는 이벤트 리스너 추가
document.addEventListener('masterDashboardDataUpdated', (event) => {
  console.log('마스터 대시보드 데이터 업데이트 감지, 일정 다시 로드');
  
  if (event.detail && event.detail.type && event.detail.data) {
    const updateType = event.detail.type;
    const scheduleData = event.detail.data;
    
    console.log(`일정 이벤트 유형: ${updateType}, 데이터:`, scheduleData);
    
    // 이벤트 유형에 따라 처리
    if (updateType === 'delete') {
      console.log(`ID가 ${scheduleData.id}인 일정 삭제 처리`);
      
      // 로컬 데이터에서 해당 일정 삭제
      allCommitteeSchedules = allCommitteeSchedules.filter(schedule => 
        schedule.id !== scheduleData.id
      );
      
      // 필터링된 일정도 업데이트
      filterSchedulesByMonth(selectedMonth, selectedYear);
      
      // UI 즉시 업데이트
      renderCommitteeSchedules();
    } else if (updateType === 'update' && scheduleData.schedules) {
      console.log(`일정 데이터 업데이트 처리: ${scheduleData.schedules.length}개 일정`);
      
      // 전체 일정 데이터 업데이트
      allCommitteeSchedules = scheduleData.schedules;
      window.allCommitteeSchedules = scheduleData.schedules;
      
      // 필터링된 일정도 업데이트
      filterSchedulesByMonth(selectedMonth, selectedYear);
      
      // UI 즉시 업데이트
      renderCommitteeSchedules();
    }
  } else {
    // 세부 정보가 없는 경우 전체 데이터 다시 로드
    console.log('일정 데이터 전체 다시 로드');
    loadCommitteeSchedules();
  }
});
}; // End of renderCommitteeSchedules function
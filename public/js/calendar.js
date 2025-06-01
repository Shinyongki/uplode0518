// 캘린더 관련 JavaScript 코드
(function() {
  // 전역 변수 선언
  let currentYear, currentMonth, currentDate;
  let schedules = [];
  let committees = [];
  let organizations = [];
  let currentUser = null;
  let nextScheduleId = 1;
  let isDataLoading = false;
  let committeeMap = {};
  let organizationMap = {};
  let committeeOrgMatchings = []; // 추가: 매칭 정보를 저장할 변수

  // 로컬 스토리지 키 상수
  const LOCAL_STORAGE_SCHEDULES_KEY = 'calendar_schedules';
  const LOCAL_STORAGE_LAST_UPDATE_KEY = 'calendar_last_update';

  // 디버깅 도구
  const CalendarDebugger = {
    errors: [],
    warnings: [],
    info: [],
    
    log: function(message, type = 'info', data = null) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] ${type.toUpperCase()}: `;
      console.log(prefix + message);
      
      if (data) {
        if (type === 'error') {
          console.error('데이터:', data);
        } else {
          console.log('데이터:', data);
        }
      }
      
      if (message.includes('종합보고서')) {
        console.log('%c' + message, 'background: #e3f2fd; color: #0d47a1; padding: 2px 5px; border-radius: 3px;');
        if (data) {
          console.log('%c종합보고서 데이터:', 'background: #e3f2fd; color: #0d47a1; padding: 2px 5px; border-radius: 3px;', data);
        }
      }
      
      const logEntry = { timestamp, message };
      
      if (type === 'error') {
        this.errors.push(logEntry);
      } else if (type === 'warning') {
        this.warnings.push(logEntry);
      } else {
        this.info.push(logEntry);
      }
    },
    
    checkElement: function(selector, description) {
      const element = document.querySelector(selector);
      if (!element) {
        this.log(`${description} (${selector}) 요소를 찾을 수 없습니다`, 'error');
        return false;
      }
      this.log(`${description} (${selector}) 요소 확인 성공`, 'info');
      return true;
    },
    
    printStatus: function() {
      console.group('현재 캘린더 상태');
      console.log('오류가 발생했나요?', this.errors.length > 0 ? '예' : '아니오');
      
      if (this.errors.length > 0) {
        console.group('발생한 오류들');
        this.errors.forEach(e => console.log(`- ${e.message}`));
        console.groupEnd();
      }
      
      console.groupEnd();
    }
  };

  // 기본 인증 헤더 가져오기 함수
  function getAuthHeaders() {
    try {
      if (typeof window.getAuthHeaders === 'function') {
        return window.getAuthHeaders();
      }
      
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '';
      let authHeaders = {};
      
      if (token) {
        authHeaders = {
          'Authorization': `Bearer ${token}`
        };
      }
      
      authHeaders = {
        ...authHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      };
      
      return authHeaders;
    } catch (error) {
      console.warn('인증 헤더 가져오기 오류:', error);
      
      return {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      };
    }
  }

  // 위원 색상 가져오기 함수
  function getCommitteeColor(committeeIdOrName) {
    // 위원별 고유한 색상 매핑 (이름 기반)
    const committeeColorMap = {
      '신용기': '#3498db',  // 파란색
      '김지영': '#e74c3c',  // 빨간색
      '김성우': '#2ecc71',  // 초록색
      '김선영': '#f39c12',  // 주황색
      '김지혜': '#9b59b6',  // 보라색
      '이정혜': '#1abc9c',  // 청록색
      '박지영': '#d35400',  // 강한 주황색
      '박지훈': '#8e44ad',  // 진한 보라색
      '박진영': '#27ae60',  // 진한 초록색
      '박진우': '#2980b9',  // 진한 파란색
      '박희영': '#c0392b',  // 진한 빨간색
      '박희우': '#16a085'   // 진한 청록색
    };
    
    // 기본 색상 배열 (매핑에 없는 위원용)
    const defaultColors = [
      '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c',
      '#d35400', '#8e44ad', '#27ae60', '#2980b9', '#c0392b', '#16a085'
    ];
    
    // 위원 ID나 이름으로 색상 찾기
    if (typeof committeeIdOrName === 'string' && committeeColorMap[committeeIdOrName]) {
      return committeeColorMap[committeeIdOrName];
    }
    
    // 위원 이름 찾기 시도
    const committees = window.committees || [];
    const committee = committees.find(c => c.id === committeeIdOrName || c.name === committeeIdOrName);
    
    if (committee && committee.name && committeeColorMap[committee.name]) {
      return committeeColorMap[committee.name];
    }
    
    // 색상 매핑에 없는 경우 기본 색상 배열에서 가져오기
    const hash = String(committeeIdOrName).split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);
    
    return defaultColors[hash % defaultColors.length] || defaultColors[0];
  }
  
  // 전역 함수로 showScheduleDetail 노출
  window.showScheduleDetail = function(scheduleId) {
    if (window.calendarApp && typeof window.calendarApp.showScheduleDetail === 'function') {
      window.calendarApp.showScheduleDetail(scheduleId);
    } else {
      console.error('캘린더 앱이 초기화되지 않았거나 showScheduleDetail 함수를 찾을 수 없습니다.');
    }
  };
  
  // 전역 함수로 openScheduleFormModal 노출
  window.openScheduleFormModal = function(dateString, scheduleId = null) {
    console.log('전역 openScheduleFormModal 호출:', dateString, scheduleId);
    
    try {
      // 직접 모달 열기 (전역 함수를 항상 사용)
      const modal = document.getElementById('schedule-form-modal');
      const form = document.getElementById('schedule-form');
      const dateInput = document.getElementById('schedule-date');
      const scheduleIdInput = document.getElementById('schedule-id');
      const committeeSelect = document.getElementById('schedule-committee');
      const organizationSelect = document.getElementById('schedule-organization');
      
      if (!modal || !form || !dateInput || !committeeSelect || !organizationSelect) {
        console.error('필수 모달 요소를 찾을 수 없습니다:', {
          modal: !!modal,
          form: !!form,
          dateInput: !!dateInput,
          committeeSelect: !!committeeSelect,
          organizationSelect: !!organizationSelect
        });
        
        // 캘린더 앱이 초기화되었을 경우 대체 호출
        if (window.calendarApp && typeof window.calendarApp.openScheduleFormModal === 'function') {
          window.calendarApp.openScheduleFormModal(dateString, scheduleId);
        }
        return;
      }
      
      // 모든 모달 닫기
      document.querySelectorAll('.modal').forEach(m => {
        m.style.display = 'none';
      });
      
      // 폼 초기화
      form.reset();
      
      // 날짜 입력 필드 값 설정
      dateInput.value = dateString;
      
      // 일정 ID 설정 (수정 모드인 경우)
      if (scheduleId) {
        scheduleIdInput.value = scheduleId;
        document.getElementById('schedule-form-title').textContent = '일정 수정';
        
        // 기존 일정 정보 불러오기
        console.log('기존 일정 정보 불러오기 시도:', scheduleId);
        const existingSchedule = window.schedules ? window.schedules.find(s => s.id == scheduleId) : null;
        
        if (existingSchedule) {
          console.log('기존 일정 정보 찾음:', existingSchedule);
          
          // 시간 설정
          if (existingSchedule.startTime) {
            document.getElementById('schedule-start-time').value = existingSchedule.startTime;
          }
          if (existingSchedule.endTime) {
            document.getElementById('schedule-end-time').value = existingSchedule.endTime;
          }
          
          // 제목 설정
          if (existingSchedule.title) {
            document.getElementById('schedule-title').value = existingSchedule.title;
          }
          
          // 내용 설정
          if (existingSchedule.content) {
            document.getElementById('schedule-content').value = existingSchedule.content;
          }
          
          // 위원 및 기관 정보는 loadCommitteeData 함수가 완료된 후 설정
          window.existingScheduleToLoad = existingSchedule;
        } else {
          console.warn('기존 일정 정보를 찾을 수 없음:', scheduleId);
          window.existingScheduleToLoad = null;
        }
      } else {
        scheduleIdInput.value = '';
        document.getElementById('schedule-form-title').textContent = '일정 추가';
        window.existingScheduleToLoad = null;
      }
      
      // 기관 정보 가져오기 함수
    console.log('위원 정보 가져오기 시작');
    
    // 위원 선택 변경 시 기관 목록 업데이트
    committeeSelect.addEventListener('change', function() {
      const selectedCommitteeId = committeeSelect.value;
      const selectedCommitteeName = committeeSelect.options[committeeSelect.selectedIndex]?.text || '';
      console.log('위원 선택 변경 감지:', selectedCommitteeId, selectedCommitteeName);
      
      // 위원에 맞는 기관 코드 추출
      const matchedOrgCodes = [];
      
      if (window.allMatchings && Array.isArray(window.allMatchings)) {
        window.allMatchings.forEach(match => {
          // 위원 ID나 위원명으로 매칭 확인
          const matchCommitteeId = match.committeeId || match['위원ID'] || '';
          const matchCommitteeName = match.committeeName || match['위원명'] || '';
          const orgCode = match.orgCode || match['기관코드'] || '';
          
          // 위원 ID 또는 위원명이 일치하는 경우 기관 코드 추가
          if (((matchCommitteeId && matchCommitteeId === selectedCommitteeId) || 
              (matchCommitteeName && matchCommitteeName === selectedCommitteeName)) && 
              orgCode && !matchedOrgCodes.includes(orgCode)) {
            matchedOrgCodes.push(orgCode);
          }
        });
      }
      
      console.log('위원에 매칭된 기관 코드:', matchedOrgCodes);
      
      // 기관 선택 초기화
      organizationSelect.innerHTML = '<option value="">기관 선택</option>';
      
      // 매칭된 기관만 표시
      if (matchedOrgCodes.length > 0) {
        // 기관 정보 추출
        const orgSet = new Set();
        
        window.allMatchings.forEach(match => {
          const orgCode = match.orgCode || match['기관코드'] || '';
          const orgName = match.orgName || match['기관명'] || '';
          const region = match.region || match['지역'] || '';
          
          if (orgCode && orgName && matchedOrgCodes.includes(orgCode)) {
            orgSet.add(JSON.stringify({
              code: orgCode,
              name: orgName,
              region: region
            }));
          }
        });
        
        // 기관 정보 변환 및 정렬
        const organizations = Array.from(orgSet)
          .map(org => JSON.parse(org))
          .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        
        // 기관 정보 추가
        organizations.forEach(org => {
          const option = document.createElement('option');
          option.value = org.code;
          option.textContent = org.region ? `${org.name} (${org.region})` : org.name;
          organizationSelect.appendChild(option);
        });
        
        console.log('위원에 매칭된 기관 추가 완료:', organizations.length);
      } else {
        console.log('위원에 매칭된 기관이 없어 기본 기관 데이터 사용');
        addDefaultOrganizations();
      }
    });
    
    // 위원 정보 가져오기 함수
    function loadCommitteeData() {
        // window.allMatchings에서 위원 정보 추출
        if (window.allMatchings && window.allMatchings.length > 0) {
          console.log('window.allMatchings에서 위원 정보 추출 시도');
          const committeeSet = new Set();
          const committeeMap = new Map(); // 위원명과 ID 매핑을 위한 맵
          
          window.allMatchings.forEach(match => {
            // 영문 필드명 데이터 형식
            if (match.committeeName) {
              committeeSet.add(match.committeeName);
              if (match.committeeId) {
                committeeMap.set(match.committeeName, match.committeeId);
              }
            }
            
            // 한글 필드명 데이터 형식
            if (match.위원명) {
              committeeSet.add(match.위원명);
              if (match.위원ID) {
                committeeMap.set(match.위원명, match.위원ID);
              }
            }
          });
          
          if (committeeSet.size > 0) {
            console.log(`window.allMatchings에서 ${committeeSet.size}개의 위원 정보 추출 성공`);
            
            // 위원 정보 추가 (정렬하여 추가)
            Array.from(committeeSet).sort((a, b) => a.localeCompare(b, 'ko')).forEach((name, index) => {
              const option = document.createElement('option');
              const id = committeeMap.get(name) || `C${String(index + 1).padStart(3, '0')}`;
              
              option.value = id;
              option.textContent = name;
              committeeSelect.appendChild(option);
            });
            
            // 기존 일정이 있는 경우 위원 선택
            if (window.existingScheduleToLoad) {
              console.log('기존 일정 정보 불러오기:', window.existingScheduleToLoad);
              
              // 위원 ID나 위원명으로 선택
              if (window.existingScheduleToLoad.committeeId || window.existingScheduleToLoad.committeeName) {
                const committeeId = window.existingScheduleToLoad.committeeId || '';
                const committeeName = window.existingScheduleToLoad.committeeName || '';
                
                console.log('기존 일정의 위원 정보:', committeeId, committeeName);
                
                // 위원 ID로 먼저 시도
                let found = false;
                if (committeeId) {
                  for (let i = 0; i < committeeSelect.options.length; i++) {
                    if (committeeSelect.options[i].value === committeeId) {
                      committeeSelect.selectedIndex = i;
                      console.log('위원 ID로 선택 완료:', committeeSelect.options[i].text);
                      found = true;
                      break;
                    }
                  }
                }
                
                // 위원 ID로 찾지 못하면 위원명으로 시도
                if (!found && committeeName) {
                  for (let i = 0; i < committeeSelect.options.length; i++) {
                    if (committeeSelect.options[i].text === committeeName) {
                      committeeSelect.selectedIndex = i;
                      console.log('위원명으로 선택 완료:', committeeSelect.options[i].text);
                      found = true;
                      break;
                    }
                  }
                }
                
                // 위원 선택 변경 이벤트 수동 호출
                if (found) {
                  const changeEvent = new Event('change');
                  committeeSelect.dispatchEvent(changeEvent);
                }
              }
              
              // 기관 정보 업데이트 후 지연을 두고 기관 선택
              setTimeout(() => {
                if (window.existingScheduleToLoad && (window.existingScheduleToLoad.orgCode || window.existingScheduleToLoad.organizationCode)) {
                  const orgCode = window.existingScheduleToLoad.orgCode || window.existingScheduleToLoad.organizationCode || '';
                  console.log('기존 일정의 기관 정보 설정:', orgCode);
                  
                  for (let i = 0; i < organizationSelect.options.length; i++) {
                    if (organizationSelect.options[i].value === orgCode) {
                      organizationSelect.selectedIndex = i;
                      console.log('기관 선택 완료:', organizationSelect.options[i].text);
                      break;
                    }
                  }
                }
              }, 500);
            }
            
            return true; // 성공적으로 위원 정보 추출
          }
        }
        
        // window.allMatchings에서 위원 정보를 찾을 수 없으면 API 시도
        if (window.api && window.api.committees && typeof window.api.committees.getMatching === 'function') {
          console.log('API를 통해 위원 정보 가져오기 시도');
          
          // API 호출 시도 (비동기 함수이미로 비동기적으로 처리하고 기본 데이터 추가)
          window.api.committees.getMatching()
            .then(response => {
              if (response && response.status === 'success' && response.data && response.data.matchings) {
                // 매칭 정보 저장
                console.log('API에서 가져온 매칭 정보 처리:', response.data.matchings.length + '개');
                
                // 위원 정보 추출
                const committeeSet = new Set();
                const committeeMap = new Map();
                
                response.data.matchings.forEach(item => {
                  if (item.위원명) {
                    committeeSet.add(item.위원명);
                    if (item.위원ID) {
                      committeeMap.set(item.위원명, item.위원ID);
                    }
                  }
                });
                
                // 위원 정보 추가
                if (committeeSet.size > 0) {
                  // 기존 옵션 삭제
                  committeeSelect.innerHTML = '<option value="">위원 선택</option>';
                  
                  Array.from(committeeSet).sort((a, b) => a.localeCompare(b, 'ko')).forEach((name, index) => {
                    const option = document.createElement('option');
                    const id = committeeMap.get(name) || `C${String(index + 1).padStart(3, '0')}`;
                    
                    option.value = id;
                    option.textContent = name;
                    committeeSelect.appendChild(option);
                  });
                  
                  console.log(`API에서 ${committeeSet.size}개의 위원 정보 추가 완료`);
                  
                  // 위원 변경 시 기관 정보 업데이트 이벤트 리스너 설정
                  committeeSelect.addEventListener('change', function() {
                    updateOrganizationOptions();
                  });
                  
                  // 기관 정보 가져오기
                  updateOrganizationOptions();
                  return true;
                }
              }
              
              // API에서 데이터를 가져오지 못한 경우 기본 데이터 사용
              console.warn('API에서 위원 정보를 찾을 수 없습니다. 기본 데이터 사용');
              addDefaultCommittees();
              
              // 위원 변경 시 기관 정보 업데이트 이벤트 리스너 설정
              committeeSelect.addEventListener('change', function() {
                updateOrganizationOptions();
              });
              
              // 기관 정보 가져오기
              updateOrganizationOptions();
              return false;
            })
            .catch(error => {
              console.error('API에서 위원 정보 가져오기 오류:', error);
              // 기본 위원 정보 추가
              addDefaultCommittees();
              
              // 위원 변경 시 기관 정보 업데이트 이벤트 리스너 설정
              committeeSelect.addEventListener('change', function() {
                updateOrganizationOptions();
              });
              
              // 기관 정보 가져오기
              updateOrganizationOptions();
              return false;
            });
          
          // 비동기 호출이미로 기본 데이터 추가하고 나중에 대체
          addDefaultCommittees();
          
          // 위원 변경 시 기관 정보 업데이트 이벤트 리스너 설정
          committeeSelect.addEventListener('change', function() {
            updateOrganizationOptions();
          });
          
          // 기관 정보 가져오기
          updateOrganizationOptions();
          return true;
        } else {
          console.warn('API 함수를 찾을 수 없습니다. 기본 데이터 사용');
          // 기본 위원 정보 추가
          addDefaultCommittees();
          
          // 위원 변경 시 기관 정보 업데이트 이벤트 리스너 설정
          committeeSelect.addEventListener('change', function() {
            updateOrganizationOptions();
          });
          
          // 기관 정보 가져오기
          updateOrganizationOptions();
          return false;
        }
      }
      
      // 위원 정보 가져오기 실행
      loadCommitteeData();
      
      // 위원 선택 이벤트 리스너 추가
      committeeSelect.addEventListener('change', function() {
        console.log('위원 선택 변경:', committeeSelect.value, committeeSelect.options[committeeSelect.selectedIndex]?.text);
        updateOrganizationOptions();
      });
      
      // 기본 위원 정보 추가 함수
      function addDefaultCommittees() {
        ['신용기', '김수연', '문일지', '이연숙', '이정혜'].forEach((name, index) => {
          const option = document.createElement('option');
          option.value = `C${String(index + 1).padStart(3, '0')}`;
          option.textContent = name;
          committeeSelect.appendChild(option);
        });
      }
      
      // 기관 정보 업데이트 함수
      function updateOrganizationOptions() {
        organizationSelect.innerHTML = '<option value="">기관 선택</option>';
        const selectedCommitteeName = committeeSelect.options[committeeSelect.selectedIndex]?.text || '';
        
        console.log('기관 정보 가져오기 시작, 선택된 위원명:', selectedCommitteeName);
        
        // window.allMatchings 디버깅
        console.log('window.allMatchings 데이터 확인:', window.allMatchings);
        
        // window.allMatchings에서 기관 정보 추출
        if (window.allMatchings && Array.isArray(window.allMatchings) && window.allMatchings.length > 0) {
          console.log('window.allMatchings에서 기관 정보 추출 시도, 데이터 개수:', window.allMatchings.length);
          
          // 첫 번째 항목 구조 확인
          if (window.allMatchings.length > 0) {
            console.log('첫 번째 매칭 데이터 구조:', JSON.stringify(window.allMatchings[0]));
          }
          
          const orgSet = new Set();
          const matchedOrgCodes = [];
          
          // 선택된 위원에 맞는 기관 코드 추출
          if (selectedCommitteeName) {
            console.log(`'${selectedCommitteeName}' 위원에 맞는 기관 코드 추출 시작`);
            
            // 선택된 위원의 ID 가져오기
            const selectedCommitteeId = committeeSelect.value || '';
            console.log(`선택된 위원 ID: ${selectedCommitteeId}`);
            
            window.allMatchings.forEach((match, index) => {
              // 데이터 구조 확인
              const committeeName = match.committeeName || match["위원명"] || '';
              const committeeId = match.committeeId || match["위원ID"] || '';
              const orgCode = match.orgCode || match["기관코드"] || '';
              const orgName = match.orgName || match["기관명"] || '';
              
              // 디버깅 로그 줄이기
              if (index < 5) {
                console.log(`매칭[${index}] - 위원명: '${committeeName}', 위원ID: '${committeeId}', 기관코드: '${orgCode}', 기관명: '${orgName}'`);
              }
              
              // 위원명과 위원ID 두 가지 방식으로 매칭 확인
              const nameMatches = committeeName === selectedCommitteeName;
              const idMatches = committeeId && selectedCommitteeId && committeeId === selectedCommitteeId;
              
              // 역할 확인 (신용기 위원은 주담당만 표시)
              const role = match.role || match["역할"] || match["담당유형"] || '';
              const isPrimaryRole = role === '주담당';
              
              // 모든 위원에 대해 주담당 기관만 표시
              if ((nameMatches || idMatches) && orgCode) {
                // 주담당인 경우만 추가
                if (isPrimaryRole) {
                  console.log(`주담당 매칭 발견: ${committeeName}(${committeeId}) -> ${orgCode} (${orgName})`);
                  matchedOrgCodes.push(orgCode);
                } else {
                  console.log(`부담당 매칭 무시: ${committeeName}(${committeeId}) -> ${orgCode} (${orgName})`);
                }
              }
              
              // 모든 기관 정보 수집
              if (orgCode && orgName) {
                orgSet.add(JSON.stringify({
                  code: orgCode,
                  name: orgName
                }));
              }
            });
            
            console.log(`매칭된 기관 코드 ${matchedOrgCodes.length}개:`, matchedOrgCodes);
          } else {
            // 위원이 선택되지 않은 경우 모든 기관 정보 수집
            console.log('위원이 선택되지 않아 모든 기관 정보 수집');
            window.allMatchings.forEach(match => {
              const orgCode = match.orgCode || match["기관코드"] || '';
              const orgName = match.orgName || match["기관명"] || '';
              
              if (orgCode && orgName) {
                orgSet.add(JSON.stringify({
                  code: orgCode,
                  name: orgName
                }));
              }
            });
          }
          
          // 기관 정보 변환 및 필터링
          const organizations = Array.from(orgSet).map(org => JSON.parse(org));
          console.log(`총 ${organizations.length}개 기관 정보 추출됨:`, organizations);
          
          // 선택된 위원에 맞는 기관만 필터링
          let filteredOrgs = organizations;
          if (selectedCommitteeName && matchedOrgCodes.length > 0) {
            console.log('선택된 위원에 맞는 기관만 필터링 시작');
            filteredOrgs = organizations.filter(org => matchedOrgCodes.includes(org.code));
            console.log(`필터링 결과: ${filteredOrgs.length}개 기관 매칭됨`);
            
            // 매칭된 기관이 없으면 모든 기관 표시
            if (filteredOrgs.length === 0) {
              console.log(`${selectedCommitteeName} 위원에게 매칭된 기관이 없어 전체 기관 표시`);
              filteredOrgs = organizations;
            }
          }
          
          // 기관 정보 추가
          if (filteredOrgs.length > 0) {
            // 기관명 기준 정렬
            filteredOrgs.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
            
            console.log('드롭다운에 추가할 기관 목록:', filteredOrgs);
            
            filteredOrgs.forEach(org => {
              const option = document.createElement('option');
              option.value = org.code;
              option.textContent = org.name;
              organizationSelect.appendChild(option);
            });
            
            console.log(`window.allMatchings에서 ${filteredOrgs.length}개의 기관 정보 추가 완료`);
            return;
          } else {
            console.log('필터링된 기관 정보가 없음');
          }
        } else {
          console.warn('window.allMatchings가 없거나 비어있음:', window.allMatchings);
        }
        
        // window.allMatchings에서 기관 정보를 찾을 수 없으면 기본 데이터 사용
        console.log('기본 기관 정보 사용');
        addDefaultOrganizations();
      }
      
      // 기본 기관 정보 추가 함수
      function addDefaultOrganizations() {
        [
          { code: 'ORG001', name: '서울시 노인복지관' },
          { code: 'ORG002', name: '경기도 노인복지관' },
          { code: 'ORG003', name: '부산시 노인복지관' },
          { code: 'ORG004', name: '대구시 노인복지관' },
          { code: 'ORG005', name: '인천시 노인복지관' },
          { code: 'ORG006', name: '광주시 노인복지관' }
        ].forEach(org => {
          const option = document.createElement('option');
          option.value = org.code;
          option.textContent = org.name;
          organizationSelect.appendChild(option);
        });
        console.log('기본 데이터로 6개 기관 정보 사용');
      }
      
      // 모달 표시
      setTimeout(() => {
        modal.style.display = 'block';
        console.log('직접 모달 표시 완료');
      }, 0);
    } catch (error) {
      console.error('전역 openScheduleFormModal 함수 오류:', error);
    }
  };

  // 캘린더 설정 함수
  function setupCalendar() {
    const calendar = {};
    
    // 일정 상세 정보 표시 함수
    function showScheduleDetail(scheduleId) {
      CalendarDebugger.log(`일정 상세 정보 표시: ${scheduleId}`, 'info');
      
      // 일정 ID로 일정 찾기
      const schedule = schedules.find(s => (s.id === scheduleId || s._id === scheduleId));
      
      if (!schedule) {
        showNotification('일정을 찾을 수 없습니다.', 'error');
        return;
      }
      
      // 일정 상세 모달 요소 가져오기
      const modal = document.getElementById('schedule-detail-modal');
      const content = document.getElementById('schedule-detail-content');
      const title = document.getElementById('schedule-detail-title');
      
      if (!modal || !content || !title) {
        showNotification('모달 요소를 찾을 수 없습니다.', 'error');
        return;
      }
      
      // 기관명 추출
      let orgName = '';
      if (schedule.organizationName) {
        orgName = schedule.organizationName;
      } else if (schedule.orgName) {
        orgName = schedule.orgName;
      } else if (schedule.orgCode || schedule.organizationCode) {
        const orgCode = schedule.orgCode || schedule.organizationCode;
        orgName = getOrganizationName(orgCode);
      }
      
      if (!orgName || orgName === '') {
        orgName = '기관명 미지정';
      }
      
      // 위원명 추출
      let committeeName = schedule.committeeName || '담당자 미지정';
      
      // 날짜 및 시간 형식화
      const scheduleDate = schedule.scheduleDate || schedule.date || schedule.startDate || '';
      const formattedDate = scheduleDate ? formatDate(scheduleDate) : '날짜 미지정';
      
      const startTime = schedule.startTime || '';
      const endTime = schedule.endTime || '';
      const timeInfo = startTime && endTime ? `${startTime} ~ ${endTime}` : '시간 미지정';
      
      // 상태 텍스트 및 색상 설정
      let statusText = '';
      let statusColor = '';
      
      switch (schedule.status) {
        case 'completed':
          statusText = '완료';
          statusColor = '#4caf50';
          break;
        case 'pending':
          statusText = '대기중';
          statusColor = '#ffc107';
          break;
        case 'canceled':
          statusText = '취소됨';
          statusColor = '#f44336';
          break;
        default:
          statusText = '예정됨';
          statusColor = '#3498db';
      }
      
      // 모달 제목 설정
      title.textContent = schedule.title || (orgName ? `${orgName} 방문` : '일정 상세');
      
      // 모달 내용 설정
      content.innerHTML = `
        <div class="schedule-detail-info">
          <div class="detail-row">
            <span class="detail-label">상태:</span>
            <span class="detail-value" style="color: ${statusColor}; font-weight: bold;">${statusText}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">담당 위원:</span>
            <span class="detail-value">${committeeName}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">방문 기관:</span>
            <span class="detail-value">${orgName}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">날짜:</span>
            <span class="detail-value">${formattedDate}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">시간:</span>
            <span class="detail-value">${timeInfo}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">메모:</span>
            <span class="detail-value">${schedule.notes || '메모 없음'}</span>
          </div>
        </div>
        <div class="detail-actions">
          <button class="btn btn-primary" id="edit-schedule-btn">수정</button>
          <button class="btn btn-danger" id="delete-schedule-btn">삭제</button>
        </div>
      `;
      
      // 수정 버튼 이벤트 리스너
      const editBtn = content.querySelector('#edit-schedule-btn');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          modal.style.display = 'none';
          const dateString = schedule.scheduleDate || schedule.date || schedule.startDate;
          openScheduleFormModal(dateString, scheduleId);
        });
      }
      
      // 삭제 버튼 이벤트 리스너
      const deleteBtn = content.querySelector('#delete-schedule-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          if (confirm('이 일정을 삭제하시겠습니까?')) {
            // 일정 삭제 로직
            const index = schedules.findIndex(s => (s.id === scheduleId || s._id === scheduleId));
            if (index !== -1) {
              schedules.splice(index, 1);
              saveSchedulesToLocalStorage();
              renderCalendar(currentYear, currentMonth);
              showNotification('일정이 삭제되었습니다.', 'success');
              modal.style.display = 'none';
            }
          }
        });
      }
      
      // 모달 닫기 버튼 이벤트 리스너
      const closeBtn = modal.querySelector('.close-modal');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          modal.style.display = 'none';
        });
      }
      
      // 모달 외부 클릭 시 닫기
      window.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
      
      // 모달 표시
      modal.style.display = 'block';
    }

    // 기관명 가져오기 함수
    function getOrganizationName(orgCode) {
      if (!orgCode) return '알 수 없는 기관';
      
      if (organizationMap[orgCode]) {
        return organizationMap[orgCode];
      }
      
      const org = organizations.find(org => org.code === orgCode || org.id === orgCode);
      
      if (org && org.name) {
        organizationMap[orgCode] = org.name;
        return org.name;
      }
      
      const orgMapping = {
        'A48240002': '한국지능정보사회진흥원',
        'A48240001': '과학기술정보통신부',
        'B48240001': '국가정보자원관리원',
        'C48240001': '한국인터넷진흥원'
      };
      
      if (orgMapping[orgCode]) {
        organizationMap[orgCode] = orgMapping[orgCode];
        return orgMapping[orgCode];
      }
      
      return `기관(${orgCode})`;
    }

    // 위원 이름 매핑 함수
    function mapCommitteeName(originalName) {
      if (!originalName) return '';
      
      if (committeeMap[originalName]) {
        return committeeMap[originalName];
      }
      
      return originalName;
    }

    // 위원-기관 매칭 정보 가져오기 함수
    async function loadCommitteeMatchings() {
      try {
        console.log('위원-기관 매칭 정보 가져오기 시도');
        
        // 이미 매칭 정보가 있는지 확인
        if (window.allMatchings && Array.isArray(window.allMatchings) && window.allMatchings.length > 0) {
          console.log('이미 매칭 정보가 로드되어 있습니다:', window.allMatchings.length + '개');
          
          // 원본 데이터 보존을 위해 참조 복사
          committeeOrgMatchings = window.allMatchings;
          
          // 디버깅: 샘플 매칭 데이터 출력
          console.log('현재 매칭 데이터 샘플:', window.allMatchings.slice(0, 3));
          return;
        }
        
        // API를 통해 매칭 정보 가져오기
        if (window.api && window.api.committees && typeof window.api.committees.getMatching === 'function') {
          console.log('API를 통해 매칭 정보 가져오기 시도');
          
          const response = await window.api.committees.getMatching();
          
          // 응답이 배열인 경우 (API가 배열을 직접 반환하는 경우)
          if (Array.isArray(response)) {
            console.log('API에서 배열 형태로 매칭 정보 반환:', response.length + '개');
            
            // 이미 올바른 형식이면 그대로 사용
            if (response.length > 0 && (response[0].committeeId || response[0].committeeName)) {
              window.allMatchings = response;
              committeeOrgMatchings = response;
              console.log('매칭 정보 저장 완료:', committeeOrgMatchings.length + '개');
              console.log('매칭 데이터 샘플:', committeeOrgMatchings.slice(0, 3));
              return;
            }
            
            // 형식 변환이 필요한 경우
            const formattedMatchings = response.map(item => {
              // 이미 영문 필드명을 사용하는 경우
              if (item.committeeName || item.committeeId) {
                return item;
              }
              
              // 한글 필드명을 사용하는 경우 변환
              return {
                committeeName: item.위원명 || '',
                committeeId: item.위원ID || '',
                orgCode: item.기관코드 || '',
                orgName: item.기관명 || '',
                region: item.지역 || '',
                role: Array.isArray(item.주담당) && item.주담당.includes(item.위원명) ? '주담당' : '부담당',
                // 원본 한글 필드도 유지 (데이터 일관성을 위해)
                위원명: item.위원명 || '',
                위원ID: item.위원ID || '',
                기관코드: item.기관코드 || '',
                기관명: item.기관명 || '',
                지역: item.지역 || '',
                주담당: item.주담당 || [],
                부담당: item.부담당 || []
              };
            });
            
            window.allMatchings = formattedMatchings;
            committeeOrgMatchings = formattedMatchings;
            console.log('매칭 정보 변환 완료:', committeeOrgMatchings.length + '개');
            console.log('변환된 매칭 데이터 샘플:', committeeOrgMatchings.slice(0, 3));
            return;
          }
          // 응답이 객체이고 status와 data 속성이 있는 경우 (기존 형식)
          else if (response && response.status === 'success' && response.data && response.data.matchings) {
            // 매칭 정보 저장
            console.log('API에서 가져온 매칭 정보 처리:', response.data.matchings.length + '개');
            
            // 원본 데이터 보존 (한글 필드명)
            const originalMatchings = response.data.matchings;
            
            // 매칭 정보 형식 변환하여 전역 변수에 저장 (영문 필드명으로 통일)
            const formattedMatchings = originalMatchings.map(item => {
              return {
                committeeName: item.위원명 || '',
                committeeId: item.위원ID || '',
                orgCode: item.기관코드 || '',
                orgName: item.기관명 || '',
                region: item.지역 || '',
                role: Array.isArray(item.주담당) && item.주담당.includes(item.위원명) ? '주담당' : '부담당',
                // 원본 한글 필드도 유지 (데이터 일관성을 위해)
                위원명: item.위원명 || '',
                위원ID: item.위원ID || '',
                기관코드: item.기관코드 || '',
                기관명: item.기관명 || '',
                지역: item.지역 || '',
                주담당: item.주담당 || [],
                부담당: item.부담당 || []
              };
            });
            
            // 통합된 형식으로 저장
            window.allMatchings = formattedMatchings;
            committeeOrgMatchings = formattedMatchings;
            
            console.log('매칭 정보 변환 완료:', committeeOrgMatchings.length + '개');
            console.log('변환된 매칭 데이터 샘플:', committeeOrgMatchings.slice(0, 3));
          } else {
            console.warn('매칭 정보 가져오기 실패:', response);
            // 기본 매칭 정보 생성 (구글 시트 데이터 기반)
            createDefaultMatchings();
          }
        } else {
          console.warn('API 함수를 찾을 수 없습니다.');
          // 기본 매칭 정보 생성 (구글 시트 데이터 기반)
          createDefaultMatchings();
        }
      } catch (error) {
        console.error('매칭 정보 가져오기 중 오류:', error);
        // 기본 매칭 정보 생성 (구글 시트 데이터 기반)
        createDefaultMatchings();
      }
    }

    // 기본 매칭 정보 생성 (구글 시트 데이터 기반)
    function createDefaultMatchings() {
      console.log('기본 매칭 정보 생성');
      
      // 구글 시트 데이터 기반으로 매칭 정보 생성
      const rawDefaultMatchings = [
        {
          위원ID: 'C001',
          위원명: '신용기',
          기관코드: 'A48170002',
          기관명: '전주노인복지지원센터',
          주담당: ['신용기'],
          부담당: [],
          지역: '전주시'
        },
        {
          위원ID: 'C002',
          위원명: '김수연',
          기관코드: 'A48170003',
          기관명: '목포노인복지지원센터',
          주담당: ['김수연'],
          부담당: [],
          지역: '목포시'
        },
        {
          위원ID: 'C003',
          위원명: '문일지',
          기관코드: 'A48170004',
          기관명: '광주노인복지지원센터',
          주담당: ['문일지'],
          부담당: [],
          지역: '광주시'
        },
        {
          위원ID: 'C004',
          위원명: '이연숙',
          기관코드: 'A48170005',
          기관명: '부산노인복지지원센터',
          주담당: ['이연숙'],
          부담당: [],
          지역: '부산시'
        },
        {
          위원ID: 'C005',
          위원명: '이정혜',
          기관코드: 'A48170006',
          기관명: '대구노인복지지원센터',
          주담당: ['이정혜'],
          부담당: [],
          지역: '대구시'
        },
        {
          위원ID: 'C001',
          위원명: '신용기',
          기관코드: 'A48880002',
          기관명: '거창노인복지지원센터',
          주담당: [],
          부담당: ['신용기'],
          지역: '거창군'
        },
        {
          위원ID: 'C003',
          위원명: '문일지',
          기관코드: 'A48880002',
          기관명: '거창노인복지지원센터',
          주담당: ['문일지'],
          부담당: [],
          지역: '거창군'
        },
        {
          위원ID: 'C001',
          위원명: '신용기',
          기관코드: 'A48820003',
          기관명: '대리노인 고성지원센터(노인종합복지센터)',
          주담당: [],
          부담당: ['신용기'],
          지역: '고성군'
        },
        {
          위원ID: 'C003',
          위원명: '문일지',
          기관코드: 'A48820003',
          기관명: '대리노인 고성지원센터(노인종합복지센터)',
          주담당: ['문일지'],
          부담당: [],
          지역: '고성군'
        },
        {
          위원ID: 'C001',
          위원명: '신용기',
          기관코드: 'A48820004',
          기관명: '한음생명회',
          주담당: [],
          부담당: ['신용기'],
          지역: '고성군'
        },
        {
          위원ID: 'C003',
          위원명: '문일지',
          기관코드: 'A48820004',
          기관명: '한음생명회',
          주담당: ['문일지'],
          부담당: [],
          지역: '고성군'
        },
        {
          위원ID: 'C001',
          위원명: '신용기',
          기관코드: 'A48170003',
          기관명: '남원노인복지지원센터',
          주담당: [],
          부담당: ['신용기'],
          지역: '전주시'
        },
        {
          위원ID: 'C003',
          위원명: '문일지',
          기관코드: 'A48170003',
          기관명: '남원노인복지지원센터',
          주담당: ['문일지'],
          부담당: [],
          지역: '전주시'
        },
        {
          위원ID: 'C003',
          위원명: '문일지',
          기관코드: 'A48880003',
          기관명: '거상에노인복지지원센터',
          주담당: ['문일지'],
          부담당: [],
          지역: '거창군'
        },
        {
          위원ID: 'C001',
          위원명: '신용기',
          기관코드: 'A48880003',
          기관명: '거상에노인복지지원센터',
          주담당: [],
          부담당: ['신용기'],
          지역: '거창군'
        },
        {
          위원ID: 'C004',
          위원명: '이연숙',
          기관코드: 'A48170004',
          기관명: '광역시노인복지지원센터',
          주담당: ['이연숙'],
          부담당: [],
          지역: '전주시'
        }
      ];
      // 데이터 형식 통일화
      const formattedDefaultMatchings = rawDefaultMatchings.map(match => {
        return {
          committeeId: match.위원ID || '',
          committeeName: match.위원명 || '',
          orgCode: match.기관코드 || '',
          orgName: match.기관명 || '',
          region: match.지역 || '',
          role: Array.isArray(match.주담당) && match.주담당.includes(match.위원명) ? '주담당' : '부담당'
        };
      });
      
      window.allMatchings = formattedDefaultMatchings;
      committeeOrgMatchings = formattedDefaultMatchings;
      console.log('기본 매칭 정보 생성 완료:', committeeOrgMatchings.length + '개');
      console.log('기본 매칭 데이터 예시:', committeeOrgMatchings.slice(0, 3));
    }
    
    // 위원의 주담당 기관 코드 가져오기
    function getCommitteePrimaryOrgs(committeeName) {
      if (!committeeName) {
        console.warn('위원명이 없어 주담당 기관을 찾을 수 없습니다.');
        return [];
      }
      
      // 매칭 데이터 확인
      const committeeOrgMatchings = window.allMatchings || [];
      if (!committeeOrgMatchings || committeeOrgMatchings.length === 0) {
        console.warn('매칭 데이터가 없어 주담당 기관을 찾을 수 없습니다.');
        return [];
      }
      
      console.log(`${committeeName} 위원의 주담당 기관 찾기 시도`);
      
      // 주담당으로 있는 기관 코드 추출
      const orgCodes = [];
      const addedOrgCodes = new Set(); // 중복 방지를 위한 Set
      
      committeeOrgMatchings.forEach(matching => {
        // 새로운 데이터 형식(영문 필드명) 확인 - 주담당인 경우만 추가
        if (matching.committeeName === committeeName && 
            matching.role === '주담당' && 
            matching.orgCode && 
            !addedOrgCodes.has(matching.orgCode)) {
          orgCodes.push(matching.orgCode);
          addedOrgCodes.add(matching.orgCode);
          console.log(`${committeeName} 위원의 주담당 기관 추가(새 형식): ${matching.orgName || ''} (${matching.orgCode})`);
        }
        // 이전 데이터 형식(한글 필드명) 확인 - 위원명 직접 비교 & 역할이 주담당인 경우만
        else if (matching.위원명 === committeeName && 
                 matching.역할 === '주담당' && 
                 matching.기관코드 && 
                 !addedOrgCodes.has(matching.기관코드)) {
          orgCodes.push(matching.기관코드);
          addedOrgCodes.add(matching.기관코드);
          console.log(`${committeeName} 위원의 주담당 기관 추가(위원명 직접 비교): ${matching.기관명 || ''} (${matching.기관코드})`);
        }
        // 이전 데이터 형식(한글 필드명) 확인 - 주담당 배열에서 확인
        else if (matching.주담당 && Array.isArray(matching.주담당) && 
                 matching.주담당.includes(committeeName) && 
                 matching.기관코드 && 
                 !addedOrgCodes.has(matching.기관코드)) {
          orgCodes.push(matching.기관코드);
          addedOrgCodes.add(matching.기관코드);
          console.log(`${committeeName} 위원의 주담당 기관 추가(주담당 배열): ${matching.기관명 || ''} (${matching.기관코드})`);
        }
      });
      
      // 중복 제거 후 결과 반환
      console.log(`${committeeName} 위원의 주담당 기관 코드 ${orgCodes.length}개 찾음`);
      return orgCodes;
    }

    // 초기화 함수
    async function init() {
      try {
        console.log('캘린더 초기화 함수 호출 시작');
        const today = new Date();
        currentYear = today.getFullYear();
        currentMonth = today.getMonth();
        currentDate = today.getDate();
        
        console.log('현재 날짜 설정:', { 년: currentYear, 월: currentMonth + 1, 일: currentDate });
        
        try {
          console.log('위원 및 기관 정보 가져오기 시도');
          
          if (typeof getCommittees === 'function') {
            await getCommittees();
            console.log('위원 정보 가져오기 성공');
          } else {
            console.warn('위원 정보 가져오기 함수가 정의되지 않았습니다.');
            committees = [];
          }
          
          if (typeof getOrganizations === 'function') {
            await getOrganizations();
            console.log('기관 정보 가져오기 성공');
          } else {
            console.warn('기관 정보 가져오기 함수가 정의되지 않았습니다.');
            organizations = [];
          }
          
          // 위원-기관 매칭 정보 가져오기
          if (typeof loadCommitteeMatchings === 'function') {
            await loadCommitteeMatchings();
            console.log('위원-기관 매칭 정보 가져오기 성공');
          } else {
            console.warn('위원-기관 매칭 정보 가져오기 함수가 정의되지 않았습니다.');
          }
        } catch (dataError) {
          console.error('데이터 가져오기 중 오류:', dataError);
        }
        
        try {
          if (typeof loadSchedulesFromLocalStorage === 'function') {
            loadSchedulesFromLocalStorage();
            console.log('로컬 스토리지에서 일정 불러오기 성공');
          } else {
            console.warn('로컬 스토리지에서 일정 불러오기 함수가 정의되지 않았습니다.');
          }
        } catch (storageError) {
          console.error('로컬 스토리지에서 일정 불러오기 중 오류:', storageError);
        }
        
        try {
          if (typeof renderCalendar === 'function') {
            renderCalendar(currentYear, currentMonth);
            console.log('캘린더 렌더링 성공');
          } else {
            console.error('캘린더 렌더링 함수가 정의되지 않았습니다.');
          }
        } catch (renderError) {
          console.error('캘린더 렌더링 중 오류:', renderError);
        }
        
        try {
          if (typeof setupEventListeners === 'function') {
            setupEventListeners();
            console.log('이벤트 리스너 등록 성공');
          } else {
            console.warn('이벤트 리스너 등록 함수가 정의되지 않았습니다.');
          }
        } catch (eventError) {
          console.error('이벤트 리스너 등록 중 오류:', eventError);
        }
        
        console.log('캘린더 초기화 완료');
      } catch (error) {
        console.error('캘린더 초기화 중 오류:', error);
      }
    }

    // 이벤트 리스너 설정 함수
    function setupEventListeners() {
      console.log('이벤트 리스너 설정 시작');
      
      function removeAllEventListeners(element) {
        if (!element) return;
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);
        return newElement;
      }
      
      // 일정 저장 버튼 이벤트 리스너
      const saveScheduleBtn = document.getElementById('save-schedule-btn');
      if (saveScheduleBtn) {
        const newSaveBtn = removeAllEventListeners(saveScheduleBtn);
        newSaveBtn.addEventListener('click', saveSchedule);
      }
      
      // 일정 삭제 버튼 이벤트 리스너
      const deleteScheduleBtn = document.getElementById('delete-schedule-btn');
      if (deleteScheduleBtn) {
        const newDeleteBtn = removeAllEventListeners(deleteScheduleBtn);
        newDeleteBtn.addEventListener('click', deleteSchedule);
      }
      
      // 모달 닫기 버튼 이벤트 리스너
      document.querySelectorAll('.close-modal').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
          const modal = this.closest('.modal');
          if (modal) {
            modal.style.display = 'none';
          }
        });
      });
      
      // 모달 외부 클릭 시 닫기
      window.addEventListener('click', function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
          if (event.target === modal) {
            modal.style.display = 'none';
          }
        });
      });
      
      const prevMonthBtn = document.getElementById('prev-month');
      if (prevMonthBtn) {
        const newPrevBtn = removeAllEventListeners(prevMonthBtn);
        newPrevBtn.addEventListener('click', () => {
          console.log('이전 월 버튼 클릭');
          currentMonth--;
          if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
          }
          renderCalendar(currentYear, currentMonth);
        });
      }
      
      const nextMonthBtn = document.getElementById('next-month');
      if (nextMonthBtn) {
        const newNextBtn = removeAllEventListeners(nextMonthBtn);
        newNextBtn.addEventListener('click', () => {
          console.log('다음 월 버튼 클릭');
          currentMonth++;
          if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
          }
          renderCalendar(currentYear, currentMonth);
        });
      }
      
      const todayBtn = document.getElementById('today-btn');
      if (todayBtn) {
        const newTodayBtn = removeAllEventListeners(todayBtn);
        newTodayBtn.addEventListener('click', () => {
          console.log('오늘 버튼 클릭');
          const today = new Date();
          currentYear = today.getFullYear();
          currentMonth = today.getMonth();
          currentDate = today.getDate();
          renderCalendar(currentYear, currentMonth);
        });
      }
      
      document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
          const modal = closeBtn.closest('.modal');
          if (modal) {
            modal.style.display = 'none';
          }
        });
      });
      
      console.log('이벤트 리스너 설정 완료');
    }

    // 캘린더 렌더링 함수
    function renderCalendar(year, month) {
      console.log('캘린더 렌더링 시작:', { 년: year, 월: month + 1 });
      
      const calendarGrid = document.getElementById('calendar-grid');
      if (!calendarGrid) {
        console.error('캘린더 그리드 요소를 찾을 수 없습니다.');
        return;
      }
      
      const monthYearText = document.getElementById('month-year');
      if (monthYearText) {
        monthYearText.textContent = `${year}년 ${month + 1}월`;
      }
      
      const firstDay = new Date(year, month, 1);
      const startingDay = firstDay.getDay();
      const lastDay = new Date(year, month + 1, 0);
      const endingDate = lastDay.getDate();
      const prevMonthLastDay = new Date(year, month, 0);
      const prevMonthLastDate = prevMonthLastDay.getDate();
      
      calendarGrid.innerHTML = '';
      
      const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
      weekdays.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.classList.add('day-header');
        dayHeader.textContent = day;
        
        if (day === '일') {
          dayHeader.classList.add('sunday');
        }
        
        calendarGrid.appendChild(dayHeader);
      });
      
      let dateCell;
      let cellDate;
      
      for (let i = 0; i < startingDay; i++) {
        dateCell = document.createElement('div');
        dateCell.classList.add('date-cell', 'inactive');
        
        if (i % 7 === 0) {
          dateCell.classList.add('sunday');
        }
        
        cellDate = prevMonthLastDate - startingDay + i + 1;
        dateCell.innerHTML = `<div class="date-number">${cellDate}</div>`;
        calendarGrid.appendChild(dateCell);
      }
      
      const today = new Date();
      for (let i = 1; i <= endingDate; i++) {
        dateCell = document.createElement('div');
        dateCell.classList.add('date-cell');
        
        if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
          dateCell.classList.add('today');
        }
        
        const cellDay = new Date(year, month, i).getDay();
        if (cellDay === 0) {
          dateCell.classList.add('sunday');
        }
        
        const dateContainer = document.createElement('div');
        dateContainer.className = 'date-number';
        dateContainer.textContent = i;
        dateCell.appendChild(dateContainer);
        
        // 날짜 셀 스타일에 커서 포인터 추가
        dateCell.style.cursor = 'pointer';
        dateContainer.style.cursor = 'pointer';
        
        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(i).padStart(2, '0');
        const dateString = `${year}-${monthStr}-${dayStr}`;
        
        // 날짜 셀에 클릭 이벤트 추가 - 일정 추가 모달 표시
        dateCell.addEventListener('click', (e) => {
          // 일정 항목이 아닌 경우에만 일정 추가 모달 표시
          if (!e.target.classList.contains('schedule-item') && 
              !e.target.classList.contains('schedule-dot') && 
              !e.target.classList.contains('schedule-title') && 
              !e.target.classList.contains('schedule-more')) {
            
            e.stopPropagation(); // 이벤트 전파 방지
            console.log('날짜 셀 클릭 - 일정 추가 모달 열기:', dateString);
            
            // 전역 함수 호출 (일관성을 위해 항상 전역 함수 사용)
            window.openScheduleFormModal(dateString);
          }
        });
        
        // 일정 추가 버튼 삭제 - 날짜 셀 클릭으로 통합
        
        const dateSchedules = schedules.filter(schedule => {
          const scheduleDate = schedule.scheduleDate || schedule.date || schedule.startDate;
          return scheduleDate === dateString;
        });
        
        if (dateSchedules.length > 0) {
          const scheduleList = document.createElement('div');
          scheduleList.classList.add('schedule-list');
          
          const maxDisplay = 3;
          const displayCount = Math.min(dateSchedules.length, maxDisplay);
          
          for (let j = 0; j < displayCount; j++) {
            const schedule = dateSchedules[j];
            const scheduleItem = document.createElement('div');
            scheduleItem.classList.add('schedule-item');
            
            if (schedule.status === 'completed') {
              scheduleItem.classList.add('completed');
            } else if (schedule.status === 'pending') {
              scheduleItem.classList.add('pending');
            } else if (schedule.status === 'canceled') {
              scheduleItem.classList.add('canceled');
            }
            
            let committeeId = schedule.committeeId;
            let committeeName = schedule.committeeName || '담당자 미지정';
            
            // 기관명 추출
            let orgName = '';
            if (schedule.organizationName) {
              orgName = schedule.organizationName;
            } else if (schedule.orgName) {
              orgName = schedule.orgName;
            } else if (schedule.orgCode || schedule.organizationCode) {
              const orgCode = schedule.orgCode || schedule.organizationCode;
              orgName = getOrganizationName(orgCode);
            }
            
            if (!orgName || orgName === '') {
              orgName = '기관명';
            }
            
            const title = schedule.title || (orgName ? `${orgName} 방문` : '일정');
            
            // 위원 이름 기반으로 색상 가져오기 (위원 ID 대신 이름 사용)
            const committeeColor = getCommitteeColor(committeeName);
            
            const dotColor = schedule.status === 'completed' ? '#4caf50' : 
                           schedule.status === 'pending' ? '#ffc107' : 
                           schedule.status === 'canceled' ? '#f44336' : 
                           committeeColor;
            
            // 일정 정보를 텍스트로 표시 (더 짧게 잘라서 표시)
            const truncatedTitle = title.length > 6 ? title.substring(0, 6) + '...' : title;
            
            scheduleItem.innerHTML = `
              <div class="schedule-dot" style="background-color: ${dotColor};"></div>
              <div class="schedule-title" style="color: ${committeeColor}; font-weight: 600; font-size: 0.75rem;">${truncatedTitle}</div>
            `;
            
            // 일정 항목 배경색을 위원에 맞게 설정 (투명도 낮게)
            scheduleItem.style.backgroundColor = `${committeeColor}15`;
            scheduleItem.style.borderLeft = `3px solid ${committeeColor}`;
            
            // 투툴팁 추가
            scheduleItem.title = `${title} - ${committeeName}`;
            
            // 일정 항목 클릭 시 해당 일정의 상세 정보 모달 표시
            scheduleItem.addEventListener('click', (e) => {
              e.stopPropagation();
              // 해당 일정의 ID를 이용해 상세 정보 모달 표시
              showScheduleDetail(schedule.id || schedule._id);
            });
            
            scheduleList.appendChild(scheduleItem);
          }
          
          if (dateSchedules.length > maxDisplay) {
            const moreItem = document.createElement('div');
            moreItem.classList.add('schedule-more');
            moreItem.textContent = `+${dateSchedules.length - maxDisplay}개 더보기`;
            
            moreItem.addEventListener('click', (e) => {
              e.stopPropagation();
              showDateSchedules(dateString);
            });
            
            scheduleList.appendChild(moreItem);
          }
          
          dateCell.appendChild(scheduleList);
        }
        
        // 날짜 셀 클릭 이벤트는 위에서 이미 처리했으므로 여기서는 제거
        
        calendarGrid.appendChild(dateCell);
      }
      
      const totalCells = 42;
      const remainingCells = totalCells - (startingDay + endingDate);
      
      for (let i = 1; i <= remainingCells; i++) {
        dateCell = document.createElement('div');
        dateCell.classList.add('date-cell', 'inactive');
        
        const cellDay = (startingDay + endingDate + i - 1) % 7;
        if (cellDay === 0) {
          dateCell.classList.add('sunday');
        }
        
        dateCell.innerHTML = `<div class="date-number">${i}</div>`;
        calendarGrid.appendChild(dateCell);
      }
    }

    // 날짜별 일정 모달 표시 함수
    function showDateSchedules(dateString) {
      try {
        const dateSchedules = schedules.filter(schedule => {
          const scheduleDate = schedule.scheduleDate || schedule.date || schedule.startDate;
          return scheduleDate === dateString;
        });
        
        const modal = document.getElementById('schedules-list-modal');
        const modalTitle = document.getElementById('schedules-list-modal-title');
        const schedulesList = document.getElementById('schedules-list');
        
        if (!modal || !modalTitle || !schedulesList) {
          console.error('일정 목록 모달 요소를 찾을 수 없습니다.');
          return;
        }
        
        const formattedDate = dateString.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1년 $2월 $3일');
        modalTitle.textContent = `${formattedDate} 일정`;
        
        schedulesList.innerHTML = '';
        
        if (dateSchedules.length === 0) {
          schedulesList.innerHTML = `
            <div class="empty-message">
              <i class="fas fa-calendar-times"></i>
              <p>이 날짜에 등록된 일정이 없습니다.</p>
            </div>
          `;
        } else {
          const countInfo = document.createElement('div');
          countInfo.className = 'schedule-count';
          countInfo.innerHTML = `총 <strong>${dateSchedules.length}</strong>개의 일정`;
          schedulesList.appendChild(countInfo);
        }
        
        dateSchedules.forEach(schedule => {
          const scheduleItem = document.createElement('div');
          scheduleItem.classList.add('schedule-item');
          
          if (schedule.status === 'completed') {
            scheduleItem.classList.add('completed');
          } else if (schedule.status === 'pending') {
            scheduleItem.classList.add('pending');
          } else if (schedule.status === 'canceled') {
            scheduleItem.classList.add('canceled');
          }
          
          let orgName = '';
          if (schedule.organizationName) {
            orgName = schedule.organizationName;
          } else if (schedule.orgName) {
            orgName = schedule.orgName;
          } else if (schedule.orgCode || schedule.organizationCode) {
            const orgCode = schedule.orgCode || schedule.organizationCode;
            orgName = getOrganizationName(orgCode);
          } else {
            orgName = '기관 미지정';
          }
          
          let committeeName = schedule.committeeName || '담당자 미지정';
          let timeInfo = schedule.time || '종일';
          const title = schedule.title || `${orgName} 방문`;
          
          let statusText = '';
          let statusClass = '';
          
          if (schedule.status === 'completed') {
            statusText = '완료';
            statusClass = 'completed';
          } else if (schedule.status === 'pending') {
            statusText = '예정';
            statusClass = 'pending';
          } else if (schedule.status === 'canceled') {
            statusText = '취소';
            statusClass = 'canceled';
          }
          
          const committeeColor = getCommitteeColor(schedule.committeeId);
          const dotColor = schedule.status === 'completed' ? '#4caf50' : 
                         schedule.status === 'pending' ? '#ffc107' : 
                         schedule.status === 'canceled' ? '#f44336' : 
                         committeeColor;
          
          scheduleItem.innerHTML = `
            <div class="schedule-header">
              <div class="schedule-dot" style="background-color: ${dotColor};"></div>
              <div class="schedule-title">${title}</div>
              ${statusText ? `<span class="status-badge ${statusClass}">${statusText}</span>` : ''}
            </div>
            <div class="schedule-details">
              <div class="schedule-time"><i class="far fa-clock"></i> ${timeInfo}</div>
              <div class="schedule-info">
                <span class="committee"><i class="far fa-user"></i> ${committeeName}</span>
                <span class="org"><i class="far fa-building"></i> ${orgName}</span>
              </div>
              ${schedule.notes ? `<div class="schedule-notes">${schedule.notes}</div>` : ''}
            </div>
          `;
          
          schedulesList.appendChild(scheduleItem);
        });
        
        modal.style.display = 'block';
        
        const event = new CustomEvent('date-cell-click', {
          detail: { date: dateString }
        });
        document.dispatchEvent(event);
      } catch (error) {
        console.error('날짜별 일정 모달 표시 중 오류:', error);
      }
    }

    // 사용자 정보 가져오기 함수
    async function getCurrentUser() {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`API 오류: ${response.status}`);
        }
        
        const data = await response.json();
        return data.data.user;
      } catch (error) {
        console.error('사용자 정보 가져오기 중 오류:', error);
        try {
          const userData = localStorage.getItem('user');
          if (userData) {
            return JSON.parse(userData);
          }
        } catch (e) {
          console.error('로컬 스토리지에서 사용자 정보 가져오기 중 오류:', e);
        }
        return null;
      }
    }

    // 일정 가져오기 함수
    async function getSchedules() {
      try {
        const localData = localStorage.getItem(LOCAL_STORAGE_SCHEDULES_KEY);
        const lastUpdate = localStorage.getItem(LOCAL_STORAGE_LAST_UPDATE_KEY);
        
        if (localData && lastUpdate) {
          const lastUpdateTime = new Date(lastUpdate).getTime();
          const currentTime = new Date().getTime();
          const hoursDiff = (currentTime - lastUpdateTime) / (1000 * 60 * 60);
          
          if (hoursDiff < 24) {
            console.log('로컬 스토리지에서 일정 데이터 로드');
            schedules = JSON.parse(localData);
            return schedules;
          }
        }
        
        return [];
      } catch (error) {
        console.error('일정 가져오기 중 오류:', error);
        return [];
      }
    }

    // 위원 목록 가져오기 함수
    async function getCommittees() {
      try {
        CalendarDebugger.log('위원 정보 가져오기 시도');
        
        committees = window.defaultCommittees || [];
        
        committees.forEach(committee => {
          if (committee.id && committee.name) {
            committeeMap[committee.id] = committee.name;
          }
        });
        
        console.log(`기본 데이터로 ${committees.length}개 위원 정보 사용`);
        currentUser = committees[0];
        
        return committees;
      } catch (error) {
        console.error('위원 정보 가져오기 중 오류:', error);
        
        const defaultCommittees = [];
        
        return defaultCommittees;
      }
    }

    // 기관 목록 가져오기 함수
    async function getOrganizations() {
      try {
        if (organizations.length > 0) {
          console.log('이미 로드된 기관 정보 사용');
          return organizations;
        }
        
        CalendarDebugger.log('API에서 기관 데이터 로드 시도');
        
        // API에서 기관 데이터 가져오기
        const headers = getAuthHeaders();
        const response = await fetch('/api/organizations', {
          method: 'GET',
          headers
        });
        
        if (!response.ok) {
          throw new Error(`기관 정보 API 오류: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('API 응답 데이터:', result);
        
        if (result.status === 'success' && result.organizations && result.organizations.main) {
          organizations = result.organizations.main;
          console.log(`API에서 ${organizations.length}개 기관 정보 가져옴`);
          
          // 기관 코드와 이름 매핑
          organizations.forEach(org => {
            if (org && (org.code || org.id) && org.name) {
              const code = org.code || org.id;
              organizationMap[code] = org.name;
            }
          });
          
          // 추가 디버깅 로그
          console.log('창원도우누리 포함 여부:', organizations.some(org => org.name.includes('창원도우누리')));
          console.log('창녕군새누리 포함 여부:', organizations.some(org => org.name.includes('창녕군새누리')));
          
          return organizations;
        } else {
          throw new Error('API 응답에 유효한 기관 데이터가 없습니다');
        }
      } catch (error) {
        console.error('기관 정보 가져오기 중 오류:', error);
        
        // 에러 발생 시 기본 데이터 사용
        CalendarDebugger.log('API 오류로 기본 기관 데이터 사용', 'warning');
        
        const defaultOrganizations = [
          { id: 'A48120001', code: 'A48120001', name: '동진노인통합지원센터', region: '창원시' },
          { id: 'A48120002', code: 'A48120002', name: '창원도우누리노인통합재가센터', region: '창원시' },
          { id: 'A48740002', code: 'A48740002', name: '창녕군새누리노인통합지원센터', region: '창녕군' }
        ];
        
        defaultOrganizations.forEach(org => {
          if (org && (org.code || org.id) && org.name) {
            const code = org.code || org.id;
            organizationMap[code] = org.name;
          }
        });
        
        return defaultOrganizations;
      }
    }

    // 로컬 스토리지에 일정 저장
    function saveSchedulesToLocalStorage() {
      try {
        // 일정 데이터 형식 통일화
        const formattedSchedules = schedules.map(schedule => {
          // 필수 필드가 있는지 확인하고 없으면 추가
          // 날짜 값이 없는 경우 오류 로그 추가
          if (!schedule.date && !schedule.visitDate && !schedule.scheduleDate) {
            console.error('일정에 날짜 정보가 없습니다:', schedule);
          }
          
          // 날짜 값 처리
          const dateValue = schedule.scheduleDate || schedule.date || schedule.visitDate || new Date().toISOString().split('T')[0];
          console.log(`일정 날짜 처리: ${dateValue} (ID: ${schedule.id || '새 일정'})`);
          
          return {
            id: schedule.id || `schedule_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`,
            date: dateValue,
            visitDate: dateValue,
            scheduleDate: dateValue,
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
            title: schedule.title || `${schedule.organizationName || schedule.orgName || '미지정'} 방문`,
            createdAt: schedule.createdAt || new Date().toISOString()
          };
        });

        // 기존 키에 저장
        localStorage.setItem(LOCAL_STORAGE_SCHEDULES_KEY, JSON.stringify(formattedSchedules));
        localStorage.setItem(LOCAL_STORAGE_LAST_UPDATE_KEY, new Date().toISOString());
        
        // 추가: 다른 페이지에서도 사용할 수 있도록 calendar_schedules 키에도 저장
        localStorage.setItem('calendar_schedules', JSON.stringify(formattedSchedules));
        
        // 마스터 대시보드에 일정 업데이트 알림
        const updateEvent = new CustomEvent('masterDashboardDataUpdated', {
          detail: {
            type: 'update',
            data: {
              schedules: formattedSchedules
            }
          }
        });
        document.dispatchEvent(updateEvent);
        
        console.log(`로컬 스토리지에 ${formattedSchedules.length}개 일정 저장 완료`);
        schedules = formattedSchedules; // 형식화된 데이터로 업데이트
        
        // 구글 시트에도 일정 저장 시도
        if (typeof window.exportLocalSchedulesToSheet === 'function') {
          try {
            console.log('구글 시트에 일정 데이터 저장 시도');
            // 구글 시트 API 연결 상태 확인
            fetch('/api/sheets/schedules', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              },
              credentials: 'include'
            })
            .then(response => {
              if (response.ok) {
                console.log('구글 시트 API 연결 확인 성공');
                // API 연결이 성공하면 실제 데이터 저장 시도
                return window.exportLocalSchedulesToSheet();
              } else {
                console.warn('구글 시트 API 연결 실패:', response.status);
                return false;
              }
            })
            .then(result => {
              if (result) {
                console.log('구글 시트에 일정 데이터 저장 성공');
              } else {
                console.warn('구글 시트에 일정 데이터 저장 실패');
              }
            })
            .catch(error => {
              console.error('구글 시트 저장 오류:', error);
            });
          } catch (error) {
            console.error('구글 시트 저장 함수 호출 오류:', error);
          }
        } else {
          console.log('구글 시트 저장 기능이 로드되지 않았습니다.');
        }
      } catch (error) {
        console.error('로컬 스토리지에 일정 저장 중 오류:', error);
      }
    }

    // 로컬 스토리지에서 일정 불러오기
    function loadSchedulesFromLocalStorage() {
      try {
        const storedSchedules = localStorage.getItem(LOCAL_STORAGE_SCHEDULES_KEY);
        if (storedSchedules) {
          schedules = JSON.parse(storedSchedules);
          
          if (schedules.length > 0) {
            const maxId = schedules.reduce((max, schedule) => {
              if (typeof schedule.id === 'string' && schedule.id.startsWith('schedule_')) {
                const parts = schedule.id.split('_');
                if (parts.length === 3) {
                  const num = parseInt(parts[2], 10);
                  return Math.max(max, num);
                }
              }
              return max;
            }, 0);
            
            nextScheduleId = maxId + 1;
          }
          
          console.log(`로컬 스토리지에서 ${schedules.length}개 일정 불러오기 완료`);
        } else {
          console.log('로컬 스토리지에 저장된 일정 데이터가 없습니다.');
        }
      } catch (error) {
        console.error('로컬 스토리지에서 일정 불러오기 중 오류:', error);
      }
    }

    // 종합보고서 데이터 처리 함수
    function processComprehensiveReportData(organizations, scheduleData) {
      try {
        CalendarDebugger.log('종합보고서 데이터 처리 시작', 'info', { organizations: organizations.length, schedules: scheduleData.length });
        
        const orgVisitCounts = {};
        const orgLastVisit = {};
        
        scheduleData.forEach(schedule => {
          const orgCode = schedule.orgCode || schedule.organizationCode;
          const orgName = schedule.organizationName || schedule.orgName || (orgCode ? getOrganizationName(orgCode) : '알 수 없는 기관');
          
          if (!orgVisitCounts[orgName]) {
            orgVisitCounts[orgName] = 0;
          }
          orgVisitCounts[orgName]++;
          
          const scheduleDate = schedule.scheduleDate || schedule.date || schedule.startDate;
          if (scheduleDate) {
            if (!orgLastVisit[orgName] || scheduleDate > orgLastVisit[orgName]) {
              orgLastVisit[orgName] = scheduleDate;
            }
          }
        });
        
        const topOrganizations = Object.entries(orgVisitCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ 
            name, 
            count, 
            lastVisit: orgLastVisit[name] || '방문 기록 없음' 
          }));
        
        const monthlyDistribution = {};
        scheduleData.forEach(schedule => {
          const scheduleDate = schedule.scheduleDate || schedule.date || schedule.startDate;
          if (scheduleDate) {
            const month = scheduleDate.substring(0, 7);
            if (!monthlyDistribution[month]) {
              monthlyDistribution[month] = 0;
            }
            monthlyDistribution[month]++;
          }
        });
        
        const reportData = {
          totalOrganizations: organizations.length,
          totalSchedules: scheduleData.length,
          topOrganizations,
          monthlyDistribution,
          lastUpdated: new Date().toISOString()
        };
        
        localStorage.setItem('comprehensive_report_data', JSON.stringify(reportData));
        
        CalendarDebugger.log('종합보고서 데이터 처리 완료', 'info', reportData);
        
        updateComprehensiveReportUI(reportData);
        
        return reportData;
      } catch (error) {
        CalendarDebugger.log('종합보고서 데이터 처리 중 오류 발생', 'error', error);
        return null;
      }
    }

    // 종합보고서 UI 업데이트 함수
    function updateComprehensiveReportUI(reportData) {
      try {
        const reportContainer = document.getElementById('comprehensive-report-container');
        if (!reportContainer) {
          createComprehensiveReportUI();
          return;
        }
        
        const reportContent = document.getElementById('comprehensive-report-content');
        if (reportContent) {
          let topOrgsHTML = '';
          reportData.topOrganizations.forEach((org, index) => {
            topOrgsHTML += `
              <div class="report-item">
                <div class="report-rank">${index + 1}</div>
                <div class="report-org-name">${org.name}</div>
                <div class="report-visit-count">${org.count}회</div>
                <div class="report-last-visit">${formatDate(org.lastVisit)}</div>
              </div>
            `;
          });
          
          const months = Object.keys(reportData.monthlyDistribution).sort();
          let monthlyHTML = '';
          months.forEach(month => {
            const count = reportData.monthlyDistribution[month];
            const displayMonth = month.replace('-', '년 ') + '월';
            monthlyHTML += `
              <div class="monthly-item">
                <div class="month-name">${displayMonth}</div>
                <div class="month-bar">
                  <div class="month-bar-fill" style="width: ${Math.min(count * 5, 100)}%"></div>
                </div>
                <div class="month-count">${count}건</div>
              </div>
            `;
          });
          
          reportContent.innerHTML = `
            <div class="report-summary">
              <div class="summary-item">
                <div class="summary-value">${reportData.totalOrganizations}</div>
                <div class="summary-label">총 기관 수</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">${reportData.totalSchedules}</div>
                <div class="summary-label">총 일정 수</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">${months.length}</div>
                <div class="summary-label">활동 개월 수</div>
              </div>
            </div>
            
            <h3>방문 빈도 상위 기관</h3>
            <div class="top-organizations">
              <div class="report-header">
                <div class="report-rank">순위</div>
                <div class="report-org-name">기관명</div>
                <div class="report-visit-count">방문 횟수</div>
                <div class="report-last-visit">최근 방문일</div>
              </div>
              ${topOrgsHTML || '<div class="empty-data">데이터가 없습니다</div>'}
            </div>
            
            <h3>월별 일정 분포</h3>
            <div class="monthly-distribution">
              ${monthlyHTML || '<div class="empty-data">데이터가 없습니다</div>'}
            </div>
            
            <div class="report-footer">
              마지막 업데이트: ${new Date(reportData.lastUpdated).toLocaleString()}
            </div>
          `;
        }
      } catch (error) {
        CalendarDebugger.log('종합보고서 UI 업데이트 중 오류 발생', 'error', error);
      }
    }

    // 종합보고서 UI 생성 함수
    function createComprehensiveReportUI() {
      try {
        let reportContainer = document.getElementById('comprehensive-report-container');
        
        if (!reportContainer) {
          reportContainer = document.createElement('div');
          reportContainer.id = 'comprehensive-report-container';
          reportContainer.className = 'report-container';
          
          const reportHeader = document.createElement('div');
          reportHeader.className = 'report-header-bar';
          reportHeader.innerHTML = `
            <h2><i class="fas fa-chart-bar"></i> 종합보고서</h2>
            <div class="report-actions">
              <button id="refresh-report-btn" class="btn btn-sm btn-outline-primary">
                <i class="fas fa-sync-alt"></i> 새로고침
              </button>
              <button id="close-report-btn" class="btn btn-sm btn-outline-secondary">
                <i class="fas fa-times"></i>
              </button>
            </div>
          `;
          
          const reportContent = document.createElement('div');
          reportContent.id = 'comprehensive-report-content';
          reportContent.className = 'report-content';
          reportContent.innerHTML = '<div class="loading">보고서 데이터 로드 중...</div>';
          
          reportContainer.appendChild(reportHeader);
          reportContainer.appendChild(reportContent);
          
          const calendarContainer = document.querySelector('.calendar-container');
          if (calendarContainer) {
            calendarContainer.appendChild(reportContainer);
            
            document.getElementById('refresh-report-btn').addEventListener('click', () => {
              processComprehensiveReportData(organizations, schedules);
            });
            
            document.getElementById('close-report-btn').addEventListener('click', () => {
              reportContainer.style.display = 'none';
            });
            
            const savedReportData = localStorage.getItem('comprehensive_report_data');
            if (savedReportData) {
              try {
                const reportData = JSON.parse(savedReportData);
                updateComprehensiveReportUI(reportData);
              } catch (e) {
                CalendarDebugger.log('저장된 보고서 데이터 파싱 오류', 'error', e);
              }
            }
          } else {
            CalendarDebugger.log('캘린더 컨테이너를 찾을 수 없음', 'error');
          }
        }
      } catch (error) {
        CalendarDebugger.log('종합보고서 UI 생성 중 오류 발생', 'error', error);
      }
    }

    // 날짜 형식 변환 함수
    function formatDate(dateString) {
      if (!dateString || dateString === '방문 기록 없음') {
        return dateString;
      }
      
      try {
        return dateString.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1년 $2월 $3일');
      } catch (e) {
        return dateString;
      }
    }

    // 특정 날짜로 이동 함수
    function goToCalendarDate(dateString) {
      try {
        console.log(`날짜 이동 시도: ${dateString}`);
        
        const dateParts = dateString.split('-');
        if (dateParts.length !== 3) {
          console.error('날짜 형식이 잘못되었습니다. YYYY-MM-DD 형식이어야 합니다.');
          return;
        }
        
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1;
        const day = parseInt(dateParts[2]);
        
        const targetDate = new Date(year, month, day);
        if (isNaN(targetDate.getTime())) {
          console.error('유효하지 않은 날짜입니다.');
          return;
        }
        
        currentYear = year;
        currentMonth = month;
        currentDate = day;
        renderCalendar(currentYear, currentMonth);
        console.log(`캘린더 날짜 이동 완료: ${year}년 ${month + 1}월 ${day}일`);
      } catch (error) {
        console.error('날짜 이동 중 오류 발생:', error);
      }
    }

    // 로딩 표시기 표시 함수
    function showLoadingIndicator() {
      const loadingIndicator = document.getElementById('loading-indicator');
      if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
      }
    }

    // 로딩 표시기 숨김 함수
    function hideLoadingIndicator() {
      const loadingIndicator = document.getElementById('loading-indicator');
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
    }

    // 알림 표시 함수
    function showNotification(message, type = 'info') {
      const notification = document.getElementById('notification');
      if (notification) {
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';
        
        setTimeout(() => {
          notification.style.display = 'none';
        }, 5000);
      }
    }
    
    // 일정 추가/수정 모달 열기 함수
    async function openScheduleFormModal(dateString, scheduleId = null) {
      try {
        console.log('일정 폼 모달 열기 시작 - 날짜:', dateString, '일정 ID:', scheduleId);
        
        // 모든 모달창 닫기 (다른 모달이 열려있을 경우 닫기)
        const allModals = document.querySelectorAll('.modal');
        allModals.forEach(m => {
          m.style.display = 'none';
        });
        
        const modal = document.getElementById('schedule-form-modal');
        const modalTitle = document.getElementById('schedule-form-title');
        const form = document.getElementById('schedule-form');
        const scheduleIdInput = document.getElementById('schedule-id');
        const committeeSelect = document.getElementById('schedule-committee');
        const organizationSelect = document.getElementById('schedule-organization');
        const titleInput = document.getElementById('schedule-title');
        const dateInput = document.getElementById('schedule-date');
        const timeInput = document.getElementById('schedule-time');
        const statusSelect = document.getElementById('schedule-status');
        const notesInput = document.getElementById('schedule-notes');
        
        if (!modal || !form) {
          console.error('일정 폼 모달 요소를 찾을 수 없습니다.');
          return;
        }
        
        // 폼 초기화
        form.reset();
        
        // 날짜 설정
        if (dateInput) {
          dateInput.value = dateString;
          console.log('날짜 입력 필드 값 설정:', dateString);
        }
        
        // 위원회 옵션 설정
        if (committeeSelect) {
          committeeSelect.innerHTML = '<option value="">선택하세요</option>';
            
          // 실제 매칭 데이터에서 위원 정보 추출
          const committeeMap = new Map(); // 위원명과 위원 ID를 매핑하기 위한 Map
          
          // 기본 위원 정보 설정 (폴백용)
          const defaultCommittees = [
            { id: 'C001', name: '신용기' },
            { id: 'C002', name: '김수연' },
            { id: 'C003', name: '문일지' },
            { id: 'C004', name: '이연숙' },
            { id: 'C005', name: '이정혜' }
          ];
          
          // 매칭 데이터에서 위원 정보 추출
          if (window.allMatchings && window.allMatchings.length > 0) {
            console.log('매칭 데이터에서 위원 정보 추출 시도:', window.allMatchings.length + '개 항목');
            
            window.allMatchings.forEach(match => {
              // 영문 필드명 데이터 형식
              if (match.committeeId && match.committeeName) {
                committeeMap.set(match.committeeName, match.committeeId);
              }
              
              // 한글 필드명 데이터 형식
              if (match.위원ID && match.위원명) {
                committeeMap.set(match.위원명, match.위원ID);
              }
            });
          }
          
          // API 응답 데이터 원본 확인
          if (committeeMap.size === 0 && window.api && window.api.committees && typeof window.api.committees.getRawData === 'function') {
            try {
              // 원본 데이터에서 위원 정보 추출 (비동기 처리)
              let rawData = null;
              try {
                rawData = await window.api.committees.getRawData();
                console.log('[DEBUG] 원본 데이터 로드 성공:', rawData ? '데이터 있음' : '데이터 없음');
              } catch (error) {
                console.error('[DEBUG] 원본 데이터 로드 중 오류:', error);
              }
              
              if (rawData && rawData.data && Array.isArray(rawData.data.rows)) {
                console.log('원본 데이터에서 위원 정보 추출 시도:', rawData.data.rows.length + '개 행');
                
                // 모든 행에서 위원 ID와 이름 추출
                rawData.data.rows.forEach((row, index) => {
                  if (row && row.length > 1 && row[0] && row[1]) {
                    const committeeId = row[0]; // 위원 ID는 첫 번째 열
                    const committeeName = row[1]; // 위원명은 두 번째 열
                    committeeMap.set(committeeName, committeeId);
                  }
                });
              }
            } catch (error) {
              console.error('원본 데이터에서 위원 정보 추출 중 오류:', error);
            }
          }
          
          // 위원 데이터가 없는 경우 폴백 데이터 사용
          if (committeeMap.size === 0) {
            console.log('위원 데이터가 없습니다. 기본 위원 목록을 사용합니다.');
            defaultCommittees.forEach(committee => {
              committeeMap.set(committee.name, committee.id);
            });
          }
          
          console.log('추출된 전체 위원 정보:', Array.from(committeeMap.entries()));
          console.log('매칭 데이터에서 추출한 위원 수:', committeeMap.size);
          
          // 위원 옵션 추가 (이름 알파벳 순 정렬)
          Array.from(committeeMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0], 'ko'))
            .forEach(([name, id]) => {
              const option = document.createElement('option');
              option.value = id;
              option.textContent = name;
              option.dataset.committeeId = id; // 데이터 속성에 위원 ID 저장
              committeeSelect.appendChild(option);
            });
          
          // 위원 변경 이벤트 처리
          committeeSelect.addEventListener('change', function() {
            const selectedCommitteeName = committeeSelect.options[committeeSelect.selectedIndex].text;
            
            try {
              // 기관 선택 초기화
              organizationSelect.innerHTML = '<option value="">기관 선택</option>';
              
              // getCommitteePrimaryOrgs 함수로 주담당 기관 코드 가져오기
              const matchedOrgCodes = getCommitteePrimaryOrgs(selectedCommitteeName);
              let filteredOrgs = [];
              
              console.log(`${selectedCommitteeName} 위원의 주담당 기관 코드:`, matchedOrgCodes);
              
              if (matchedOrgCodes.length > 0) {
                // 주담당 기관만 필터링
                filteredOrgs = organizations.filter(org => 
                  matchedOrgCodes.includes(org.code || org.id)
                );
                
                // 주담당 기관이 없으면 전체 기관 표시
                if (filteredOrgs.length === 0) {
                  console.log(`${selectedCommitteeName} 위원의 주담당 기관이 없어 전체 기관 표시`);
                  filteredOrgs = organizations;
                }
              }
              
              console.log(`${selectedCommitteeName} 위원의 매칭 정보:`, {
                matchedOrgCodes: matchedOrgCodes,
                allMatchingsLength: window.allMatchings ? window.allMatchings.length : 0
              });
              
              // 기관 목록 정렬 (기관명 알파벳 순)
            filteredOrgs.sort((a, b) => {
              const nameA = a.name || '';
              const nameB = b.name || '';
              return nameA.localeCompare(nameB);
            });
            
            // 기관 옵션 추가
            filteredOrgs.forEach(org => {
              if (org && (org.code || org.id) && org.name) {
                const option = document.createElement('option');
                option.value = org.code || org.id;
                option.textContent = org.name;
                organizationSelect.appendChild(option);
              }
            });
          } catch (error) {
            console.error('위원 변경 이벤트 처리 중 오류:', error);
            filteredOrgs = organizations;
          }
          });
          
          // 현재 사용자가 위원인 경우 자동 선택
          if (currentUser && currentUser.role === 'committee' && currentUser.id) {
            committeeSelect.value = currentUser.id;
            
            // 위원 변경 이벤트 트리거하여 기관 목록 자동 업데이트
            const changeEvent = new Event('change');
            committeeSelect.dispatchEvent(changeEvent);
          }
        }
        
        // 위원 변경 시 기관 옵션 업데이트 (추가 기능)
        if (committeeSelect) {
          // 기존 이벤트 리스너 제거 (중복 등록 방지)
          const oldListeners = committeeSelect.getEventListeners ? committeeSelect.getEventListeners('change') : [];
          if (oldListeners && oldListeners.length > 0) {
            oldListeners.forEach(listener => {
              committeeSelect.removeEventListener('change', listener);
            });
          } else {
            // 이벤트 리스너 클론 생성 (이전 리스너 제거를 위해)
            committeeSelect.oldChangeListener = committeeSelect.oldChangeListener || function() {};
            committeeSelect.removeEventListener('change', committeeSelect.oldChangeListener);
          }
          
          // 새 이벤트 리스너 등록
          committeeSelect.oldChangeListener = function() {
            const selectedCommitteeName = committeeSelect.options[committeeSelect.selectedIndex]?.text || '';
            const selectedCommitteeId = committeeSelect.value || '';
            
            if (!selectedCommitteeName || selectedCommitteeName === '선택하세요') {
              console.log('유효한 위원이 선택되지 않았습니다.');
              return;
            }
            
            console.log(`위원 선택 변경 감지: ${selectedCommitteeName} (${selectedCommitteeId})`);
            
            // 기관 선택 초기화
            if (organizationSelect) {
              organizationSelect.innerHTML = '<option value="">선택하세요</option>';
              
              try {
                // 위원의 주담당 기관 코드 가져오기
                const matchedOrgCodes = getCommitteePrimaryOrgs(selectedCommitteeName);
                console.log(`${selectedCommitteeName} 위원의 주담당 기관 코드:`, matchedOrgCodes);
                
                // 매칭된 기관 필터링 및 표시
                updateOrganizationOptions(organizationSelect, matchedOrgCodes, selectedCommitteeName);
                
                // 저장된 기관 코드가 있는 경우 선택 시도
                if (window.pendingOrgCode) {
                  setTimeout(() => {
                    console.log('저장된 기관 코드로 선택 시도:', window.pendingOrgCode);
                    for (let i = 0; i < organizationSelect.options.length; i++) {
                      if (organizationSelect.options[i].value === window.pendingOrgCode) {
                        organizationSelect.selectedIndex = i;
                        console.log('기관 선택 완료:', organizationSelect.options[i].text);
                        break;
                      }
                    }
                  }, 300);
                }
              } catch (error) {
                console.error(`위원 변경 이벤트 처리 중 오류:`, error);
              }
            }
          };
          
          // 새 이벤트 리스너 등록
          committeeSelect.addEventListener('change', committeeSelect.oldChangeListener);
        }
        
        // 기관 옵션 업데이트 함수 (재사용을 위해 함수로 분리)
        async function updateOrganizationOptions(selectElement, matchedOrgCodes = [], committeeName = '') {
          // 모든 기관 데이터 수집
          const allOrgs = new Set();
          
          // 매칭 데이터에서 기관 정보 추출
          if (window.allMatchings && window.allMatchings.length > 0) {
            window.allMatchings.forEach(match => {
              if (match.orgCode && match.orgName) {
                allOrgs.add(JSON.stringify({
                  code: match.orgCode,
                  name: match.orgName,
                  region: match.region || ''
                }));
              } else if (match.기관코드 && match.기관명) {
                allOrgs.add(JSON.stringify({
                  code: match.기관코드,
                  name: match.기관명,
                  region: match.지역 || ''
                }));
              }
            });
          }
          
          // API 원본 데이터에서 기관 정보 추출 (비동기 처리)
          let rawData = null;
          try {
            if (window.api && window.api.committees && typeof window.api.committees.getRawData === 'function') {
              rawData = await window.api.committees.getRawData();
              console.log('[DEBUG] 기관 정보용 원본 데이터 로드 성공:', rawData ? '데이터 있음' : '데이터 없음');
            }
          } catch (error) {
            console.error('[DEBUG] 기관 정보용 원본 데이터 로드 중 오류:', error);
          }
          
          if (rawData && rawData.data && Array.isArray(rawData.data.rows)) {
            rawData.data.rows.forEach(row => {
              if (row && row.length > 3 && row[3] && row[4]) {
                allOrgs.add(JSON.stringify({
                  code: row[3],
                  name: row[4],
                  region: row[5] || ''
                }));
              }
            });
          }
          
          // 기본 기관 데이터는 실제 데이터가 없을 경우에만 사용
          if (allOrgs.size === 0 && organizations && organizations.length > 0) {
            organizations.forEach(org => {
              if (org.code || org.id) {
                allOrgs.add(JSON.stringify({
                  code: org.code || org.id,
                  name: org.name,
                  region: org.region || ''
                }));
              }
            });
          }
          
          // JSON 문자열을 객체로 변환
          const realOrganizations = Array.from(allOrgs).map(org => JSON.parse(org));
          console.log('사용 가능한 기관 수:', realOrganizations.length);
          
          // 매칭된 기관만 필터링 (있는 경우)
          let filteredOrgs = realOrganizations;
          if (matchedOrgCodes && matchedOrgCodes.length > 0) {
            filteredOrgs = realOrganizations.filter(org => 
              matchedOrgCodes.includes(org.code)
            );
            
            // 매칭된 기관이 없으면 전체 기관 표시
            if (filteredOrgs.length === 0) {
              console.log(committeeName ? `${committeeName} 위원에게 매칭된 기관이 없어 전체 기관 표시` : '매칭된 기관이 없어 전체 기관 표시');
              filteredOrgs = realOrganizations;
            }
          }
          
          // 기관 목록 정렬 (기관명 알파벳 순)
          filteredOrgs.sort((a, b) => {
            const nameA = a.name || '';
            const nameB = b.name || '';
            return nameA.localeCompare(nameB, 'ko');
          });
          
          // 기관 옵션 추가
          filteredOrgs.forEach(org => {
            if (org && org.code && org.name) {
              const option = document.createElement('option');
              option.value = org.code;
              option.textContent = org.region ? `${org.name} (${org.region})` : org.name;
              selectElement.appendChild(option);
            }
          });
          
          return filteredOrgs.length;
        }
        
        
        // 기관 옵션 설정
        if (organizationSelect) {
          organizationSelect.innerHTML = '<option value="">선택하세요</option>';
          
          // 선택된 위원에 따른 기관 목록 필터링
          const selectedCommittee = committeeSelect.value;
          const organizations = new Set();
          if (window.allMatchings && window.allMatchings.length > 0) {
            window.allMatchings.forEach(match => {
              // 영문 필드명 형식
              if (match.orgCode && match.orgName) {
                organizations.add(JSON.stringify({
                  code: match.orgCode,
                  name: match.orgName,
                  region: match.region || ''
                }));
              }
              
              // 한글 필드명 형식
              if (match.기관코드 && match.기관명) {
                organizations.add(JSON.stringify({
                  code: match.기관코드,
                  name: match.기관명,
                  region: match.지역 || ''
                }));
              }
            });
          }
          
          // API 원본 데이터에서 기관 정보 추출
          const rawData = window.api && window.api.committees && 
                         typeof window.api.committees.getRawData === 'function' && 
                         window.api.committees.getRawData();
                         
          if (rawData && rawData.data && Array.isArray(rawData.data.rows)) {
            rawData.data.rows.forEach(row => {
              if (row && row.length > 3 && row[3] && row[4]) {
                organizations.add(JSON.stringify({
                  code: row[3], // 기관코드는 네 번째 열
                  name: row[4], // 기관명은 다섯 번째 열
                  region: row[5] || '' // 지역은 여섯 번째 열
                }));
              }
            });
          }
          
          // JSON 문자열을 객체로 변환
          const realOrganizations = Array.from(organizations).map(org => JSON.parse(org));
          console.log('추출된 전체 기관 수:', realOrganizations.length);
          
          // 위원과 기관 매칭 정보 확인
          let filteredOrgs = realOrganizations;
          const selectedCommitteeName = committeeSelect && committeeSelect.selectedIndex > 0 ? 
                                      committeeSelect.options[committeeSelect.selectedIndex].text : '';
          
          if (selectedCommitteeName) {
            try {
              console.log(`선택된 위원: ${selectedCommitteeName}, 매칭 정보 확인`);
              
              // getCommitteePrimaryOrgs 함수를 사용하여 주담당 기관 코드 가져오기
              const matchedOrgCodes = getCommitteePrimaryOrgs(selectedCommitteeName);
              
              if (matchedOrgCodes.length > 0) {
                console.log(`${selectedCommitteeName} 위원이 주담당인 기관 코드:`, matchedOrgCodes);
                
                // 매칭된 기관만 필터링
                filteredOrgs = realOrganizations.filter(org => 
                  matchedOrgCodes.includes(org.code)
                );
                
                // 매칭된 기관이 없으면 전체 기관 표시
                if (filteredOrgs.length === 0) {
                  console.log(`${selectedCommitteeName} 위원에게 매칭된 기관이 없어 전체 기관 표시`);
                  filteredOrgs = realOrganizations;
                }
              } else {
                console.log(`${selectedCommitteeName} 위원이 주담당인 기관이 없습니다.`);
              }
            } catch (error) {
              console.error(`위원에 대한 기관 매칭 정보 처리 중 오류:`, error);
            }
          }
          
          // 기관 목록 정렬 (기관명 알파벳 순)
          filteredOrgs.sort((a, b) => {
            const nameA = a.name || '';
            const nameB = b.name || '';
            return nameA.localeCompare(nameB, 'ko');
          });
          
          // 기관 옵션 추가
          filteredOrgs.forEach(org => {
            if (org && org.code && org.name) {
              const option = document.createElement('option');
              option.value = org.code;
              option.textContent = org.region ? `${org.name} (${org.region})` : org.name;
              organizationSelect.appendChild(option);
            }
          });
          
          // 기관 목록이 없는 경우 안내 메시지
          if (organizationSelect.options.length <= 1) {
            console.warn('기관 목록을 가져오지 못했습니다. 데이터를 확인해주세요.');
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '기관 데이터를 불러올 수 없습니다';
            option.disabled = true;
            organizationSelect.appendChild(option);
          }
        }
        
        // 기존 일정 수정인 경우
        if (scheduleId) {
          const schedule = schedules.find(s => s.id === scheduleId);
          if (schedule) {
            modalTitle.textContent = '일정 수정';
            scheduleIdInput.value = schedule.id;
            
            // 기존 일정 정보를 window.existingScheduleToLoad에 저장
            window.existingScheduleToLoad = schedule;
            console.log('기존 일정 정보 저장:', window.existingScheduleToLoad);
            
            // 위원 선택
            if (committeeSelect) {
              const committeeId = schedule.committeeId || '';
              const committeeName = schedule.committeeName || '';
              
              console.log('기존 일정의 위원 정보:', committeeId, committeeName);
              
              // 위원 ID로 먼저 시도
              let found = false;
              if (committeeId) {
                for (let i = 0; i < committeeSelect.options.length; i++) {
                  if (committeeSelect.options[i].value === committeeId) {
                    committeeSelect.selectedIndex = i;
                    console.log('위원 ID로 선택 완료:', committeeSelect.options[i].text);
                    found = true;
                    break;
                  }
                }
              }
              
              // 위원 ID로 찾지 못하면 위원명으로 시도
              if (!found && committeeName) {
                for (let i = 0; i < committeeSelect.options.length; i++) {
                  if (committeeSelect.options[i].text === committeeName) {
                    committeeSelect.selectedIndex = i;
                    console.log('위원명으로 선택 완료:', committeeSelect.options[i].text);
                    found = true;
                    break;
                  }
                }
              }
              
              // 위원 선택 변경 이벤트 수동 호출
              if (found) {
                const changeEvent = new Event('change');
                committeeSelect.dispatchEvent(changeEvent);
                
                // 기관 선택을 위한 전역 변수 설정
                window.pendingOrgCode = schedule.orgCode || schedule.organizationCode || '';
                console.log('기존 일정의 기관 코드 저장:', window.pendingOrgCode);
                
                // 기관 선택 지연 설정 (위원 변경 이벤트가 처리된 후)
                setTimeout(() => {
                  if (organizationSelect && window.pendingOrgCode) {
                    console.log('기존 일정의 기관 정보 설정 시도:', window.pendingOrgCode);
                    
                    // 기관 선택이 없는 경우 처리
                    if (organizationSelect.options.length <= 1) {
                      console.warn('기관 선택지 없음: 위원에 매칭된 기관이 없거나 아직 로드되지 않았습니다.');
                      return;
                    }
                    
                    // 기관 코드에 매칭되는 옵션 찾기
                    let found = false;
                    for (let i = 0; i < organizationSelect.options.length; i++) {
                      if (organizationSelect.options[i].value === window.pendingOrgCode) {
                        organizationSelect.selectedIndex = i;
                        console.log('기관 선택 완료:', organizationSelect.options[i].text);
                        found = true;
                        break;
                      }
                    }
                    
                    // 매칭되는 기관이 없는 경우 처리
                    if (!found && organizationSelect.options.length > 1) {
                      console.warn('일치하는 기관 코드를 찾지 못함:', window.pendingOrgCode);
                      console.log('처음 발견된 기관으로 설정');
                      organizationSelect.selectedIndex = 1; // 첫 번째 유효한 기관 선택
                    }
                    
                    // 전역 변수 초기화
                    window.pendingOrgCode = null;
                  }
                }, 800); // 위원 변경 이벤트가 처리되고 기관 목록이 업데이트될 시간 여유 확보
              } else {
                // 위원을 찾지 못한 경우 직접 값 설정
                committeeSelect.value = committeeId || '';
                if (organizationSelect) {
                  organizationSelect.value = schedule.orgCode || schedule.organizationCode || '';
                }
              }
            } else if (organizationSelect) {
              // committeeSelect가 없는 경우 직접 기관 설정
              organizationSelect.value = schedule.orgCode || schedule.organizationCode || '';
            }
            if (titleInput) titleInput.value = schedule.title || '';
            if (dateInput) dateInput.value = schedule.scheduleDate || schedule.date || schedule.startDate || dateString;
            if (timeInput) timeInput.value = schedule.time || '';
            if (statusSelect) statusSelect.value = schedule.status || 'pending';
            if (notesInput) notesInput.value = schedule.notes || '';
            
            // 삭제 버튼 표시
            const deleteBtn = document.getElementById('delete-schedule-btn');
            if (deleteBtn) {
              deleteBtn.style.display = 'inline-block';
            }
          }
        } else {
          // 새 일정 추가인 경우
          modalTitle.textContent = '일정 추가';
          scheduleIdInput.value = '';
          
          // 기본값 설정
          if (statusSelect) statusSelect.value = 'pending';
          
          // 삭제 버튼 숨김
          const deleteBtn = document.getElementById('delete-schedule-btn');
          if (deleteBtn) {
            deleteBtn.style.display = 'none';
          }
        }
        
        // 모달 표시
        modal.style.display = 'block';
        console.log('일정 추가/수정 모달 표시 완료');
        
        // 모달 닫기 버튼 이벤트 리스너 추가
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
          });
        }
        
        // 모달 외부 클릭 시 닫기
        const closeModalOnOutsideClick = (e) => {
          if (e.target === modal) {
            modal.style.display = 'none';
            window.removeEventListener('click', closeModalOnOutsideClick);
          }
        };
        window.addEventListener('click', closeModalOnOutsideClick);
      } catch (error) {
        console.error('일정 폼 모달 열기 중 오류:', error);
      }
    }
    
    // 날짜별 일정 모달 표시 함수
    function showDateSchedules(dateString) {
      try {
        const dateSchedules = schedules.filter(schedule => {
          const scheduleDate = schedule.scheduleDate || schedule.date || schedule.startDate;
          return scheduleDate === dateString;
        });
        
        const modal = document.getElementById('schedules-list-modal');
        const modalTitle = document.getElementById('schedules-list-modal-title');
        const schedulesList = document.getElementById('schedules-list');
        
        if (!modal || !modalTitle || !schedulesList) {
          console.error('일정 목록 모달 요소를 찾을 수 없습니다.');
          return;
        }
        
        const formattedDate = dateString.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1년 $2월 $3일');
        modalTitle.textContent = `${formattedDate} 일정`;
        
        schedulesList.innerHTML = '';
        
        // 일정 추가 버튼 추가
        const addButtonContainer = document.createElement('div');
        addButtonContainer.className = 'add-schedule-container';
        addButtonContainer.innerHTML = `
          <button id="add-schedule-btn" class="btn btn-primary">
            <i class="fas fa-plus"></i> 새 일정 추가
          </button>
        `;
        schedulesList.appendChild(addButtonContainer);
        
        // 일정 추가 버튼 클릭 이벤트
        document.getElementById('add-schedule-btn').addEventListener('click', () => {
          openScheduleFormModal(dateString);
          modal.style.display = 'none'; // 목록 모달 닫기
        });
        
        if (dateSchedules.length === 0) {
          const emptyMessage = document.createElement('div');
          emptyMessage.className = 'empty-message';
          emptyMessage.innerHTML = `
            <i class="fas fa-calendar-times"></i>
            <p>이 날짜에 등록된 일정이 없습니다.</p>
          `;
          schedulesList.appendChild(emptyMessage);
        } else {
          const countInfo = document.createElement('div');
          countInfo.className = 'schedule-count';
          countInfo.innerHTML = `총 <strong>${dateSchedules.length}</strong>개의 일정`;
          schedulesList.appendChild(countInfo);
          
          // 일정 목록 추가
          dateSchedules.forEach(schedule => {
            const scheduleItem = document.createElement('div');
            scheduleItem.classList.add('schedule-item');
            scheduleItem.dataset.id = schedule.id;
            
            if (schedule.status === 'completed') {
              scheduleItem.classList.add('completed');
            } else if (schedule.status === 'pending') {
              scheduleItem.classList.add('pending');
            } else if (schedule.status === 'canceled') {
              scheduleItem.classList.add('canceled');
            }
            
            let orgName = '';
            if (schedule.organizationName) {
              orgName = schedule.organizationName;
            } else if (schedule.orgName) {
              orgName = schedule.orgName;
            } else if (schedule.orgCode || schedule.organizationCode) {
              const orgCode = schedule.orgCode || schedule.organizationCode;
              orgName = getOrganizationName(orgCode);
            } else {
              orgName = '기관 미지정';
            }
            
            let committeeName = schedule.committeeName || '담당자 미지정';
            let timeInfo = schedule.time || '종일';
            const title = schedule.title || `${orgName} 방문`;
            
            let statusText = '';
            let statusClass = '';
            
            if (schedule.status === 'completed') {
              statusText = '완료';
              statusClass = 'completed';
            } else if (schedule.status === 'pending') {
              statusText = '예정';
              statusClass = 'pending';
            } else if (schedule.status === 'canceled') {
              statusText = '취소';
              statusClass = 'canceled';
            }
            
            const committeeColor = getCommitteeColor(schedule.committeeId);
            const dotColor = schedule.status === 'completed' ? '#4caf50' : 
                           schedule.status === 'pending' ? '#ffc107' : 
                           schedule.status === 'canceled' ? '#f44336' : 
                           committeeColor;
            
            scheduleItem.innerHTML = `
              <div class="schedule-header">
                <div class="schedule-dot" style="background-color: ${dotColor};"></div>
                <div class="schedule-title">${title}</div>
                ${statusText ? `<span class="status-badge ${statusClass}">${statusText}</span>` : ''}
              </div>
              <div class="schedule-details">
                <div class="schedule-time"><i class="far fa-clock"></i> ${timeInfo}</div>
                <div class="schedule-info">
                  <span class="committee"><i class="far fa-user"></i> ${committeeName}</span>
                  <span class="org"><i class="far fa-building"></i> ${orgName}</span>
                </div>
                ${schedule.notes ? `<div class="schedule-notes">${schedule.notes}</div>` : ''}
              </div>
              <div class="schedule-actions">
                <button class="btn btn-sm btn-primary edit-btn"><i class="fas fa-edit"></i> 수정</button>
                <button class="btn btn-sm btn-danger delete-btn"><i class="fas fa-trash-alt"></i> 삭제</button>
              </div>
            `;
            
            schedulesList.appendChild(scheduleItem);
            
            // 수정 버튼 클릭 이벤트
            const editBtn = scheduleItem.querySelector('.edit-btn');
            if (editBtn) {
              editBtn.addEventListener('click', () => {
                openScheduleFormModal(dateString, schedule.id);
                modal.style.display = 'none';
              });
            }
            
            // 삭제 버튼 클릭 이벤트
            const deleteBtn = scheduleItem.querySelector('.delete-btn');
            if (deleteBtn) {
              deleteBtn.addEventListener('click', () => {
                if (confirm('정말로 이 일정을 삭제하시겠습니까?')) {
                  const index = schedules.findIndex(s => s.id === schedule.id);
                  if (index !== -1) {
                    schedules.splice(index, 1);
                    saveSchedulesToLocalStorage();
                    showNotification('일정이 삭제되었습니다.', 'success');
                    renderCalendar(currentYear, currentMonth);
                    modal.style.display = 'none';
                  }
                }
              });
            }
          });
        }
        
        modal.style.display = 'block';
        
        // 이벤트 발생
        const event = new CustomEvent('date-cell-click', {
          detail: { date: dateString }
        });
        document.dispatchEvent(event);
      } catch (error) {
        console.error('날짜별 일정 모달 표시 중 오류:', error);
      }
    }
    
    // 일정 저장 함수
    function saveSchedule() {
      try {
        const form = document.getElementById('schedule-form');
        const scheduleIdInput = document.getElementById('schedule-id');
        const committeeSelect = document.getElementById('schedule-committee');
        const organizationSelect = document.getElementById('schedule-organization');
        const titleInput = document.getElementById('schedule-title');
        const dateInput = document.getElementById('schedule-date');
        const timeInput = document.getElementById('schedule-time');
        const statusSelect = document.getElementById('schedule-status');
        const notesInput = document.getElementById('schedule-notes');
        
        // 필수 입력값 검증
        if (!dateInput || !dateInput.value) {
          showNotification('날짜를 입력해주세요.', 'error');
          return;
        }
        
        if (!committeeSelect || !committeeSelect.value) {
          showNotification('담당 위원을 선택해주세요.', 'error');
          return;
        }
        
        // 일정 데이터 생성
        const scheduleData = {
          committeeId: committeeSelect.value,
          committeeName: committeeSelect.options[committeeSelect.selectedIndex].text,
          scheduleDate: dateInput.value,
          // 날짜 필드 추가 - 다른 페이지와 호환성을 위해
          date: dateInput.value,
          visitDate: dateInput.value,
          time: timeInput ? timeInput.value : '',
          startTime: timeInput ? timeInput.value.split('-')[0].trim() : '미지정',
          endTime: timeInput && timeInput.value.includes('-') ? timeInput.value.split('-')[1].trim() : '미지정',
          status: statusSelect ? statusSelect.value : 'pending',
          notes: notesInput ? notesInput.value : '',
          memo: notesInput ? notesInput.value : ''
        };
        
        // 기관 정보 추가
        if (organizationSelect && organizationSelect.value) {
          scheduleData.orgCode = organizationSelect.value;
          scheduleData.organizationName = organizationSelect.options[organizationSelect.selectedIndex].text;
        }
        
        // 제목 설정
        if (titleInput && titleInput.value) {
          scheduleData.title = titleInput.value;
        } else if (scheduleData.organizationName) {
          scheduleData.title = `${scheduleData.organizationName} 방문`;
        } else {
          scheduleData.title = '일정';
        }
        
        // 기존 일정 수정인 경우
        if (scheduleIdInput && scheduleIdInput.value) {
          const scheduleId = scheduleIdInput.value;
          const index = schedules.findIndex(s => s.id === scheduleId);
          
          if (index !== -1) {
            // 기존 일정 업데이트
            scheduleData.id = scheduleId;
            schedules[index] = { ...schedules[index], ...scheduleData };
            showNotification('일정이 수정되었습니다.', 'success');
          }
        } else {
          // 새 일정 추가
          scheduleData.id = `schedule_${Date.now()}`;
          schedules.push(scheduleData);
          showNotification('새 일정이 추가되었습니다.', 'success');
        }
        
        // 로컬 스토리지에 저장
        saveSchedulesToLocalStorage();
        
        // 마스터 대시보드 데이터 업데이트 이벤트 발생
        // 일정 변경사항을 다른 페이지에도 반영
        document.dispatchEvent(new CustomEvent('masterDashboardDataUpdated', {
          detail: {
            type: scheduleIdInput && scheduleIdInput.value ? 'update' : 'add',
            data: scheduleData
          }
        }));
        
        // 캘린더 다시 렌더링
        renderCalendar(currentYear, currentMonth);
        
        // 모달 닫기
        const modal = document.getElementById('schedule-form-modal');
        if (modal) {
          modal.style.display = 'none';
        }
      } catch (error) {
        console.error('일정 저장 중 오류:', error);
        showNotification('일정 저장 중 오류가 발생했습니다.', 'error');
      }
    }
    
    // 일정 삭제 함수
    function deleteSchedule() {
      try {
        const scheduleIdInput = document.getElementById('schedule-id');
        
        if (!scheduleIdInput || !scheduleIdInput.value) {
          showNotification('삭제할 일정을 찾을 수 없습니다.', 'error');
          return;
        }
        
        const scheduleId = scheduleIdInput.value;
        const index = schedules.findIndex(s => s.id === scheduleId);
        
        if (index !== -1) {
          // 일정 삭제 확인
          if (confirm('정말로 이 일정을 삭제하시겠습니까?')) {
            schedules.splice(index, 1);
            
            // 로컬 스토리지에 저장
            saveSchedulesToLocalStorage();
            
            // 캘린더 다시 렌더링
            renderCalendar(currentYear, currentMonth);
            
            showNotification('일정이 삭제되었습니다.', 'success');
            
            // 모달 닫기
            const modal = document.getElementById('schedule-form-modal');
            if (modal) {
              modal.style.display = 'none';
            }
          }
        } else {
          showNotification('삭제할 일정을 찾을 수 없습니다.', 'error');
        }
      } catch (error) {
        console.error('일정 삭제 중 오류:', error);
        showNotification('일정 삭제 중 오류가 발생했습니다.', 'error');
      }
    }

    // 전역 함수로 등록
    window.goToCalendarDate = goToCalendarDate;
    window.processComprehensiveReport = processComprehensiveReportData;

    // 캘린더 객체 반환
    calendar.init = init;
    calendar.renderCalendar = renderCalendar;
    calendar.getOrganizationName = getOrganizationName;
    calendar.mapCommitteeName = mapCommitteeName;
    calendar.getSchedules = getSchedules;
    calendar.getCommittees = getCommittees;
    calendar.getOrganizations = getOrganizations;
    calendar.setupEventListeners = setupEventListeners;
    calendar.showLoadingIndicator = showLoadingIndicator;
    calendar.hideLoadingIndicator = hideLoadingIndicator;
    calendar.showNotification = showNotification;
    calendar.goToCalendarDate = goToCalendarDate;
    calendar.showDateSchedules = showDateSchedules;
    calendar.saveSchedulesToLocalStorage = saveSchedulesToLocalStorage;
    calendar.loadSchedulesFromLocalStorage = loadSchedulesFromLocalStorage;
    calendar.processComprehensiveReportData = processComprehensiveReportData;
    calendar.showScheduleDetail = showScheduleDetail;
    calendar.openScheduleFormModal = openScheduleFormModal;
    
    return calendar;
  }

  // DOM이 로드되면 캠린더 기능 설정
  document.addEventListener('DOMContentLoaded', function() {
    CalendarDebugger.log('캠린더 DOM 로드 완료');
    
    // 현재 페이지가 캠린더 페이지인지 확인
    const isCalendarPage = document.getElementById('calendar-grid') !== null && 
                          document.getElementById('month-year') !== null;
    
    if (!isCalendarPage) {
      CalendarDebugger.log('캠린더 페이지가 아닙니다. 캠린더 초기화를 건너뚠니다.', 'info');
      return; // 캠린더 페이지가 아니면 초기화를 건너뚠
    }
    
    // 필요한 DOM 요소가 있는지 확인
    const hasCalendarGrid = CalendarDebugger.checkElement('#calendar-grid', '캠린더 그리드');
    const hasMonthYear = CalendarDebugger.checkElement('#month-year', '년월 화면');
    
    if (!hasCalendarGrid || !hasMonthYear) {
      CalendarDebugger.log('필수 캠린더 요소가 없습니다. 캠린더 초기화를 건너뚠니다.', 'warning');
      return; // 필수 요소가 없으면 초기화를 건너뚠
    }
    
    try {
      CalendarDebugger.log('캠린더 설정 함수 호출');
      window.calendarApp = setupCalendar();
      
      CalendarDebugger.log('비동기 초기화 시작, 500ms 후 실행');
      setTimeout(function() {
        try {
          // 요소가 여전히 존재하는지 다시 확인
          if (document.getElementById('calendar-grid') && document.getElementById('month-year')) {
            CalendarDebugger.log('초기화 함수 호출 시작');
            window.calendarApp.init();
            CalendarDebugger.log('달력 초기화 성공');
          } else {
            CalendarDebugger.log('초기화 시점에 캠린더 요소가 없습니다.', 'warning');
          }
        } catch (error) {
          CalendarDebugger.log(`달력 초기화 중 오류 발생: ${error.message}`, 'error');
          
          // 요소가 여전히 존재하는지 확인 후 렌더링 시도
          if (document.getElementById('calendar-grid') && document.getElementById('month-year')) {
            CalendarDebugger.log('달력 강제 렌더링 시도');
            try {
              const today = new Date();
              window.calendarApp.renderCalendar(today.getFullYear(), today.getMonth());
              CalendarDebugger.log('달력 강제 렌더링 완료');
            } catch (renderError) {
              CalendarDebugger.log(`달력 강제 렌더링 시 오류: ${renderError.message}`, 'error');
            }
          } else {
            CalendarDebugger.log('렌더링 시도 시점에 캠린더 요소가 없습니다.', 'warning');
          }
        }
        
        setTimeout(() => {
          CalendarDebugger.printStatus();
        }, 1000);
      }, 500);
      
      // 로딩 표시기 숨기기
      const loadingElement = document.getElementById('initial-loading');
      if (loadingElement) {
        loadingElement.style.display = 'none';
        console.log('로딩 표시기 숨김');
      }
    } catch (error) {
      CalendarDebugger.log(`캠린더 설정 중 오류 발생: ${error.message}`, 'error');
      CalendarDebugger.printStatus();
    }
  });

})(); // 즉시 실행 함수 끝
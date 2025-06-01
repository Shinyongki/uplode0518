// 일정 관리 관련 JavaScript 코드
(function() {
  // 전역 변수
  let currentSchedule = null;
  let currentCommittee = null;
  let committeeOrganizations = [];
  
  // DOM 요소
  const scheduleModal = document.getElementById('schedule-modal');
  const scheduleForm = document.getElementById('schedule-form');
  const scheduleViewModal = document.getElementById('schedule-view-modal');
  const scheduleViewContent = document.getElementById('schedule-view-content');
  
  // 모달 열기/닫기 버튼
  const closeScheduleModalBtn = document.getElementById('close-schedule-modal');
  const closeScheduleViewModalBtn = document.getElementById('close-schedule-view-modal');
  const editScheduleBtn = document.getElementById('edit-schedule');
  const deleteScheduleBtn = document.getElementById('delete-schedule');
  
  // 폼 요소
  const scheduleIdInput = document.getElementById('schedule-id');
  const scheduleDateInput = document.getElementById('schedule-date');
  const scheduleTimeInput = document.getElementById('schedule-time');
  const scheduleTitleInput = document.getElementById('schedule-title');
  const committeeInfoDiv = document.getElementById('committee-info');
  const scheduleOrgSelect = document.getElementById('schedule-organization');
  const scheduleDescInput = document.getElementById('schedule-description');
  const scheduleStatusSelect = document.getElementById('schedule-status');
  
  // 초기화 함수
  function init() {
    // 이벤트 리스너 등록
    if (closeScheduleModalBtn) {
      closeScheduleModalBtn.addEventListener('click', closeScheduleModal);
    }
    
    if (closeScheduleViewModalBtn) {
      closeScheduleViewModalBtn.addEventListener('click', closeScheduleViewModal);
    }
    
    if (editScheduleBtn) {
      editScheduleBtn.addEventListener('click', handleEditSchedule);
    }
    
    if (deleteScheduleBtn) {
      deleteScheduleBtn.addEventListener('click', handleDeleteSchedule);
    }
    
    if (scheduleForm) {
      scheduleForm.addEventListener('submit', handleScheduleSubmit);
    }
    
    // 날짜 셀 클릭 이벤트 리스너 등록 (캘린더.js에서 호출)
    document.addEventListener('date-cell-click', function(e) {
      const date = e.detail.date;
      openAddScheduleModal(date);
    });
    
    // 일정 클릭 이벤트 리스너 등록 (캘린더.js에서 호출)
    document.addEventListener('schedule-click', function(e) {
      const scheduleId = e.detail.scheduleId;
      openViewScheduleModal(scheduleId);
    });
    
    console.log('일정 관리 모듈 초기화 완료');
  }
  
  // 일정 추가 모달 열기
  function openAddScheduleModal(date) {
    // 현재 사용자 정보 가져오기
    currentCommittee = window.getCurrentCommittee ? window.getCurrentCommittee() : null;
    
    if (!currentCommittee) {
      alert('위원 정보를 찾을 수 없습니다. 로그인 후 다시 시도해주세요.');
      return;
    }
    
    // 모달 제목 설정
    document.getElementById('schedule-modal-title').textContent = '일정 등록';
    
    // 폼 초기화
    scheduleForm.reset();
    scheduleIdInput.value = '';
    
    // 날짜 설정
    if (date) {
      scheduleDateInput.value = date;
    } else {
      // 오늘 날짜로 설정
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      scheduleDateInput.value = `${year}-${month}-${day}`;
    }
    
    // 시간 설정 (기본값: 현재 시간)
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    scheduleTimeInput.value = `${hours}:${minutes}`;
    
    // 위원 정보 표시
    displayCommitteeInfo(currentCommittee);
    
    // 기관 목록 로드
    loadOrganizationOptions(currentCommittee);
    
    // 삭제 버튼 숨기기
    deleteScheduleBtn.classList.add('hidden');
    
    // 모달 표시
    scheduleModal.classList.remove('hidden');
    scheduleModal.classList.add('flex');
  }
  
  // 일정 보기 모달 열기
  function openViewScheduleModal(scheduleId) {
    // 일정 정보 가져오기
    const schedule = window.getScheduleById ? window.getScheduleById(scheduleId) : null;
    
    if (!schedule) {
      alert('일정 정보를 찾을 수 없습니다.');
      return;
    }
    
    currentSchedule = schedule;
    
    // 일정 정보 표시
    displayScheduleDetails(schedule);
    
    // 모달 표시
    scheduleViewModal.classList.remove('hidden');
    scheduleViewModal.classList.add('flex');
  }
  
  // 일정 수정 모달 열기
  function openEditScheduleModal(schedule) {
    if (!schedule) {
      alert('수정할 일정 정보를 찾을 수 없습니다.');
      return;
    }
    
    // 현재 사용자 정보 가져오기
    currentCommittee = window.getCurrentCommittee ? window.getCurrentCommittee() : null;
    
    if (!currentCommittee) {
      alert('위원 정보를 찾을 수 없습니다. 로그인 후 다시 시도해주세요.');
      return;
    }
    
    // 모달 제목 설정
    document.getElementById('schedule-modal-title').textContent = '일정 수정';
    
    // 폼 초기화
    scheduleForm.reset();
    
    // 일정 정보 설정
    scheduleIdInput.value = schedule.id;
    scheduleDateInput.value = schedule.scheduleDate;
    scheduleTimeInput.value = schedule.time || '09:00';
    scheduleTitleInput.value = schedule.title || '';
    scheduleDescInput.value = schedule.description || '';
    
    // 위원 정보 표시
    displayCommitteeInfo(currentCommittee);
    
    // 기관 목록 로드
    loadOrganizationOptions(currentCommittee, schedule.organizationCode);
    
    // 상태 설정
    scheduleStatusSelect.value = schedule.status || 'pending';
    
    // 삭제 버튼 표시
    deleteScheduleBtn.classList.remove('hidden');
    
    // 모달 표시
    scheduleModal.classList.remove('hidden');
    scheduleModal.classList.add('flex');
  }
  
  // 일정 모달 닫기
  function closeScheduleModal() {
    scheduleModal.classList.add('hidden');
    scheduleModal.classList.remove('flex');
    currentSchedule = null;
  }
  
  // 일정 보기 모달 닫기
  function closeScheduleViewModal() {
    scheduleViewModal.classList.add('hidden');
    scheduleViewModal.classList.remove('flex');
    currentSchedule = null;
  }
  
  // 위원 정보 표시
  function displayCommitteeInfo(committee) {
    if (!committee) return;
    
    committeeInfoDiv.innerHTML = `
      <div class="flex items-center">
        <div class="mr-2 font-medium">${committee.name}</div>
        <div class="text-sm text-gray-500">${committee.role || '위원'}</div>
      </div>
      <div class="text-sm text-gray-500">${committee.department || ''}</div>
    `;
  }
  
  // 기관 옵션 로드
  function loadOrganizationOptions(committee, selectedOrgCode = null) {
    if (!committee) return;
    
    // 위원의 담당 기관 목록 가져오기
    const orgCodes = committee.organizationCodes || [];
    
    // 모든 기관 정보 가져오기
    const allOrganizations = window.getOrganizations ? window.getOrganizations() : [];
    
    // 위원의 담당 기관만 필터링
    committeeOrganizations = allOrganizations.filter(org => 
      orgCodes.includes(org.code || org.id)
    );
    
    // 시군별로 그룹화
    const orgGroups = groupOrganizationsByRegion(committeeOrganizations);
    
    // 기관 옵션 초기화
    scheduleOrgSelect.innerHTML = '<option value="" disabled selected>기관을 선택하세요</option>';
    
    // 시군별로 옵션 그룹 추가
    Object.keys(orgGroups).forEach(region => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = region;
      
      // 주담당 기관
      const mainOrgs = orgGroups[region].filter(org => isMainOrganization(org, committee));
      if (mainOrgs.length > 0) {
        const mainOptgroup = document.createElement('optgroup');
        mainOptgroup.label = '주담당';
        
        mainOrgs.forEach(org => {
          const option = document.createElement('option');
          option.value = org.code || org.id;
          option.textContent = org.name;
          if (selectedOrgCode && (org.code === selectedOrgCode || org.id === selectedOrgCode)) {
            option.selected = true;
          }
          mainOptgroup.appendChild(option);
        });
        
        optgroup.appendChild(mainOptgroup);
      }
      
      // 부담당 기관
      const subOrgs = orgGroups[region].filter(org => !isMainOrganization(org, committee));
      if (subOrgs.length > 0) {
        const subOptgroup = document.createElement('optgroup');
        subOptgroup.label = '부담당';
        
        subOrgs.forEach(org => {
          const option = document.createElement('option');
          option.value = org.code || org.id;
          option.textContent = org.name;
          if (selectedOrgCode && (org.code === selectedOrgCode || org.id === selectedOrgCode)) {
            option.selected = true;
          }
          subOptgroup.appendChild(option);
        });
        
        optgroup.appendChild(subOptgroup);
      }
      
      scheduleOrgSelect.appendChild(optgroup);
    });
  }
  
  // 기관을 시군별로 그룹화
  function groupOrganizationsByRegion(organizations) {
    // 외부에 정의된 그룹화 함수가 있으면 사용
    if (window.groupOrganizationsByRegion) {
      return window.groupOrganizationsByRegion(organizations);
    }
    
    // 내부 구현
    const groups = {};
    
    organizations.forEach(org => {
      // 지역명 처리 - 세부 지역 처리
      let regionName = org.region || '기타 지역';
      
      // 지역명 정규화 (예: '창원시 의창구' -> '창원시')
      if (regionName.includes(' ')) {
        regionName = regionName.split(' ')[0];
      }
      
      if (!groups[regionName]) {
        groups[regionName] = [];
      }
      
      groups[regionName].push(org);
    });
    
    return groups;
  }
  
  // 지역 코드로부터 지역명 가져오기 (후반용)
  function getRegionName(regionCode) {
    // 실제 구현에서는 지역 코드와 지역명 매핑 테이블 사용
    const regionMap = {
      'A4812': '창원시',
      'A4817': '진주시',
      'A4822': '김해시',
      'A4824': '사천시',
      'A4825': '양산시',
      'A4827': '거제시',
      'A4872': '통영시',
      'A4882': '창녕군',
      'A4884': '남해군',
      'A4885': '하동군',
      'A4886': '산청군',
      'A4888': '거창군'
    };
    
    return regionMap[regionCode] || '기타 지역';
  }
  
  // 주담당 기관인지 확인
  function isMainOrganization(organization, committee) {
    // 실제 구현에서는 주담당/부담당 구분 로직 추가
    // 예시: 위원의 첫 번째 담당 기관을 주담당으로 간주
    if (!committee || !committee.organizationCodes || committee.organizationCodes.length === 0) {
      return false;
    }
    
    const orgCode = organization.code || organization.id;
    return committee.organizationCodes[0] === orgCode;
  }
  
  // 일정 상세 정보 표시
  function displayScheduleDetails(schedule) {
    if (!schedule) return;
    
    // 기관명 가져오기
    const organizationName = schedule.organizationName || 
      (window.getOrganizationName ? window.getOrganizationName(schedule.organizationCode) : schedule.organizationCode);
    
    // 상태 텍스트 및 색상 설정
    let statusText = '예정됨';
    let statusColor = 'bg-yellow-100 text-yellow-800';
    
    if (schedule.status === 'completed') {
      statusText = '완료됨';
      statusColor = 'bg-green-100 text-green-800';
    } else if (schedule.status === 'canceled') {
      statusText = '취소됨';
      statusColor = 'bg-red-100 text-red-800';
    }
    
    // 일정 상세 정보 HTML 생성
    scheduleViewContent.innerHTML = `
      <div class="space-y-4">
        <div class="flex justify-between items-start">
          <h3 class="text-lg font-semibold">${schedule.title}</h3>
          <span class="px-2 py-1 rounded-full text-xs font-medium ${statusColor}">
            ${statusText}
          </span>
        </div>
        
        <div class="flex items-center text-gray-600">
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <span>${formatDate(schedule.scheduleDate)} ${schedule.time || ''}</span>
        </div>
        
        <div class="flex items-center text-gray-600">
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
          </svg>
          <span>${organizationName}</span>
        </div>
        
        <div class="flex items-center text-gray-600">
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
          </svg>
          <span>${schedule.committeeName || '담당자 미지정'}</span>
        </div>
        
        ${schedule.description ? `
        <div class="mt-4">
          <h4 class="text-sm font-medium text-gray-700 mb-2">설명</h4>
          <p class="text-gray-600 whitespace-pre-line">${schedule.description}</p>
        </div>
        ` : ''}
      </div>
    `;
  }
  
  // 날짜 포맷팅 함수
  function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    return `${year}년 ${month}월 ${day}일`;
  }
  
  // 일정 수정 버튼 핸들러
  function handleEditSchedule() {
    if (!currentSchedule) return;
    
    // 일정 수정 모달 열기
    openEditScheduleModal(currentSchedule);
    
    // 일정 보기 모달 닫기
    closeScheduleViewModal();
  }
  
  // 일정 삭제 버튼 핸들러
  function handleDeleteSchedule() {
    if (!currentSchedule) return;
    
    if (confirm('정말로 이 일정을 삭제하시겠습니까?')) {
      // 일정 삭제 함수 호출
      if (window.deleteSchedule) {
        window.deleteSchedule(currentSchedule.id)
          .then(() => {
            alert('일정이 삭제되었습니다.');
            closeScheduleModal();
          })
          .catch(error => {
            alert('일정 삭제 중 오류가 발생했습니다: ' + error.message);
          });
      } else {
        alert('일정 삭제 기능을 사용할 수 없습니다.');
      }
    }
  }
  
  // 일정 폼 제출 핸들러
  function handleScheduleSubmit(e) {
    e.preventDefault();
    
    // 폼 데이터 수집
    const formData = {
      scheduleDate: scheduleDateInput.value,
      scheduleTime: scheduleTimeInput.value,
      title: scheduleTitleInput.value,
      organizationCode: scheduleOrgSelect.value,
      description: scheduleDescInput.value,
      status: scheduleStatusSelect.value
    };
    
    // 일정 ID가 있으면 수정, 없으면 추가
    const scheduleId = scheduleIdInput.value;
    
    if (scheduleId) {
      // 일정 수정
      if (window.updateSchedule) {
        window.updateSchedule(scheduleId, formData)
          .then(() => {
            alert('일정이 수정되었습니다.');
            closeScheduleModal();
          })
          .catch(error => {
            alert('일정 수정 중 오류가 발생했습니다: ' + error.message);
          });
      } else {
        alert('일정 수정 기능을 사용할 수 없습니다.');
      }
    } else {
      // 일정 추가
      if (window.addSchedule) {
        window.addSchedule(formData)
          .then(() => {
            alert('일정이 등록되었습니다.');
            closeScheduleModal();
          })
          .catch(error => {
            alert('일정 등록 중 오류가 발생했습니다: ' + error.message);
          });
      } else {
        alert('일정 등록 기능을 사용할 수 없습니다.');
      }
    }
  }
  
  // 전역 함수 노출
  window.ScheduleManager = {
    init,
    openAddScheduleModal,
    openViewScheduleModal,
    openEditScheduleModal
  };
  
  // DOM이 로드되면 초기화
  document.addEventListener('DOMContentLoaded', init);
})();

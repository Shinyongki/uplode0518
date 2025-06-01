// 구글 시트 연동 기능
// 마스터 대시보드에서 일정 데이터를 구글 시트와 동기화하는 기능을 제공합니다.

// 중복 선언 방지를 위해 전역 변수로 선언
(function() {
  // 이미 전역 변수로 존재하는지 확인
  if (typeof window.SHEETS_API_ENDPOINT === 'undefined') {
    window.SHEETS_API_ENDPOINT = '/api/sheets';
  }
})();

// 일정 데이터 가져오기
async function fetchSchedulesFromSheet() {
  try {
    console.log('구글 시트에서 일정 데이터 가져오기 시작');
    
    const response = await fetch(`${SHEETS_API_ENDPOINT}/schedules`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`구글 시트 데이터 가져오기 실패: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.status === 'success') {
      console.log(`구글 시트에서 ${result.schedules.length}개의 일정 데이터를 가져왔습니다.`);
      return result.schedules;
    } else {
      console.error('구글 시트 데이터 가져오기 실패:', result.message);
      return [];
    }
  } catch (error) {
    console.error('구글 시트 데이터 가져오기 오류:', error);
    return [];
  }
}

// 일정 데이터 저장하기
async function saveSchedulesToSheet(schedules, sheetName = '방문일정') {
  try {
    console.log(`구글 시트 '${sheetName}'에 ${schedules.length}개의 일정 데이터 저장 시작`);
    
    const response = await fetch(`${SHEETS_API_ENDPOINT}/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        sheetName: sheetName,
        schedules: schedules
      })
    });
    
    if (!response.ok) {
      throw new Error(`구글 시트 데이터 저장 실패: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.status === 'success') {
      console.log(`구글 시트에 일정 데이터 저장 성공`);
      return true;
    } else {
      console.error('구글 시트 데이터 저장 실패:', result.message);
      return false;
    }
  } catch (error) {
    console.error('구글 시트 데이터 저장 오류:', error);
    return false;
  }
}

// 단일 일정 업데이트
async function updateScheduleInSheet(schedule) {
  try {
    // ID 생성 (위원ID_기관코드_날짜)
    const dateStr = schedule.date.replace(/-/g, '');
    const id = `${schedule.committeeId || schedule.위원ID}_${schedule.orgCode || schedule.기관코드}_${dateStr}`;
    
    console.log(`구글 시트에 일정 업데이트 시작: ${id}`);
    
    const response = await fetch(`${SHEETS_API_ENDPOINT}/schedules/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(schedule)
    });
    
    if (!response.ok) {
      throw new Error(`구글 시트 일정 업데이트 실패: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.status === 'success') {
      console.log('구글 시트 일정 업데이트 성공:', result.message);
      return true;
    } else {
      console.error('구글 시트 일정 업데이트 실패:', result.message);
      return false;
    }
  } catch (error) {
    console.error('구글 시트 일정 업데이트 오류:', error);
    return false;
  }
}

// 단일 일정 삭제 (상태를 'canceled'로 변경)
async function deleteScheduleFromSheet(schedule) {
  try {
    // ID 생성 (위원ID_기관코드_날짜)
    const dateStr = schedule.date.replace(/-/g, '');
    const id = `${schedule.committeeId || schedule.위원ID}_${schedule.orgCode || schedule.기관코드}_${dateStr}`;
    
    console.log(`구글 시트에서 일정 삭제 시작: ${id}`);
    
    const response = await fetch(`${SHEETS_API_ENDPOINT}/schedules/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`구글 시트 일정 삭제 실패: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.status === 'success') {
      console.log('구글 시트 일정 삭제 성공:', result.message);
      return true;
    } else {
      console.error('구글 시트 일정 삭제 실패:', result.message);
      return false;
    }
  } catch (error) {
    console.error('구글 시트 일정 삭제 오류:', error);
    return false;
  }
}

// 로컬 스토리지와 구글 시트 데이터 동기화
async function syncSchedulesWithSheet() {
  try {
    // 1. 구글 시트에서 데이터 가져오기
    const sheetSchedules = await fetchSchedulesFromSheet();
    
    if (!sheetSchedules || sheetSchedules.length === 0) {
      console.log('구글 시트에서 가져온 일정 데이터가 없습니다.');
      return false;
    }
    
    // 2. 로컬 스토리지에서 데이터 가져오기
    let localSchedules = [];
    try {
      const savedSchedules = localStorage.getItem('calendar_schedules');
      if (savedSchedules) {
        localSchedules = JSON.parse(savedSchedules);
        console.log(`로컬 스토리지에서 ${localSchedules.length}개의 일정 가져옴`);
      }
    } catch (e) {
      console.error('로컬 스토리지에서 일정 데이터 가져오기 실패:', e);
    }
    
    // 3. 구글 시트 데이터를 표준 형식으로 변환
    const standardizedSheetSchedules = sheetSchedules.map(schedule => {
      return {
        id: schedule.id || `schedule_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`,
        date: schedule.date || schedule.방문일자,
        visitDate: schedule.date || schedule.방문일자,
        committeeName: schedule.committeeName || schedule.위원명,
        committeeId: schedule.committeeId || schedule.위원ID,
        organizationName: schedule.organizationName || schedule.기관명,
        orgName: schedule.organizationName || schedule.기관명,
        orgCode: schedule.orgCode || schedule.기관코드,
        startTime: schedule.startTime || schedule.방문시간,
        endTime: schedule.endTime || '',
        status: schedule.status || schedule.상태 || 'pending',
        notes: schedule.notes || schedule.메모 || '',
        memo: schedule.notes || schedule.메모 || '',
        purpose: schedule.purpose || schedule.목적 || '',
        createdAt: schedule.createdAt || new Date().toISOString()
      };
    });
    
    // 4. 로컬 스토리지 데이터 업데이트
    localStorage.setItem('calendar_schedules', JSON.stringify(standardizedSheetSchedules));
    console.log(`로컬 스토리지에 ${standardizedSheetSchedules.length}개의 일정 데이터 업데이트`);
    
    // 5. 일정 데이터가 업데이트되었음을 알림
    const updateEvent = new CustomEvent('masterDashboardDataUpdated', {
      detail: {
        type: 'update',
        data: {
          schedules: standardizedSheetSchedules
        }
      }
    });
    document.dispatchEvent(updateEvent);
    
    // 전역 변수 업데이트
    window.allCommitteeSchedules = standardizedSheetSchedules;
    window.schedulesLoaded = true;
    
    return true;
  } catch (error) {
    console.error('일정 데이터 동기화 오류:', error);
    return false;
  }
}

// 구글 시트에 일정 데이터 저장하기
async function saveSchedulesToSheet(schedules) {
  try {
    console.log('구글 시트에 일정 데이터 저장 시작');
    
    const response = await fetch(`${SHEETS_API_ENDPOINT}/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sheetName: '방문일정',  // 이미지에 표시된 시트명
        schedules: schedules
      }),
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`구글 시트 데이터 저장 실패: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.status === 'success') {
      console.log('구글 시트에 일정 데이터 저장 성공');
      return true;
    } else {
      console.error('구글 시트 데이터 저장 실패:', result.message);
      return false;
    }
  } catch (error) {
    console.error('구글 시트 데이터 저장 오류:', error);
    return false;
  }
}

// 로컬 스토리지 데이터를 구글 시트로 내보내기
async function exportLocalSchedulesToSheet() {
  try {
    // 1. 로컬 스토리지에서 데이터 가져오기
    let localSchedules = [];
    try {
      const savedSchedules = localStorage.getItem('calendar_schedules');
      if (savedSchedules) {
        localSchedules = JSON.parse(savedSchedules);
        console.log(`로컬 스토리지에서 ${localSchedules.length}개의 일정 가져옴`);
      } else {
        console.log('로컬 스토리지에 일정 데이터가 없습니다.');
        return false;
      }
    } catch (e) {
      console.error('로컬 스토리지에서 일정 데이터 가져오기 실패:', e);
      return false;
    }
    
    // 2. 구글 시트 형식으로 변환
    const sheetSchedules = localSchedules.map(schedule => {
      return {
        위원ID: schedule.committeeId || '',
        위원명: schedule.committeeName || '',
        기관코드: schedule.orgCode || '',
        기관명: schedule.organizationName || schedule.orgName || '',
        방문일자: schedule.date || schedule.visitDate || '',
        방문시간: schedule.startTime || '',
        목적: schedule.purpose || '',
        메모: schedule.notes || schedule.memo || '',
        상태: schedule.status || 'pending'
      };
    });
    
    // 3. 구글 시트에 저장
    const result = await saveSchedulesToSheet(sheetSchedules, '방문일정');
    
    return result;
  } catch (error) {
    console.error('로컬 일정 데이터 내보내기 오류:', error);
    return false;
  }
}

// 전역 함수 노출
window.fetchSchedulesFromSheet = fetchSchedulesFromSheet;
window.saveSchedulesToSheet = saveSchedulesToSheet;
window.updateScheduleInSheet = updateScheduleInSheet;
window.deleteScheduleFromSheet = deleteScheduleFromSheet;
window.syncSchedulesWithSheet = syncSchedulesWithSheet;
window.exportLocalSchedulesToSheet = exportLocalSchedulesToSheet;

// 구글 시트 동기화 기능이 로드되었음을 확인하는 코드
console.log('구글 시트 동기화 기능 로드 완료');

// 이벤트 발생
document.dispatchEvent(new CustomEvent('googleSheetSyncLoaded', { detail: { loaded: true } }));

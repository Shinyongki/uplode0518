/**
 * Google Sheets 데이터 주기적 동기화 모듈
 * 백그라운드에서 실행되어 최신 데이터를 캐시에 유지
 */

const sheetsHelper = require('./sheets-helper');
const cacheManager = require('./cache-manager');

// 동기화 상태 및 설정
const syncState = {
  lastSync: {
    committees: null,
    organizations: null,
    schedules: null
  },
  isRunning: false,
  interval: 15 * 60 * 1000, // 15분 (밀리초)
  errors: {},
  timer: null
};

// 오류 메시지 저장 헬퍼 함수
function recordError(dataType, error) {
  syncState.errors[dataType] = {
    message: error.message,
    timestamp: Date.now(),
    stack: error.stack
  };
}

/**
 * 위원회 데이터 동기화
 * @returns {Promise<boolean>} 성공 여부
 */
async function syncCommittees() {
  try {
    console.log('[data-sync] Syncing committees data...');
    const committeeData = await sheetsHelper.readSheetData('committees!A:C');
    
    // 데이터 가공
    const headers = committeeData[0] || ['name', 'id', 'role'];
    const committees = committeeData.slice(1).map(row => {
      const committee = {};
      headers.forEach((header, index) => {
        committee[header.toLowerCase()] = row[index] || '';
      });
      return committee;
    });
    
    // 캐시에 저장 (24시간 유효)
    cacheManager.set('committees', committees, 24 * 60 * 60 * 1000);
    
    // 동기화 상태 업데이트
    syncState.lastSync.committees = Date.now();
    console.log('[data-sync] Committees sync completed');
    return true;
  } catch (error) {
    console.error('[data-sync] Committees sync failed:', error.message);
    recordError('committees', error);
    return false;
  }
}

/**
 * 기관 데이터 동기화
 * @returns {Promise<boolean>} 성공 여부
 */
async function syncOrganizations() {
  try {
    console.log('[data-sync] Syncing organizations data...');
    const orgsData = await sheetsHelper.readSheetData('committee_orgs!A:D');
    
    // 데이터 가공
    const headers = orgsData[0] || ['orgCode', 'orgName', 'mainCommittee', 'subCommittees'];
    const organizations = orgsData.slice(1).map(row => {
      return {
        orgCode: row[0] || '',
        orgName: row[1] || '',
        mainCommittee: row[2] || '',
        subCommittees: row[3] || ''
      };
    });
    
    // 캐시에 저장 (24시간 유효)
    cacheManager.set('organizations', organizations, 24 * 60 * 60 * 1000);
    
    // 동기화 상태 업데이트
    syncState.lastSync.organizations = Date.now();
    console.log('[data-sync] Organizations sync completed');
    return true;
  } catch (error) {
    console.error('[data-sync] Organizations sync failed:', error.message);
    recordError('organizations', error);
    return false;
  }
}

/**
 * 일정 데이터 동기화
 * @returns {Promise<boolean>} 성공 여부
 */
async function syncSchedules() {
  try {
    console.log('[data-sync] Syncing schedules data...');
    const schedulesData = await sheetsHelper.readSheetData('schedules!A:F');
    
    // 데이터 가공
    const headers = schedulesData[0] || ['id', 'date', 'committeeName', 'organizationName', 'title', 'status'];
    const schedules = schedulesData.slice(1).map(row => {
      return {
        id: row[0] || `sched-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        date: row[1] || formatDate(new Date()),
        committeeName: row[2] || '',
        organizationName: row[3] || '',
        title: row[4] || '정기 모니터링',
        status: row[5] || '예정'
      };
    });
    
    // 캐시에 저장 (12시간 유효 - 일정은 더 자주 변경될 수 있음)
    cacheManager.set('schedules', schedules, 12 * 60 * 60 * 1000);
    
    // 동기화 상태 업데이트
    syncState.lastSync.schedules = Date.now();
    console.log('[data-sync] Schedules sync completed');
    return true;
  } catch (error) {
    console.error('[data-sync] Schedules sync failed:', error.message);
    recordError('schedules', error);
    return false;
  }
}

/**
 * 날짜 포맷팅 헬퍼 함수
 */
function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * 모든 데이터 동기화 실행
 * @returns {Promise<object>} 동기화 결과
 */
async function syncAll() {
  if (syncState.isRunning) {
    console.log('[data-sync] Sync already in progress, skipping');
    return { status: 'skipped', message: 'Sync already in progress' };
  }
  
  syncState.isRunning = true;
  console.log('[data-sync] Starting full data sync');
  
  try {
    const results = {
      committees: await syncCommittees(),
      organizations: await syncOrganizations(),
      schedules: await syncSchedules(),
      timestamp: Date.now()
    };
    
    // 만료된 캐시 정리
    cacheManager.clearExpired();
    
    syncState.isRunning = false;
    console.log('[data-sync] Full data sync completed');
    return {
      status: 'success',
      results,
      errors: syncState.errors
    };
  } catch (error) {
    syncState.isRunning = false;
    console.error('[data-sync] Full sync failed with error:', error.message);
    return {
      status: 'error',
      message: error.message,
      timestamp: Date.now()
    };
  }
}

/**
 * 주기적 동기화 시작
 * @param {number} intervalMs - 동기화 간격 (밀리초), 기본값 15분
 */
function startPeriodicSync(intervalMs = 15 * 60 * 1000) {
  if (syncState.timer) {
    clearInterval(syncState.timer);
  }
  
  // 초기 동기화 실행
  syncAll();
  
  // 주기적 동기화 설정
  syncState.interval = intervalMs;
  syncState.timer = setInterval(syncAll, intervalMs);
  
  console.log(`[data-sync] Periodic sync started, interval: ${intervalMs / 1000} seconds`);
  return true;
}

/**
 * 주기적 동기화 중지
 */
function stopPeriodicSync() {
  if (syncState.timer) {
    clearInterval(syncState.timer);
    syncState.timer = null;
    console.log('[data-sync] Periodic sync stopped');
    return true;
  }
  return false;
}

/**
 * 현재 동기화 상태 조회
 */
function getSyncStatus() {
  return {
    ...syncState,
    isTimerActive: !!syncState.timer,
    cacheKeys: cacheManager.getKeys()
  };
}

// 서버 시작 시 자동으로 주기적 동기화 시작 (서버리스 환경에서는 이 부분이 매 호출마다 실행될 수 있음)
if (process.env.NODE_ENV === 'production' && process.env.AUTO_SYNC !== 'false') {
  // 서버리스 환경에서는 웜업 요청을 통해 명시적으로 시작하는 것이 좋음
  console.log('[data-sync] Auto-start disabled in serverless environment');
}

module.exports = {
  syncAll,
  syncCommittees,
  syncOrganizations,
  syncSchedules,
  startPeriodicSync,
  stopPeriodicSync,
  getSyncStatus
}; 
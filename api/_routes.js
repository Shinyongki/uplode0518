// API 라우팅 매핑
const express = require('express');
const router = express.Router();

// API 엔드포인트들 가져오기
const committeesHandler = require('./committees');
const committeesAllHandler = require('./committees-all');
const committeesMatchingHandler = require('./committees-matching');
const organizationsHandler = require('./organizations');
const schedulesHandler = require('./schedules');
const schedulesDeleteHandler = require('./schedules-delete');
const debugEnvHandler = require('./debug-env');
const resultsMeHandler = require('./results-me');
const indicatorsHandler = require('./indicators');
const sheetsSchedulesHandler = require('./sheets-schedules'); // 구글 시트 일정 API 추가

// 캐싱 및 동기화 모듈
const cacheManager = require('./cache-manager');
const dataSync = require('./data-sync');

// 각 라우트 등록
router.get('/committees', committeesHandler);
router.get('/committees/all', committeesAllHandler);
router.get('/committees-matching', committeesMatchingHandler);
router.get('/committees/matching', committeesMatchingHandler);
router.get('/results-me', resultsMeHandler);
router.get('/results/me', resultsMeHandler);
router.get('/organizations', organizationsHandler);
router.get('/schedules', schedulesHandler);
router.delete('/schedules/:id', schedulesDeleteHandler); // 일정 삭제 요청 처리
router.get('/debug-env', debugEnvHandler);
router.get('/indicators', indicatorsHandler); // 지표 API 추가

// 구글 시트 API 라우트
router.use('/sheets/schedules', sheetsSchedulesHandler); // 구글 시트 일정 API

// 구글 시트 테스트 API 추가
const sheetTestRouter = require('./sheet-test');
router.use('/sheets', sheetTestRouter);

// 기본 API 상태 체크 라우트
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API 서버가 정상적으로 동작 중입니다.',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    serverTime: new Date().toISOString()
  });
});

// 서비스 계정 상태 확인용 엔드포인트
router.get('/service-account-status', async (req, res) => {
  try {
    const sheetsHelper = require('./sheets-helper');
    let status = 'error';
    let message = '서비스 계정 미설정';
    
    try {
      const client = await sheetsHelper.getAuthClient();
      if (client) {
        status = 'success';
        message = '서비스 계정 인증 성공';
      }
    } catch (error) {
      message = `서비스 계정 인증 실패: ${error.message}`;
    }
    
    res.status(200).json({
      status,
      message,
      useServiceAccount: process.env.USE_SERVICE_ACCOUNT === 'true',
      serviceAccountKeyPath: process.env.SERVICE_ACCOUNT_KEY_PATH,
      spreadsheetIdExists: !!process.env.SPREADSHEET_ID,
      serviceAccountClientEmailExists: !!process.env.SERVICE_ACCOUNT_CLIENT_EMAIL,
      serviceAccountPrivateKeyExists: !!process.env.SERVICE_ACCOUNT_PRIVATE_KEY,
      nodeVersion: process.version
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '서비스 계정 상태 확인 중 오류 발생',
      error: error.message
    });
  }
});

// 데이터 동기화 상태 및 관리 엔드포인트
router.get('/sync/status', (req, res) => {
  try {
    const status = dataSync.getSyncStatus();
    
    res.status(200).json({
      status: 'success',
      data: status,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '동기화 상태 확인 중 오류 발생',
      error: error.message
    });
  }
});

// 수동 데이터 동기화 트리거 엔드포인트
router.post('/sync/run', async (req, res) => {
  try {
    console.log('[api/sync/run] Manual sync triggered');
    const result = await dataSync.syncAll();
    
    res.status(200).json({
      status: 'success',
      message: '데이터 동기화가 시작되었습니다.',
      result
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '데이터 동기화 중 오류 발생',
      error: error.message
    });
  }
});

// 주기적 동기화 시작 엔드포인트
router.post('/sync/start', (req, res) => {
  try {
    const interval = req.body.interval ? parseInt(req.body.interval) * 1000 : undefined;
    const result = dataSync.startPeriodicSync(interval);
    
    res.status(200).json({
      status: 'success',
      message: '주기적 데이터 동기화가 시작되었습니다.',
      interval: interval ? `${interval / 1000}초` : '기본값 (15분)',
      result
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '주기적 동기화 시작 중 오류 발생',
      error: error.message
    });
  }
});

// 주기적 동기화 중지 엔드포인트
router.post('/sync/stop', (req, res) => {
  try {
    const result = dataSync.stopPeriodicSync();
    
    res.status(200).json({
      status: 'success',
      message: result ? '주기적 데이터 동기화가 중지되었습니다.' : '실행 중인 동기화가 없습니다.',
      result
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '주기적 동기화 중지 중 오류 발생',
      error: error.message
    });
  }
});

// 캐시 상태 확인 엔드포인트
router.get('/cache/status', (req, res) => {
  try {
    const keys = cacheManager.getKeys();
    const cacheInfo = {};
    
    keys.forEach(key => {
      cacheInfo[key] = cacheManager.getInfo(key);
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        keys,
        info: cacheInfo,
        count: keys.length
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '캐시 상태 확인 중 오류 발생',
      error: error.message
    });
  }
});

// 캐시 초기화 엔드포인트
router.post('/cache/clear', (req, res) => {
  try {
    const key = req.body.key;
    
    if (key) {
      cacheManager.remove(key);
      res.status(200).json({
        status: 'success',
        message: `'${key}' 캐시가 삭제되었습니다.`
      });
    } else {
      // 전체 캐시 정리
      const keys = cacheManager.getKeys();
      keys.forEach(k => cacheManager.remove(k));
      
      res.status(200).json({
        status: 'success',
        message: `${keys.length}개 캐시가 모두 삭제되었습니다.`,
        clearedKeys: keys
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '캐시 초기화 중 오류 발생',
      error: error.message
    });
  }
});

// 존재하지 않는 API 경로 처리
router.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: '요청한 API 경로를 찾을 수 없습니다.'
  });
});

// 서버 시작 시 데이터 동기화 초기화 (서버리스 환경에서는 적절히 조정 필요)
if (process.env.NODE_ENV === 'production' && process.env.AUTO_SYNC === 'true') {
  console.log('[api/routes] Starting periodic data sync...');
  dataSync.startPeriodicSync();
}

module.exports = router; 
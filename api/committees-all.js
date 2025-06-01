// 위원회 전체 데이터 API 엔드포인트
const sheetsHelper = require('./sheets-helper');
const cacheManager = require('./cache-manager');
const dataSync = require('./data-sync');

// 정적 fallback 데이터
const STATIC_FALLBACK_COMMITTEES = [
  { name: '신용기', id: 'C001', role: 'committee' },
  { name: '문일지', id: 'C002', role: 'committee' },
  { name: '김수연', id: 'C003', role: 'committee' },
  { name: '이연숙', id: 'C004', role: 'committee' },
  { name: '이정혜', id: 'C005', role: 'committee' }
];

module.exports = async (req, res) => {
  try {
    console.log('[api/committees-all] Request received');
    
    // 1. 데이터 가져오기 시도: 계층적 fallback 적용
    let committeeData = null;
    let dataSource = 'unknown';
    let lastSyncTime = null;
    
    // 1.1 Google Sheets에서 직접 가져오기 시도
    try {
      console.log('[api/committees-all] Attempting to fetch data from Google Sheets');
      const rawData = await sheetsHelper.readSheetData('committees!A:C');
      
      // 데이터 가공
      const headers = rawData[0] || ['name', 'id', 'role'];
      committeeData = rawData.slice(1).map(row => {
        const committee = {};
        headers.forEach((header, index) => {
          committee[header.toLowerCase()] = row[index] || '';
        });
        return committee;
      });
      
      dataSource = 'sheets';
      
      // 성공적으로 가져온 데이터를 캐시에 저장 (24시간 유효)
      cacheManager.set('committees', committeeData, 24 * 60 * 60 * 1000);
      
      console.log(`[api/committees-all] Successfully fetched ${committeeData.length} committee records from sheets`);
    } 
    catch (sheetError) {
      console.error('[api/committees-all] Error fetching from Google Sheets:', sheetError.message);
      
      // 1.2 캐시에서 가져오기 시도
      console.log('[api/committees-all] Attempting to use cached data');
      const cachedData = cacheManager.get('committees');
      
      if (cachedData) {
        committeeData = cachedData.data;
        lastSyncTime = cachedData.timestamp.created;
        dataSource = 'cache';
        console.log(`[api/committees-all] Using cached data from ${new Date(lastSyncTime).toISOString()}`);
      } 
      else {
        // 1.3 정적 fallback 데이터 사용
        console.log('[api/committees-all] No cached data available, using static fallback data');
        committeeData = STATIC_FALLBACK_COMMITTEES;
        dataSource = 'static-fallback';
      }
      
      // 백그라운드에서 데이터 동기화 시도
      if (process.env.NODE_ENV === 'production') {
        console.log('[api/committees-all] Triggering background data sync');
        dataSync.syncCommittees().catch(e => 
          console.error('[api/committees-all] Background sync failed:', e.message)
        );
      }
    }
    
    // 데이터가 없는 경우 최종 fallback으로 정적 데이터 사용
    if (!committeeData || committeeData.length === 0) {
      console.log('[api/committees-all] No data available, using static fallback as last resort');
      committeeData = STATIC_FALLBACK_COMMITTEES;
      dataSource = 'static-fallback';
    }
    
    // 2. 응답 반환
    return res.status(200).json({
      status: 'success',
      data: committeeData,
      meta: {
        source: dataSource,
        count: committeeData.length,
        lastSync: lastSyncTime ? new Date(lastSyncTime).toISOString() : null,
        usingFallback: dataSource !== 'sheets'
      }
    });
  } catch (error) {
    console.error('[api/committees-all] Unhandled error:', error.message);
    console.error(error.stack);
    
    // 오류가 발생해도 클라이언트에 기본 데이터는 제공
    return res.status(200).json({
      status: 'success',
      data: STATIC_FALLBACK_COMMITTEES,
      meta: {
        source: 'error-fallback',
        error: error.message,
        usingFallback: true
      }
    });
  }
}; 
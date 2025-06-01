// 기관 목록 API 엔드포인트
const sheetsHelper = require('./sheets-helper');
const cacheManager = require('./cache-manager');
const dataSync = require('./data-sync');

// 정적 fallback 데이터
const STATIC_FALLBACK_ORGANIZATIONS = [
  { 
    orgCode: 'A48120001', 
    orgName: '동진노인종합복지센터', 
    mainCommittee: '신용기', 
    subCommittees: '김수연,이연숙' 
  },
  { 
    orgCode: 'A48120002', 
    orgName: '창원도우누리노인복지센터', 
    mainCommittee: '신용기', 
    subCommittees: '김수연' 
  },
  { 
    orgCode: 'A48120003', 
    orgName: '마산시니어클럽', 
    mainCommittee: '문일지', 
    subCommittees: '신용기' 
  },
  { 
    orgCode: 'A48120004', 
    orgName: '김해시니어클럽', 
    mainCommittee: '김수연', 
    subCommittees: '이정혜' 
  },
  { 
    orgCode: 'A48120005', 
    orgName: '생명의전화노인복지센터', 
    mainCommittee: '이정혜', 
    subCommittees: '문일지' 
  },
  { 
    orgCode: 'A48120006', 
    orgName: '보현행정노인복지센터', 
    mainCommittee: '이연숙', 
    subCommittees: '이정혜' 
  }
];

module.exports = async (req, res) => {
  try {
    console.log('[api/organizations] Request received');
    
    // 1. 데이터 가져오기 시도: 계층적 fallback 적용
    let organizationsData = null;
    let dataSource = 'unknown';
    let lastSyncTime = null;
    
    // 1.1 Google Sheets에서 직접 가져오기 시도
    try {
      // 요청에서 시트명 가져오기
      const sheetName = req.query.sheet || 'committee_orgs';
      console.log(`[api/organizations] Attempting to fetch data from Google Sheets, sheet: ${sheetName}`);
      
      // 시트명에 특수문자가 있을 수 있으므로 따옴표로 감싸서 사용
      const formattedSheetName = sheetName.includes(' ') ? `'${sheetName}'` : sheetName;
      const rawData = await sheetsHelper.readSheetData(`${formattedSheetName}!A:H`);
      
      // 데이터 가공
      const headers = rawData[0] || ['orgCode', 'orgName', 'mainCommittee', 'subCommittees'];
      organizationsData = rawData.slice(1).map(row => {
        return {
          orgCode: row[0] || '',
          orgName: row[1] || '',
          mainCommittee: row[2] || '',
          subCommittees: row[3] || ''
        };
      });
      
      dataSource = 'sheets';
      
      // 성공적으로 가져온 데이터를 캐시에 저장 (24시간 유효)
      cacheManager.set('organizations', organizationsData, 24 * 60 * 60 * 1000);
      
      console.log(`[api/organizations] Successfully fetched ${organizationsData.length} organization records from sheets`);
    } 
    catch (sheetError) {
      console.error('[api/organizations] Error fetching from Google Sheets:', sheetError.message);
      
      // 1.2 캐시에서 가져오기 시도
      console.log('[api/organizations] Attempting to use cached data');
      const cachedData = cacheManager.get('organizations');
      
      if (cachedData) {
        organizationsData = cachedData.data;
        lastSyncTime = cachedData.timestamp.created;
        dataSource = 'cache';
        console.log(`[api/organizations] Using cached data from ${new Date(lastSyncTime).toISOString()}`);
      } 
      else {
        // 1.3 정적 fallback 데이터 사용
        console.log('[api/organizations] No cached data available, using static fallback data');
        organizationsData = STATIC_FALLBACK_ORGANIZATIONS;
        dataSource = 'static-fallback';
      }
      
      // 백그라운드에서 데이터 동기화 시도
      if (process.env.NODE_ENV === 'production') {
        console.log('[api/organizations] Triggering background data sync');
        dataSync.syncOrganizations().catch(e => 
          console.error('[api/organizations] Background sync failed:', e.message)
        );
      }
    }
    
    // 데이터가 없는 경우 최종 fallback으로 정적 데이터 사용
    if (!organizationsData || organizationsData.length === 0) {
      console.log('[api/organizations] No data available, using static fallback as last resort');
      organizationsData = STATIC_FALLBACK_ORGANIZATIONS;
      dataSource = 'static-fallback';
    }
    
    // 2. 응답 반환
    return res.status(200).json({
      status: 'success',
      data: organizationsData,
      meta: {
        source: dataSource,
        count: organizationsData.length,
        lastSync: lastSyncTime ? new Date(lastSyncTime).toISOString() : null,
        usingFallback: dataSource !== 'sheets'
      }
    });
  } catch (error) {
    console.error('[api/organizations] Unhandled error:', error.message);
    console.error(error.stack);
    
    // 오류가 발생해도 클라이언트에 기본 데이터는 제공
    return res.status(200).json({
      status: 'success',
      data: STATIC_FALLBACK_ORGANIZATIONS,
      meta: {
        source: 'error-fallback',
        error: error.message,
        usingFallback: true
      }
    });
  }
}; 
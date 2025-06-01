// 모니터링 결과 데이터 API 엔드포인트
const sheetsHelper = require('./sheets-helper');
const cacheManager = require('./cache-manager');
const dataSync = require('./data-sync');

// 정적 fallback 데이터: 기관별 모니터링 결과
const STATIC_FALLBACK_RESULTS = [
  {
    id: 'result-001',
    orgCode: 'A48120001',
    orgName: '동진노인종합복지센터',
    committeeId: 'C001',
    committeeName: '신용기', 
    monitoringDate: '2023-05-10',
    indicators: [
      { id: 'ind-001', period: '매월', completed: true, score: 90, comments: '적절하게 관리되고 있음' },
      { id: 'ind-002', period: '매월', completed: true, score: 85, comments: '일부 문서 보완 필요' },
      { id: 'ind-003', period: '반기', completed: true, score: 95, comments: '우수한 관리 상태' },
      { id: 'ind-004', period: '반기', completed: false },
      { id: 'ind-005', period: '1~3월', completed: true, score: 80, comments: '시설 개선 필요' }
    ]
  },
  {
    id: 'result-002',
    orgCode: 'A48120002',
    orgName: '창원도우누리노인복지센터',
    committeeId: 'C001',
    committeeName: '신용기',
    monitoringDate: '2023-05-15',
    indicators: [
      { id: 'ind-001', period: '매월', completed: true, score: 88, comments: '전반적으로 양호함' },
      { id: 'ind-002', period: '매월', completed: true, score: 92, comments: '문서 관리 우수' },
      { id: 'ind-003', period: '반기', completed: false },
      { id: 'ind-004', period: '반기', completed: false },
      { id: 'ind-005', period: '1~3월', completed: true, score: 85, comments: '프로그램 다양성 우수' }
    ]
  },
  {
    id: 'result-003',
    orgCode: 'A48120003',
    orgName: '마산시니어클럽',
    committeeId: 'C002',
    committeeName: '문일지',
    monitoringDate: '2023-05-20',
    indicators: [
      { id: 'ind-001', period: '매월', completed: true, score: 75, comments: '직원 교육 필요' },
      { id: 'ind-002', period: '매월', completed: false },
      { id: 'ind-003', period: '반기', completed: true, score: 82, comments: '안전관리 개선 필요' },
      { id: 'ind-004', period: '반기', completed: true, score: 88, comments: '이용자 만족도 높음' },
      { id: 'ind-005', period: '1~3월', completed: false }
    ]
  },
  {
    id: 'result-004',
    orgCode: 'A48120004',
    orgName: '김해시니어클럽',
    committeeId: 'C003',
    committeeName: '김수연',
    monitoringDate: '2023-05-22',
    indicators: [
      { id: 'ind-001', period: '매월', completed: true, score: 95, comments: '매우 우수한 관리' },
      { id: 'ind-002', period: '매월', completed: true, score: 90, comments: '기록 관리 철저' },
      { id: 'ind-003', period: '반기', completed: true, score: 92, comments: '직원 교육 우수' },
      { id: 'ind-004', period: '반기', completed: true, score: 85, comments: '시설 관리 양호' },
      { id: 'ind-005', period: '1~3월', completed: true, score: 88, comments: '프로그램 다양성 좋음' }
    ]
  },
  {
    id: 'result-005',
    orgCode: 'A48120005',
    orgName: '생명의전화노인복지센터',
    committeeId: 'C005',
    committeeName: '이정혜',
    monitoringDate: '2023-05-25',
    indicators: [
      { id: 'ind-001', period: '매월', completed: false },
      { id: 'ind-002', period: '매월', completed: false },
      { id: 'ind-003', period: '반기', completed: false },
      { id: 'ind-004', period: '반기', completed: false },
      { id: 'ind-005', period: '1~3월', completed: false }
    ]
  }
];

module.exports = async (req, res) => {
  try {
    console.log('[api/results-me] Request received');
    
    // 1. 데이터 가져오기 시도: 계층적 fallback 적용
    let resultsData = null;
    let dataSource = 'unknown';
    let lastSyncTime = null;
    
    // 1.1 캐시에서 가져오기 시도
    console.log('[api/results-me] Attempting to use cached data');
    const cachedData = cacheManager.get('monitoring_results');
    
    if (cachedData) {
      resultsData = cachedData.data;
      lastSyncTime = cachedData.timestamp.created;
      dataSource = 'cache';
      console.log(`[api/results-me] Using cached data from ${new Date(lastSyncTime).toISOString()}`);
    } else {
      // 1.2 Google Sheets에서 연동이 있을 경우 구현할 위치
      // 현재는 fallback 데이터를 바로 사용
      console.log('[api/results-me] No cached data available, using static fallback data');
      resultsData = STATIC_FALLBACK_RESULTS;
      dataSource = 'static-fallback';
      
      // 캐시에 저장 (12시간 유효)
      cacheManager.set('monitoring_results', resultsData, 12 * 60 * 60 * 1000);
    }
    
    // 데이터가 없는 경우 최종 fallback으로 정적 데이터 사용
    if (!resultsData || resultsData.length === 0) {
      console.log('[api/results-me] No data available, using static fallback as last resort');
      resultsData = STATIC_FALLBACK_RESULTS;
      dataSource = 'static-fallback';
    }
    
    // 사용자 필터링(인증된 사용자의 committeeId가 있는 경우)
    const committeeId = req.query.committeeId || null;
    if (committeeId) {
      resultsData = resultsData.filter(result => result.committeeId === committeeId);
      console.log(`[api/results-me] Filtered results for committeeId: ${committeeId}, found ${resultsData.length} results`);
    }
    
    // 2. 응답 반환
    return res.status(200).json({
      status: 'success',
      data: resultsData,
      meta: {
        source: dataSource,
        count: resultsData.length,
        lastSync: lastSyncTime ? new Date(lastSyncTime).toISOString() : null,
        usingFallback: dataSource !== 'sheets',
        filteredByCommittee: !!committeeId
      }
    });
  } catch (error) {
    console.error('[api/results-me] Unhandled error:', error.message);
    console.error(error.stack);
    
    // 오류가 발생해도 클라이언트에 기본 데이터는 제공
    return res.status(200).json({
      status: 'success',
      data: STATIC_FALLBACK_RESULTS,
      meta: {
        source: 'error-fallback',
        error: error.message,
        usingFallback: true
      }
    });
  }
}; 
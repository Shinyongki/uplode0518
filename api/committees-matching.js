// 위원회-기관 매칭 정보 API 엔드포인트
const sheetsHelper = require('./sheets-helper');
const cacheManager = require('./cache-manager');
const dataSync = require('./data-sync');

// 정적 fallback 데이터 - 가장 마지막 수단으로만 사용
const STATIC_FALLBACK_MATCHINGS = [
  // 신용기 위원 담당 기관
  { 
    committeeId: 'C001', 
    committeeName: '신용기',
    orgCode: 'A48170002',
    orgName: '산청한일노인통합복지센터',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C001', 
    committeeName: '신용기',
    orgCode: 'A48820003',
    orgName: '함안노인복지센터',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C001', 
    committeeName: '신용기',
    orgCode: 'A48820004',
    orgName: '합천노인복지센터',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C001', 
    committeeName: '신용기',
    orgCode: 'A48170003',
    orgName: '진주노인통합지원센터',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C001', 
    committeeName: '신용기',
    orgCode: 'A48240001',
    orgName: '김해시니어클럽',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C001', 
    committeeName: '신용기',
    orgCode: 'A48240002',
    orgName: '창원도우누리노인종합재가센터',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C001', 
    committeeName: '신용기',
    orgCode: 'A48840001',
    orgName: '마산시니어클럽',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C001', 
    committeeName: '신용기',
    orgCode: 'A48840002',
    orgName: '거제노인통합지원센터',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C001', 
    committeeName: '신용기',
    orgCode: 'A48850001',
    orgName: '동진노인종합복지센터',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C001', 
    committeeName: '신용기',
    orgCode: 'A48850002',
    orgName: '생명의전화노인복지센터',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C001', 
    committeeName: '신용기',
    orgCode: 'A48170001',
    orgName: '보현행정노인복지센터',
    role: 'main',
    region: '경상남도'
  },
  
  // 문일지 위원 담당 기관
  { 
    committeeId: 'C002', 
    committeeName: '문일지',
    orgCode: 'A48880003',
    orgName: '창녕노인종합복지센터',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C002', 
    committeeName: '문일지',
    orgCode: 'A48880001',
    orgName: '창녕군노인복지센터',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C002', 
    committeeName: '문일지',
    orgCode: 'A48880002',
    orgName: '창녕군노인지원센터',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C002', 
    committeeName: '문일지',
    orgCode: 'A48880004',
    orgName: '창녕군시니어클럽',
    role: 'main',
    region: '경상남도'
  },
  
  // 김수연 위원 담당 기관
  { 
    committeeId: 'C003', 
    committeeName: '김수연',
    orgCode: 'A48860003',
    orgName: '양산노인종합복지센터',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C003', 
    committeeName: '김수연',
    orgCode: 'A48860001',
    orgName: '양산시노인복지관',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C003', 
    committeeName: '김수연',
    orgCode: 'A48860002',
    orgName: '양산시니어클럽',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C003', 
    committeeName: '김수연',
    orgCode: 'A48860004',
    orgName: '양산노인재가복지센터',
    role: 'main',
    region: '경상남도'
  },
  
  // 이영희 위원 담당 기관
  { 
    committeeId: 'C004', 
    committeeName: '이영희',
    orgCode: 'A48720001',
    orgName: '통영시노인복지관',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C004', 
    committeeName: '이영희',
    orgCode: 'A48720002',
    orgName: '통영시니어클럽',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C004', 
    committeeName: '이영희',
    orgCode: 'A48720003',
    orgName: '통영노인종합복지센터',
    role: 'main',
    region: '경상남도'
  },
  
  // 박정수 위원 담당 기관
  { 
    committeeId: 'C005', 
    committeeName: '박정수',
    orgCode: 'A48310001',
    orgName: '거제시노인복지관',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C005', 
    committeeName: '박정수',
    orgCode: 'A48310002',
    orgName: '거제시니어클럽',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C005', 
    committeeName: '박정수',
    orgCode: 'A48310003',
    orgName: '거제노인종합복지센터',
    role: 'main',
    region: '경상남도'
  },
  
  // 김민지 위원 담당 기관
  { 
    committeeId: 'C006', 
    committeeName: '김민지',
    orgCode: 'A48120001',
    orgName: '진해노인복지관',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C006', 
    committeeName: '김민지',
    orgCode: 'A48120002',
    orgName: '진해시니어클럽',
    role: 'main',
    region: '경상남도'
  },
  { 
    committeeId: 'C006', 
    committeeName: '김민지',
    orgCode: 'A48120003',
    orgName: '진해노인종합복지센터',
    role: 'main',
    region: '경상남도'
  }
];

// 구글 시트에서 위원-기관 매칭 정보를 가져오는 함수
async function fetchMatchingsFromGoogleSheets() {
  try {
    console.log('[committees-matching] 구글 시트에서 매칭 데이터 가져오기 시도');
    
    // 사용자가 제공한 정확한 시트명 사용
    let values = null;
    
    try {
      console.log('[committees-matching] "위원별_담당기관" 시트에서 데이터 가져오기 시도');
      values = await sheetsHelper.readSheetData('위원별_담당기관!A:Z');
      console.log('[committees-matching] 위원별_담당기관 시트 데이터 로드 성공:', values ? `${values.length}개 행` : '데이터 없음');
    } catch (error1) {
      console.error('[committees-matching] 위원별_담당기관 시트 접근 실패:', error1.message);
      
      try {
        console.log('[committees-matching] 큰따옴표를 추가하여 시도');
        values = await sheetsHelper.readSheetData('"위원별_담당기관"!A:Z');
        console.log('[committees-matching] 큰따옴표 추가 시트 접근 성공');
      } catch (error2) {
        console.error('[committees-matching] 큰따옴표 추가 시트 접근 실패:', error2.message);
        
        try {
          console.log('[committees-matching] URL 인코딩을 사용하여 시도');
          values = await sheetsHelper.readSheetData(encodeURIComponent('위원별_담당기관') + '!A:Z');
          console.log('[committees-matching] URL 인코딩 시트 접근 성공');
        } catch (error3) {
          console.error('[committees-matching] URL 인코딩 시트 접근 실패:', error3.message);
          throw new Error('위원별_담당기관 시트 접근 실패');
        }
      }
    }
    
    if (!values || values.length < 2) {
      console.log('[committees-matching] 구글 시트에서 데이터를 찾을 수 없음');
      return null;
    }
    
    // 헤더 행을 추출
    const headers = values[0];
    console.log('[committees-matching] 헤더 행:', headers);
    
    // 데이터 행을 JSON 객체로 변환
    const matchings = values.slice(1).map(row => {
      const matching = {};
      headers.forEach((header, index) => {
        if (index < row.length) {
          matching[header] = row[index];
        }
      });
      return matching;
    });
    
    console.log(`[committees-matching] 구글 시트에서 ${matchings.length}개 매칭 데이터 로드 완료`);
    console.log('[committees-matching] 매칭 데이터 예시:', matchings.slice(0, 2));
    return matchings;
  } catch (error) {
    console.error('[committees-matching] 구글 시트에서 데이터 가져오기 오류:', error.message, error.stack);
    return null;
  }
}

module.exports = async (req, res) => {
  try {
    console.log('[api/committees-matching] Request received, method:', req.method);
    
    // POST 요청 처리 (매칭 정보 저장)
    if (req.method === 'POST') {
      console.log('[api/committees-matching] POST request detected - updating matchings');
      
      // 요청 본문에서 매칭 데이터 가져오기
      const { matchings } = req.body;
      
      if (!matchings || !Array.isArray(matchings)) {
        console.error('[api/committees-matching] Invalid request body format');
        return res.status(400).json({
          status: 'error',
          message: '유효하지 않은 요청 형식입니다. matchings 배열이 필요합니다.'
        });
      }
      
      console.log(`[api/committees-matching] Received ${matchings.length} matchings to update`);
      
      // 매칭 데이터 검증
      const validMatchings = matchings.filter(m => {
        return m && m.committeeId && m.orgCode && 
               (m.role === '주담당' || m.role === '부담당' || m.role === 'main' || m.role === 'sub');
      });
      
      if (validMatchings.length === 0) {
        console.error('[api/committees-matching] No valid matchings found in request');
        return res.status(400).json({
          status: 'error',
          message: '유효한 매칭 데이터가 없습니다.'
        });
      }
      
      // 매칭 데이터 정규화
      const normalizedMatchings = validMatchings.map(m => ({
        committeeId: m.committeeId,
        committeeName: m.committeeName || '',
        orgCode: m.orgCode,
        orgName: m.orgName || '',
        region: m.region || '',
        role: m.role === 'main' ? '주담당' : (m.role === 'sub' ? '부담당' : m.role),
        checkType: m.checkType || '전체'
      }));
      
      // 캐시에 저장
      cacheManager.set('committee_matchings', {
        data: normalizedMatchings,
        timestamp: { created: Date.now() }
      }, 24 * 60 * 60 * 1000);
      
      console.log('[api/committees-matching] Matchings updated successfully in cache');
      
      // 구글 시트에 매칭 정보 저장
      try {
        console.log('[api/committees-matching] 구글 시트에 매칭 정보 저장 시도');
        
        // 1. 기존 시트 데이터 가져오기
        const existingData = await fetchMatchingsFromGoogleSheets();
        
        // 2. 시트에 저장할 데이터 준비
        // 헤더 행 정의
        const headers = [
          'committeeId', 'committeeName', 'orgCode', 'orgName', 'region', 'role', 'checkType'
        ];
        
        // 데이터 행 변환
        const rows = normalizedMatchings.map(matching => {
          return headers.map(header => matching[header] || '');
        });
        
        // 헤더와 데이터 행 결합
        const sheetData = [headers, ...rows];
        
        // 3. 구글 시트에 저장
        await sheetsHelper.writeSheetData('위원별_담당기관!A:G', sheetData);
        
        console.log(`[api/committees-matching] 구글 시트에 ${rows.length}개의 매칭 정보 저장 성공`);
      } catch (sheetError) {
        console.error('[api/committees-matching] 구글 시트 저장 오류:', sheetError);
        // 구글 시트 저장 실패해도 API는 성공 응답 반환
      }
      
      // 성공 응답 반환
      return res.status(200).json({
        status: 'success',
        message: '매칭 정보가 성공적으로 저장되었습니다.',
        count: normalizedMatchings.length
      });
    }
    
    // GET 요청 처리 (매칭 정보 조회)
    // 1. 데이터 가져오기 시도: 계층적 fallback 적용
    let matchingData = null;
    let dataSource = 'unknown';
    let lastSyncTime = null;
    
    // 1.1 캐시에서 가져오기 시도
    console.log('[api/committees-matching] Attempting to use cached data');
    const cachedData = cacheManager.get('committee_matchings');
    
    if (cachedData && cachedData.data && cachedData.data.length > 0) {
      matchingData = cachedData.data;
      lastSyncTime = cachedData.timestamp.created;
      dataSource = 'cache';
      console.log(`[api/committees-matching] Using cached data from ${new Date(lastSyncTime).toISOString()}`);
    } else {
      // 1.2 Google Sheets에서 직접 데이터 가져오기 시도
      console.log('[api/committees-matching] No cached data available, attempting to fetch from Google Sheets');
      matchingData = await fetchMatchingsFromGoogleSheets();
      
      if (matchingData && matchingData.length > 0) {
        dataSource = 'google-sheets';
        lastSyncTime = Date.now();
        
        // 캐시에 저장 (24시간 유효)
        cacheManager.set('committee_matchings', 
          { 
            data: matchingData, 
            timestamp: { created: lastSyncTime } 
          }, 
          24 * 60 * 60 * 1000
        );
        console.log('[api/committees-matching] Data fetched from Google Sheets and cached successfully');
      } else {
        // 1.3 구글 시트에서 데이터를 가져올 수 없는 경우에만 정적 fallback 데이터 사용
        console.log('[api/committees-matching] Failed to fetch data from Google Sheets, using static fallback data');
        matchingData = STATIC_FALLBACK_MATCHINGS;
        dataSource = 'static-fallback';
        
        // 캐시에 저장 (1시간 유효 - fallback 데이터는 짧게 유지)
        cacheManager.set('committee_matchings', 
          { 
            data: matchingData, 
            timestamp: { created: Date.now() } 
          }, 
          1 * 60 * 60 * 1000
        );
      }
    }
    
    // 2. 응답 반환
    return res.status(200).json({
      status: 'success',
      data: matchingData,
      meta: {
        source: dataSource,
        count: matchingData.length,
        lastSync: lastSyncTime ? new Date(lastSyncTime).toISOString() : null,
        usingFallback: dataSource === 'static-fallback'
      }
    });
  } catch (error) {
    console.error('[api/committees-matching] Unhandled error:', error.message);
    console.error(error.stack);
    
    // 오류가 발생해도 클라이언트에 기본 데이터는 제공 (GET 요청의 경우)
    if (req.method === 'GET') {
      return res.status(200).json({
        status: 'success',
        data: STATIC_FALLBACK_MATCHINGS,
        meta: {
          source: 'error-fallback',
          error: error.message,
          usingFallback: true
        }
      });
    }
    
    // POST 요청 오류 응답
    return res.status(500).json({
      status: 'error',
      message: '매칭 정보 처리 중 오류가 발생했습니다.',
      error: error.message
    });
  }
}; 
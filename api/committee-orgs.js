// 위원별 담당 기관 API 엔드포인트
const sheetsHelper = require('./sheets-helper');
const cacheManager = require('./cache-manager');
const { STATIC_FALLBACK_MATCHINGS } = require('./committees-matching');

module.exports = async (req, res) => {
  try {
    console.log('[api/committee-orgs] 요청 수신');
    
    // 요청에서 위원명 가져오기
    const committeeName = req.query.committeeName;
    console.log(`[api/committee-orgs] 위원명: ${committeeName}`);
    
    if (!committeeName) {
      return res.status(400).json({
        status: 'error',
        message: '위원명이 제공되지 않았습니다.'
      });
    }
    
    // 캐시 키 생성 (위원별로 다른 캐시 사용)
    const cacheKey = `committee_orgs_${committeeName}`;
    
    // 1. 캐시에서 데이터 확인
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      console.log(`[api/committee-orgs] 캐시된 데이터 사용 (${committeeName})`);
      return res.status(200).json({
        status: 'success',
        data: cachedData.data,
        meta: {
          source: 'cache',
          timestamp: cachedData.timestamp.created
        }
      });
    }
    
    // 2. 구글 시트에서 데이터 가져오기
    try {
      console.log(`[api/committee-orgs] 구글 시트에서 데이터 가져오기 시도 (위원: ${committeeName})`);
      
      // 시트 데이터 가져오기
      const values = await sheetsHelper.readSheetData('위원별_담당기관!A:H');
      
      if (!values || values.length < 2) {
        throw new Error('시트 데이터가 없거나 형식이 올바르지 않습니다.');
      }
      
      // 헤더 행 추출
      const headers = values[0];
      console.log('[api/committee-orgs] 헤더 행:', headers);
      
      // 데이터 행을 JSON 객체로 변환
      const allMatchings = values.slice(1).map(row => {
        const matching = {};
        headers.forEach((header, index) => {
          if (index < row.length) {
            matching[header] = row[index];
          }
        });
        return matching;
      });
      
      // 위원명으로 필터링
      const committeeMatchings = allMatchings.filter(item => 
        item.committeeName === committeeName || 
        item.위원명 === committeeName || 
        item.committee === committeeName
      );
      
      console.log(`[api/committee-orgs] ${committeeName} 위원 매칭 데이터 ${committeeMatchings.length}개 찾음`);
      
      if (committeeMatchings.length > 0) {
        // 캐시에 저장 (1시간 유효)
        cacheManager.set(cacheKey, committeeMatchings, 60 * 60 * 1000);
        
        return res.status(200).json({
          status: 'success',
          data: committeeMatchings,
          meta: {
            source: 'sheets',
            count: committeeMatchings.length
          }
        });
      } else {
        throw new Error(`${committeeName} 위원의 매칭 데이터를 찾을 수 없습니다.`);
      }
    } catch (sheetError) {
      console.error('[api/committee-orgs] 구글 시트 데이터 가져오기 오류:', sheetError.message);
      
      // 3. 정적 fallback 데이터 사용
      const fallbackMatchings = STATIC_FALLBACK_MATCHINGS.filter(item => 
        item.committeeName === committeeName || 
        item.위원명 === committeeName || 
        item.committee === committeeName
      );
      
      console.log(`[api/committee-orgs] ${committeeName} 위원 정적 fallback 데이터 ${fallbackMatchings.length}개 사용`);
      
      return res.status(200).json({
        status: 'success',
        data: fallbackMatchings,
        meta: {
          source: 'static-fallback',
          count: fallbackMatchings.length
        }
      });
    }
  } catch (error) {
    console.error('[api/committee-orgs] 처리 오류:', error.message);
    
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

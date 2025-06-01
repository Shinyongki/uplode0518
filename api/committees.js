// 위원회 데이터 API 엔드포인트
const sheetsHelper = require('./sheets-helper');

module.exports = async (req, res) => {
  try {
    console.log('[api/committees] Request received');
    
    // 구글 시트에서 위원회 데이터 가져오기 시도
    let committeeData;
    
    try {
      console.log('[api/committees] 구글 시트에서 위원 데이터 가져오기 시도');
      
      // 사용자가 제공한 정확한 시트명 사용
      try {
        console.log('[api/committees] committees 시트에서 데이터 가져오기 시도');
        committeeData = await sheetsHelper.readSheetData('committees!A:C');
        console.log('[api/committees] committees 시트 데이터 로드 성공:', committeeData.length > 1 ? `${committeeData.length-1}개 항목` : '데이터 없음');
      } catch (error1) {
        console.error('[api/committees] committees 시트 접근 실패:', error1.message, error1.stack);
        
        // 실패 시 다른 형식의 시트명 시도
        try {
          console.log('[api/committees] 시트 이름에 큰따옴표 추가하여 시도');
          committeeData = await sheetsHelper.readSheetData('"committees"!A:C');
          console.log('[api/committees] 큰따옴표 추가 시트 접근 성공');
        } catch (error2) {
          console.error('[api/committees] 큰따옴표 추가 시트명 접근 실패:', error2.message);
          
          // 시트 인덱스로 시도
          try {
            console.log('[api/committees] 첫 번째 시트 시도');
            committeeData = await sheetsHelper.readSheetData('Sheet1!A:C');
            console.log('[api/committees] 첫 번째 시트 접근 성공');
          } catch (error3) {
            console.error('[api/committees] 첫 번째 시트 접근 실패:', error3.message);
            throw new Error('모든 위원 데이터 접근 방법 실패');
          }
        }
      }
      
      console.log(`[api/committees] 위원 데이터 로드 성공: ${committeeData.length - 1}명의 위원`);
    } catch (error) {
      console.error('[api/committees] 구글 시트에서 위원 데이터 가져오기 실패:', error.message);
      
      // 오류 발생 시 fallback 데이터 사용
      console.log('[api/committees] fallback 데이터 사용');
      committeeData = sheetsHelper.getFallbackData('committees');
    }
    
    // 헤더 제거 및 객체 배열로 변환
    const headers = committeeData[0] || ['name', 'id', 'role'];
    const committees = committeeData.slice(1).map(row => {
      const committee = {};
      headers.forEach((header, index) => {
        committee[header.toLowerCase()] = row[index] || '';
      });
      return committee;
    });
    
    return res.status(200).json({
      status: 'success',
      data: committees,
      source: committeeData === sheetsHelper.getFallbackData('committees') ? 'fallback' : 'sheets'
    });
  } catch (error) {
    console.error('[api/committees] Unhandled error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: '위원회 데이터를 가져오는 중 오류가 발생했습니다.',
      error: error.message
    });
  }
}; 
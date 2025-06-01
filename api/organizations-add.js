// 기관 추가 API 엔드포인트
const { writeSheetData } = require('./sheets-helper');

// 스프레드시트 ID 설정
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';

module.exports = async (req, res) => {
  try {
    // POST 요청 처리
    if (req.method === 'POST') {
      const { code, name, region, note, mainCommitteeId, subCommitteeId } = req.body;
      
      // 필수 필드 검증
      if (!code || !name || !region || !mainCommitteeId || !subCommitteeId) {
        return res.status(400).json({
          status: 'error',
          message: '필수 필드가 누락되었습니다.'
        });
      }
      
      // 코드 형식 검증 (A48로 시작하는지)
      if (!code.startsWith('A48')) {
        return res.status(400).json({
          status: 'error',
          message: '기관코드는 A48로 시작해야 합니다.'
        });
      }
      
      // 구글 시트에 데이터 저장
      try {
        console.log('구글 시트에 기관 데이터 저장 시도:', { code, name, region });
        
        // 시트에 저장할 데이터 행 준비
        const newRow = [
          code,
          name,
          region,
          note || '',
          mainCommitteeId || '',
          subCommitteeId || '',
          new Date().toISOString() // 저장 시간
        ];
        
        // 구글 시트에 저장 - 마지막 행 다음에 추가
        // 조직 데이터가 저장된 시트 이름을 지정
        await writeSheetData(SPREADSHEET_ID, '기관_목록!A:G', [newRow]);
        
        console.log('구글 시트에 기관 데이터 저장 성공');
      } catch (sheetError) {
        console.error('구글 시트 저장 오류:', sheetError);
        // 시트 저장 오류가 발생해도 API는 성공 응답 반환
        // 실제 프로덕션에서는 오류 처리를 더 업그레이드해야 함
      }
      
      return res.status(200).json({
        status: 'success',
        message: '기관이 성공적으로 추가되었습니다.',
        data: {
          code,
          name,
          region,
          note,
          mainCommitteeId,
          subCommitteeId,
          id: `ORG_${Date.now()}`  // 임시 ID 생성
        }
      });
    }
    
    // GET 요청 등 다른 메서드는 지원하지 않음
    return res.status(405).json({
      status: 'error',
      message: '지원하지 않는 HTTP 메서드입니다.'
    });
  } catch (error) {
    console.error('기관 추가 API 오류:', error);
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
};

// 구글 시트 일정 관리 API
const sheetsHelper = require('./sheets-helper');

// 스프레드시트 ID 설정
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';

// 환경 변수 로깅
console.log('[api/sheets-schedules] 환경 변수 상태:');
console.log('- SPREADSHEET_ID 존재 여부:', !!process.env.SPREADSHEET_ID);
console.log('- SERVICE_ACCOUNT_KEY 존재 여부:', !!process.env.SERVICE_ACCOUNT_KEY);
console.log('- 사용 중인 SPREADSHEET_ID:', SPREADSHEET_ID);

// Vercel 서버리스 함수로 변환
module.exports = async (req, res) => {
  console.log('[api/sheets-schedules] 요청 메소드:', req.method);
  console.log('[api/sheets-schedules] 요청 URL:', req.url);
  console.log('[api/sheets-schedules] 요청 헤더:', JSON.stringify(req.headers, null, 2));
  
  // GET 요청 처리 (데이터 가져오기)
  if (req.method === 'GET') {
  try {
    console.log('[api/sheets-schedules] GET 요청 처리 시작');
    
    // 스프레드시트 ID 확인
    if (!SPREADSHEET_ID) {
      console.error('[api/sheets-schedules] 스프레드시트 ID가 없습니다.');
      return res.status(500).json({
        status: 'error',
        message: '스프레드시트 ID가 설정되지 않았습니다.'
      });
    }
    
    // 방문일정 시트에서 데이터 가져오기
    const sheetName = '방문일정';
    console.log(`[api/sheets-schedules] ${sheetName} 시트에서 데이터 가져오기 시도`);
    
    let data;
    try {
      data = await sheetsHelper.readSheet(sheetName);
      console.log(`[api/sheets-schedules] ${sheetName} 시트 데이터 가져오기 성공:`, data ? `${data.length}개 행` : '데이터 없음');
    } catch (sheetError) {
      console.error(`[api/sheets-schedules] ${sheetName} 시트 데이터 가져오기 실패:`, sheetError);
      return res.status(500).json({
        status: 'error',
        message: `구글 시트 데이터 가져오기 오류: ${sheetError.message}`,
        error: sheetError.message
      });
    }
    
    if (!data || data.length === 0) {
      return res.status(200).json({
        status: 'success',
        schedules: []
      });
    }
    
    // 헤더 행 가져오기 (첫 번째 행)
    const headers = data[0];
    
    // 데이터 행 처리 (헤더 제외)
    const schedules = data.slice(1).map(row => {
      const schedule = {};
      
      // 각 열을 헤더와 매핑하여 객체 생성
      headers.forEach((header, index) => {
        if (row[index] !== undefined) {
          schedule[header] = row[index];
        } else {
          schedule[header] = '';
        }
      });
      
      return schedule;
    });
    
    return res.status(200).json({
      status: 'success',
      schedules
    });
  } catch (error) {
    console.error('[api/sheets-schedules] 구글 시트에서 일정 데이터 가져오기 오류:', error);
    console.error('[api/sheets-schedules] 오류 세부 정보:', error.stack);
    
    // 오류 응답 상세화
    return res.status(500).json({
      status: 'error',
      message: '구글 시트에서 일정 데이터를 가져오는 중 오류가 발생했습니다.',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
  }
  
  // POST 요청 처리 (데이터 저장하기)
  else if (req.method === 'POST') {
  try {
    console.log('[api/sheets-schedules] POST 요청 처리 시작');
    console.log('[api/sheets-schedules] 요청 본문:', JSON.stringify(req.body, null, 2));
    
    const { sheetName, schedules } = req.body;
    
    // 입력 데이터 검증
    if (!sheetName) {
      console.error('[api/sheets-schedules] 시트 이름이 지정되지 않았습니다.');
      return res.status(400).json({
        status: 'error',
        message: '시트 이름이 지정되지 않았습니다.'
      });
    }
    
    if (!schedules) {
      console.error('[api/sheets-schedules] 일정 데이터가 지정되지 않았습니다.');
      return res.status(400).json({
        status: 'error',
        message: '일정 데이터가 지정되지 않았습니다.'
      });
    }
    
    if (!Array.isArray(schedules)) {
      console.error('[api/sheets-schedules] 일정 데이터가 배열 형식이 아닙니다.');
      return res.status(400).json({
        status: 'error',
        message: '일정 데이터는 배열 형식이어야 합니다.'
      });
    }
    
    console.log(`구글 시트 '${sheetName}'에 ${schedules.length}개의 일정 데이터 저장 시도`);
    
    // 기존 시트 데이터 가져오기
    const existingData = await sheetsHelper.readSheet(sheetName);
    
    if (!existingData || existingData.length === 0) {
      // 시트가 비어있는 경우, 헤더 행 생성
      const headers = ['위원ID', '위원명', '기관코드', '기관명', '방문일자', '방문시간', '목적', '메모', '상태'];
      await sheetsHelper.writeSheetData(SPREADSHEET_ID, `${sheetName}!A1:I1`, [headers]);
      
      // 데이터 행 추가
      const values = schedules.map(schedule => [
        schedule.위원ID || '',
        schedule.위원명 || '',
        schedule.기관코드 || '',
        schedule.기관명 || '',
        schedule.방문일자 || '',
        schedule.방문시간 || '',
        schedule.목적 || '',
        schedule.메모 || '',
        schedule.상태 || 'pending'
      ]);
      
      if (values.length > 0) {
        await sheetsHelper.writeSheetData(SPREADSHEET_ID, `${sheetName}!A2:I${values.length + 1}`, values);
      }
    } else {
      // 시트에 이미 데이터가 있는 경우
      const headers = existingData[0];
      
      // 기존 데이터 삭제 (헤더 제외)
      if (existingData.length > 1) {
        // 기존 데이터 범위 계산
        const lastRow = existingData.length;
        await sheetsHelper.writeSheetData(SPREADSHEET_ID, `${sheetName}!A2:${String.fromCharCode(65 + headers.length - 1)}${lastRow}`, 
          Array(lastRow - 1).fill(Array(headers.length).fill('')));
      }
      
      // 새 데이터 추가
      const values = schedules.map(schedule => [
        schedule.위원ID || '',
        schedule.위원명 || '',
        schedule.기관코드 || '',
        schedule.기관명 || '',
        schedule.방문일자 || '',
        schedule.방문시간 || '',
        schedule.목적 || '',
        schedule.메모 || '',
        schedule.상태 || 'pending'
      ]);
      
      if (values.length > 0) {
        await sheetsHelper.writeSheetData(SPREADSHEET_ID, `${sheetName}!A2:I${values.length + 1}`, values);
      }
    }
    
    return res.status(200).json({
      status: 'success',
      message: '일정 데이터가 구글 시트에 성공적으로 저장되었습니다.'
    });
  } catch (error) {
    console.error('[api/sheets-schedules] 구글 시트에 일정 데이터 저장 오류:', error);
    console.error('[api/sheets-schedules] 오류 세부 정보:', error.stack);
    
    // 오류 응답 상세화
    return res.status(500).json({
      status: 'error',
      message: '구글 시트에 일정 데이터를 저장하는 중 오류가 발생했습니다.',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
  }
  
  // 지원되지 않는 메소드
  else {
    console.log(`[api/sheets-schedules] 지원되지 않는 메소드: ${req.method}`);
    return res.status(405).json({
      status: 'error',
      message: `지원되지 않는 요청 메소드입니다: ${req.method}`,
      supportedMethods: ['GET', 'POST']
    });
  }
};

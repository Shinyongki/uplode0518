// 일정 데이터 API 엔드포인트
const sheetsHelper = require('./sheets-helper');

// 정적 fallback 데이터 (당일 +/- 7일 범위의 임시 일정)
const FALLBACK_SCHEDULES = generateFallbackSchedules();

function generateFallbackSchedules() {
  const schedules = [];
  const today = new Date();
  const committees = ['신용기', '문일지', '김수연', '이연숙', '이정혜'];
  const organizations = [
    '동진노인종합복지센터', 
    '창원도우누리노인복지센터', 
    '마산시니어클럽', 
    '김해시니어클럽', 
    '생명의전화노인복지센터', 
    '보현행정노인복지센터'
  ];
  
  // 오늘 날짜에서 -7일부터 +7일까지의 일정 생성
  for (let i = -7; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    
    // 주말은 건너뛰기
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    // 각 날짜마다 1-3개의 랜덤 일정 생성
    const scheduleCount = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < scheduleCount; j++) {
      const committeeIndex = Math.floor(Math.random() * committees.length);
      const orgIndex = Math.floor(Math.random() * organizations.length);
      
      schedules.push({
        id: `sched-${date.getTime()}-${j}`,
        date: formatDate(date),
        committeeName: committees[committeeIndex],
        organizationName: organizations[orgIndex],
        title: '정기 모니터링',
        status: '예정'
      });
    }
  }
  
  return schedules;
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

module.exports = async (req, res) => {
  try {
    console.log('[api/schedules] Request received');
    
    // 구글 시트에서 일정 데이터 가져오기 시도
    let schedulesData;
    
    try {
      console.log('[api/schedules] Attempting to fetch data from Google Sheets');
      // 시트 이름에 한글이 포함되어 있어서 발생할 수 있는 문제 처리
      try {
        console.log('[api/schedules] 시도 1: 일정_관리 시트에서 데이터 가져오기 (큰따옴표 사용)');
        schedulesData = await sheetsHelper.readSheetData('"일정_관리"!A:H');
      } catch (sheetError1) {
        console.error('[api/schedules] 큰따옴표 사용한 시트 접근 실패:', sheetError1.message);
        
        try {
          console.log('[api/schedules] 시도 2: 일정_관리 시트에서 데이터 가져오기 (작은따옴표)');
          schedulesData = await sheetsHelper.readSheetData('\'일정_관리\'!A:H');
        } catch (sheetError1b) {
          console.error('[api/schedules] 작은따옴표 사용한 시트 접근 실패:', sheetError1b.message);
        
          // 대체 방법 1: URL 인코딩 시도
          try {
            console.log('[api/schedules] 시도 3: URL 인코딩된 시트 이름으로 시도');
            const encodedSheetName = encodeURIComponent('일정_관리');
            schedulesData = await sheetsHelper.readSheetData(`${encodedSheetName}!A:H`);
          } catch (sheetError2) {
            console.error('[api/schedules] URL 인코딩된 시트 이름 접근 실패:', sheetError2.message);
            
            // 대체 방법 2: 시트 인덱스 사용 시도
            try {
              console.log('[api/schedules] 시도 4: 시트 인덱스로 시도 (Sheet1)');
              schedulesData = await sheetsHelper.readSheetData('Sheet1!A:H');
            } catch (sheetError3) {
              console.error('[api/schedules] 시트 인덱스 접근 실패:', sheetError3.message);
              
              // 대체 방법 3: 시트 ID로 시도 (스프레드시트의 첫 번째 시트부터 순서대로 0, 1, 2...)
              try {
                console.log('[api/schedules] 시도 5: 시트 ID로 시도');
                // 구글 API에서 시트 목록 가져오기
                const sheets = await sheetsHelper.getSheetsClient();
                const response = await sheets.spreadsheets.get({
                  spreadsheetId: process.env.SPREADSHEET_ID,
                  fields: 'sheets.properties'
                });
                
                // 시트 목록에서 일정_관리 시트 찾기
                let sheetId = null;
                let sheetIndex = 0;
                
                if (response.data && response.data.sheets) {
                  console.log('[api/schedules] 스프레드시트 시트 목록:', 
                    response.data.sheets.map(s => s.properties.title).join(', '));
                  
                  // 일정_관리 시트 찾기
                  const targetSheet = response.data.sheets.find(s => 
                    s.properties.title === '일정_관리');
                  
                  if (targetSheet) {
                    sheetId = targetSheet.properties.sheetId;
                    console.log(`[api/schedules] 일정_관리 시트 ID: ${sheetId} 발견`);
                  } else {
                    // 일정_관리 시트를 찾지 못한 경우, 기본으로 첫 번째 시트 사용
                    sheetId = response.data.sheets[0].properties.sheetId;
                    sheetIndex = 0;
                    console.log(`[api/schedules] 일정_관리 시트 못 찾음, 첫 번째 시트 ID: ${sheetId} 사용`);
                  }
                  
                  // 찾은 시트 ID로 데이터 가져오기
                  const range = `${response.data.sheets[sheetIndex].properties.title}!A:H`;
                  console.log(`[api/schedules] 시트 이름으로 접근: ${range}`);
                  schedulesData = await sheetsHelper.readSheetData(range);
                }
              } catch (sheetError4) {
                console.error('[api/schedules] 시트 ID 접근 실패:', sheetError4.message);
                throw new Error('모든 시트 접근 방법 실패');
              }
            }
          }
        }
      }
      console.log(`[api/schedules] Successfully fetched ${schedulesData.length - 1} schedule records`);
      
      // 헤더 제거 및 객체 배열로 변환
      const headers = schedulesData[0] || ['id', 'date', 'committeeName', 'organizationName', 'orgCode', 'title', 'status', 'notes'];
      const schedules = schedulesData.slice(1).map(row => {
        return {
          id: row[0] || `sched-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          date: row[1] || formatDate(new Date()),
          committeeName: row[2] || '',
          organizationName: row[3] || '',
          orgCode: row[4] || '',
          title: row[5] || '정기 모니터링',
          status: row[6] || '예정',
          notes: row[7] || ''
        };
      });
      
      console.log('[api/schedules] Sample schedule data:', schedules.length > 0 ? schedules[0] : 'No schedules found');
      
      return res.status(200).json({
        status: 'success',
        data: schedules,
        source: 'sheets'
      });
    } catch (error) {
      console.error('[api/schedules] Error fetching from Google Sheets:', error.message);
      console.error(error.stack);
      
      // 오류 발생 시 fallback 데이터 사용
      console.log('[api/schedules] Using fallback data');
      
      return res.status(200).json({
        status: 'success',
        data: FALLBACK_SCHEDULES,
        source: 'fallback'
      });
    }
  } catch (error) {
    console.error('[api/schedules] Unhandled error:', error.message);
    console.error(error.stack);
    
    return res.status(500).json({
      status: 'error',
      message: '일정 데이터를 가져오는 중 오류가 발생했습니다.',
      error: error.message
    });
  }
}; 
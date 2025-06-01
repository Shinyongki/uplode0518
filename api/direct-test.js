// 구글 시트 직접 테스트를 위한 간단한 스크립트
const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const sheetsHelper = require('./sheets-helper');

// 루트 경로에 테스트 엔드포인트 추가
router.get('/sheet-test', async (req, res) => {
  try {
    console.log('[DIRECT TEST] 구글 시트 연결 테스트 시작');
    
    // 구글 시트 인증 클라이언트 가져오기
    let authClient;
    try {
      authClient = await sheetsHelper.getAuthClient();
      console.log('[DIRECT TEST] 인증 클라이언트 가져오기 성공:', authClient ? '성공' : '실패');
      
      if (!authClient) {
        throw new Error('인증 클라이언트가 null입니다.');
      }
    } catch (authError) {
      console.error('[DIRECT TEST] 인증 클라이언트 가져오기 실패:', authError);
      return res.status(500).json({
        status: 'error',
        message: `인증 오류: ${authError.message}`,
        error: authError.toString()
      });
    }
    
    // 구글 시트 API 클라이언트 생성
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    console.log('[DIRECT TEST] 구글 시트 API 클라이언트 생성 성공');
    
    // 스프레드시트 ID 확인
    const spreadsheetId = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';
    if (!spreadsheetId) {
      throw new Error('SPREADSHEET_ID가 정의되지 않았습니다.');
    }
    console.log('[DIRECT TEST] 스프레드시트 ID:', spreadsheetId);
    
    // 시트 이름 (쿼리 파라미터에서 가져오거나 기본값 사용)
    const sheetName = req.query.sheet || 'indicators';
    console.log(`[DIRECT TEST] 테스트할 시트 이름: '${sheetName}'`);
    
    // 1. 스프레드시트의 모든 시트 목록 가져오기
    let sheetsInfo = [];
    try {
      const sheetsResponse = await sheets.spreadsheets.get({
        spreadsheetId
      });
      console.log('[DIRECT TEST] 스프레드시트 정보 가져오기 성공!');
      
      sheetsInfo = sheetsResponse.data.sheets.map(sheet => ({
        title: sheet.properties.title,
        sheetId: sheet.properties.sheetId,
        index: sheet.properties.index
      }));
      
      console.log('[DIRECT TEST] 시트 목록:', sheetsInfo.map(sheet => sheet.title));
    } catch (sheetsError) {
      console.error('[DIRECT TEST] 스프레드시트 정보 가져오기 실패:', sheetsError.message);
      return res.status(500).json({
        status: 'error',
        message: `스프레드시트 정보 가져오기 실패: ${sheetsError.message}`,
        error: sheetsError.toString()
      });
    }
    
    // 2. 지정된 시트의 데이터 가져오기
    let sheetData = [];
    try {
      // 범위 설정 (A:Z는 A열부터 Z열까지 모든 데이터)
      const range = `${sheetName}!A:Z`;
      console.log(`[DIRECT TEST] 구글 시트 조회: 시트=${sheetName}, 범위=${range}`);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      console.log('[DIRECT TEST] 구글 시트 API 호출 성공!');
      
      // 데이터 추출
      const rows = response.data.values || [];
      console.log(`[DIRECT TEST] 구글 시트 응답 받음: ${rows.length}개 행 데이터`);
      
      if (rows.length > 0) {
        // 헤더 행 추출 (첫 번째 행)
        const headers = rows[0] || [];
        console.log('[DIRECT TEST] 헤더 정보:', headers);
        
        // 데이터 행 변환 (객체 형태로)
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          const rowData = {};
          headers.forEach((header, index) => {
            if (index < row.length) {
              // monthlyStatus 필드가 있고 JSON 형태라면 파싱
              if (header === 'monthlyStatus' && row[index]) {
                try {
                  // JSON 문자열인지 확인하고 파싱
                  if (typeof row[index] === 'string') {
                    // 중괄호로 시작하는 경우 JSON으로 파싱 시도
                    if (row[index].trim().startsWith('{')) {
                      rowData[header] = JSON.parse(row[index]);
                      console.log(`[DIRECT TEST] monthlyStatus JSON 파싱 성공:`, rowData[header]);
                    } 
                    // 빈 객체로 시작하는 경우 기본값 설정
                    else if (row[index].trim() === '{}' || row[index].trim() === '') {
                      rowData[header] = {};
                      console.log(`[DIRECT TEST] monthlyStatus 빈 객체로 설정`);
                    }
                    // 그 외의 경우 문자열 그대로 사용
                    else {
                      rowData[header] = row[index];
                      console.log(`[DIRECT TEST] monthlyStatus 문자열 그대로 사용:`, row[index]);
                    }
                  } else {
                    rowData[header] = row[index];
                    console.log(`[DIRECT TEST] monthlyStatus 타입:`, typeof row[index]);
                  }
                } catch (jsonError) {
                  console.error(`[DIRECT TEST] monthlyStatus JSON 파싱 오류:`, jsonError);
                  // 파싱 오류 시 빈 객체로 설정
                  rowData[header] = {};
                }
              } else {
                rowData[header] = row[index] || '';
              }
            } else {
              rowData[header] = '';
            }
          });
          
          sheetData.push(rowData);
        }
      }
    } catch (dataError) {
      console.error('[DIRECT TEST] 시트 데이터 가져오기 실패:', dataError.message);
      return res.status(500).json({
        status: 'error',
        message: `시트 데이터 가져오기 실패: ${dataError.message}`,
        error: dataError.toString()
      });
    }
    
    // 데이터 로깅 (디버깅용)
    console.log('[DIRECT TEST] 반환할 데이터 샘플:', JSON.stringify(sheetData.slice(0, 2), null, 2));
    
    // monthlyStatus 필드가 있는 행 확인
    const rowsWithMonthlyStatus = sheetData.filter(row => row.monthlyStatus);
    if (rowsWithMonthlyStatus.length > 0) {
      console.log(`[DIRECT TEST] monthlyStatus 필드가 있는 행: ${rowsWithMonthlyStatus.length}개`);
      console.log('[DIRECT TEST] 첫 번째 monthlyStatus 예시:', rowsWithMonthlyStatus[0].monthlyStatus);
    } else {
      console.log('[DIRECT TEST] monthlyStatus 필드가 있는 행이 없습니다.');
    }
    
    // 4. 현재 로그인한 사용자 이름으로 저장된 시트에서 월별 상태 정보 가져오기
    try {
      // 세션에서 현재 로그인한 사용자 정보 가져오기
      const currentUser = req.session && req.session.committee ? req.session.committee.name : '';
      console.log(`[DIRECT TEST] 현재 로그인한 사용자: ${currentUser || '없음'}`);
      
      if (!currentUser) {
        console.log('[DIRECT TEST] 로그인한 사용자 정보가 없습니다. 데이터를 불러올 수 없습니다.');
        throw new Error('로그인한 사용자 정보가 없습니다.');
      }
      
      console.log(`[DIRECT TEST] ${currentUser} 사용자 시트에서 월별 상태 정보 가져오기 시도`);
      
      // 현재 로그인한 사용자의 시트 데이터 가져오기
      const userSheet = currentUser;
      const userSheetResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${userSheet}!A:Z`,
      });
      
      const userSheetRows = userSheetResponse.data.values || [];
      console.log(`[DIRECT TEST] '${userSheet}' 시트에서 ${userSheetRows.length}개의 행 가져옴`);
      
      if (userSheetRows.length > 1) {
        // 헤더 행 추출
        const userSheetHeaders = userSheetRows[0] || [];
        console.log('[DIRECT TEST] 사용자 시트 헤더:', userSheetHeaders);
        
        // indicatorId, monthlyStatus 열 인덱스 찾기
        const indicatorIdIndex = userSheetHeaders.findIndex(h => h === 'indicatorId' || h === '지표ID');
        
        // 모니터링현황 열 찾기
        let monthlyStatusIndex = userSheetHeaders.findIndex(h => 
          h === 'monthlyStatus' || 
          h === '모니터링현황');
        
        // 인덱스를 찾지 못했다면 J열(9번째 열)을 기본값으로 사용
        if (monthlyStatusIndex === -1) {
          monthlyStatusIndex = 9; // J열은 0부터 시작하면 9번째 열
          console.log(`[DIRECT TEST] 체크리스트결과/모니터링현황 열을 찾지 못해 J열(9번째 열)을 사용합니다.`);
        }
        
        console.log(`[DIRECT TEST] K열(10번째 열) 헤더:`, userSheetHeaders[10] || '없음');
        
        if (indicatorIdIndex !== -1 && monthlyStatusIndex !== -1) {
          console.log(`[DIRECT TEST] indicatorId 열: ${indicatorIdIndex}, monthlyStatus 열: ${monthlyStatusIndex}`);
          
          // 데이터 행 처리
          for (let i = 1; i < userSheetRows.length; i++) {
            const userRow = userSheetRows[i];
            if (!userRow || userRow.length <= indicatorIdIndex) continue;
            
            const rowIndicatorId = userRow[indicatorIdIndex];
            const rowMonthlyStatus = userRow[monthlyStatusIndex];
            
            // 월별 상태 정보가 있는 경우
            if (rowIndicatorId && rowMonthlyStatus) {
              console.log(`[DIRECT TEST] 지표 ${rowIndicatorId}의 월별 상태 정보 발견:`, rowMonthlyStatus);
              
              // 해당 지표의 데이터 찾기
              const targetIndicator = sheetData.find(item => item.id === rowIndicatorId);
              if (targetIndicator) {
                try {
                  // 문자열이면 JSON으로 파싱 시도
                  if (typeof rowMonthlyStatus === 'string') {
                    if (rowMonthlyStatus.trim().startsWith('{')) {
                      targetIndicator.monthlyStatus = JSON.parse(rowMonthlyStatus);
                    } else {
                      targetIndicator.monthlyStatus = rowMonthlyStatus;
                    }
                  } else {
                    targetIndicator.monthlyStatus = rowMonthlyStatus;
                  }
                  
                  console.log(`[DIRECT TEST] 지표 ${rowIndicatorId}에 월별 상태 정보 추가 성공:`, targetIndicator.monthlyStatus);
                } catch (parseError) {
                  console.error(`[DIRECT TEST] 월별 상태 정보 파싱 오류:`, parseError);
                }
              }
            }
          }
        } else {
          console.log(`[DIRECT TEST] 필요한 열을 찾을 수 없습니다. indicatorId: ${indicatorIdIndex}, monthlyStatus: ${monthlyStatusIndex}`);
        }
      }
    } catch (userSheetError) {
      console.error('[DIRECT TEST] 사용자 시트 조회 오류:', userSheetError);
    }
    
    // 월별 상태 정보 추가 후 확인
    const rowsWithMonthlyStatusAfter = sheetData.filter(row => row.monthlyStatus);
    console.log(`[DIRECT TEST] 월별 상태 정보 추가 후 monthlyStatus 필드가 있는 행: ${rowsWithMonthlyStatusAfter.length}개`);
    
    // 3. 결과 반환
    return res.status(200).json({
      status: 'success',
      message: `구글 시트 연결 테스트 성공`,
      data: {
        spreadsheetId,
        sheets: sheetsInfo,
        currentSheet: sheetName,
        rowCount: sheetData.length,
        sampleData: sheetData.slice(0, 5), // 처음 5개 행만 샘플로 반환
        allData: sheetData // 모든 데이터 반환
      }
    });
    
  } catch (error) {
    console.error('[DIRECT TEST] 구글 시트 테스트 중 오류 발생:', error);
    return res.status(500).json({
      status: 'error',
      message: `구글 시트 테스트 중 오류 발생: ${error.message}`,
      error: error.toString()
    });
  }
});

module.exports = router;

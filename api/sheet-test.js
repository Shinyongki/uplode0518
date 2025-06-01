const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const sheetsHelper = require('./sheets-helper');

/**
 * 구글 시트 테스트 엔드포인트
 * 구글 시트의 모든 시트 목록과 지정된 시트의 원본 데이터를 반환합니다.
 */
router.get('/test', async (req, res) => {
  try {
    console.log('[TEST API] 구글 시트 연결 테스트 시작');
    
    // 구글 시트 인증 클라이언트 가져오기
    let authClient;
    try {
      authClient = await sheetsHelper.getAuthClient();
      console.log('[TEST API] 인증 클라이언트 가져오기 성공:', authClient ? '성공' : '실패');
      
      if (!authClient) {
        throw new Error('인증 클라이언트가 null입니다.');
      }
    } catch (authError) {
      console.error('[TEST API] 인증 클라이언트 가져오기 실패:', authError);
      return res.status(500).json({
        status: 'error',
        message: `인증 오류: ${authError.message}`,
        error: authError.toString()
      });
    }
    
    // 구글 시트 API 클라이언트 생성
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    console.log('[TEST API] 구글 시트 API 클라이언트 생성 성공');
    
    // 스프레드시트 ID 확인
    const spreadsheetId = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';
    if (!spreadsheetId) {
      throw new Error('SPREADSHEET_ID가 정의되지 않았습니다.');
    }
    console.log('[TEST API] 스프레드시트 ID:', spreadsheetId);
    
    // 시트 이름 (쿼리 파라미터에서 가져오거나 기본값 사용)
    const sheetName = req.query.sheet || 'indicators';
    const period = req.query.period || '';
    const orgCode = req.query.orgCode || '';
    console.log(`[TEST API] 테스트할 시트 이름: '${sheetName}', 기간: '${period}', 기관코드: '${orgCode}'`);
    
    // 1. 스프레드시트의 모든 시트 목록 가져오기
    let sheetsInfo = [];
    try {
      const sheetsResponse = await sheets.spreadsheets.get({
        spreadsheetId
      });
      console.log('[TEST API] 스프레드시트 정보 가져오기 성공!');
      
      sheetsInfo = sheetsResponse.data.sheets.map(sheet => ({
        title: sheet.properties.title,
        sheetId: sheet.properties.sheetId,
        index: sheet.properties.index,
        sheetType: sheet.properties.sheetType,
        gridProperties: sheet.properties.gridProperties
      }));
      
      console.log('[TEST API] 시트 목록:', sheetsInfo.map(sheet => sheet.title));
      
      // 시트 이름 확인
      const sheetExists = sheetsResponse.data.sheets.some(sheet => sheet.properties.title === sheetName);
      console.log(`[TEST API] '${sheetName}' 시트 존재 여부:`, sheetExists ? '존재함' : '존재하지 않음');
      
      if (!sheetExists) {
        return res.status(404).json({
          status: 'error',
          message: `'${sheetName}' 시트가 존재하지 않습니다.`,
          availableSheets: sheetsInfo.map(sheet => sheet.title)
        });
      }
    } catch (sheetsError) {
      console.error('[TEST API] 스프레드시트 정보 가져오기 실패:', sheetsError.message);
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
      console.log(`[TEST API] 구글 시트 조회: 시트=${sheetName}, 범위=${range}`);
      
      // 캐시를 무시하고 항상 최신 데이터를 가져오도록 옵션 추가
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        // 최신 데이터를 가져오기 위한 옵션
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
        majorDimension: 'ROWS'
      });
      console.log('[TEST API] 구글 시트 API 호출 성공!');
      
      // 데이터 추출
      const rows = response.data.values || [];
      console.log(`[TEST API] 구글 시트 응답 받음: ${rows.length}개 행 데이터`);
      
      // 기간(period) 파라미터가 있는 경우 로그 추가
      if (period) {
        console.log(`[TEST API] 기간 필터링: '${period}'`);
      }
      
      if (rows.length > 0) {
        // 헤더 행 추출 (첫 번째 행)
        const headers = rows[0] || [];
        console.log('[TEST API] 헤더 정보:', headers);
        
        // 데이터 행 변환 (객체 형태로)
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          const rowData = {};
          headers.forEach((header, index) => {
            if (index < row.length) {
              rowData[header] = row[index] || '';
            } else {
              rowData[header] = '';
            }
          });
          
          // 데이터 유효성 검사 - 필수 필드가 있는지 확인
          if (rowData.id || rowData.name || rowData.title) {
            sheetData.push(rowData);
          }
        }
      }
      
      // 기간(period) 파라미터에 따라 데이터 필터링
      if (period && sheetData.length > 0) {
        console.log(`[TEST API] '${period}' 기간으로 데이터 필터링 전: ${sheetData.length}개 항목`);
        
        const filteredData = sheetData.filter(item => {
          // 정확한 카테고리 구분을 위한 필터링 로직 개선
          // 1. 매월 점검 지표
          if (period === '매월') {
            return (item.period === '매월' || item.category === '매월') && 
                   item.category !== '연중' && item.period !== '연중';
          }
          // 2. 연중 점검 지표
          else if (period === '연중') {
            return (item.period === '연중' || item.category === '연중');
          }
          // 3. 반기 점검 지표
          else if (period === '반기') {
            return (item.period === '반기' || item.category === '반기');
          }
          // 4. 1~3월 점검 지표
          else if (period === '1~3월') {
            return (item.period === '1~3월' || item.category === '1~3월');
          }
          // 5. 기타 기간은 기존 로직 유지
          else {
            return (item.period === period || item.category === period);
          }
        });
        
        console.log(`[TEST API] '${period}' 기간으로 데이터 필터링 후: ${filteredData.length}개 항목`);
        sheetData = filteredData;
      }
    } catch (dataError) {
      console.error('[TEST API] 시트 데이터 가져오기 실패:', dataError.message);
      return res.status(500).json({
        status: 'error',
        message: `시트 데이터 가져오기 실패: ${dataError.message}`,
        error: dataError.toString()
      });
    }
    
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
    console.error('[TEST API] 구글 시트 테스트 중 오류 발생:', error);
    return res.status(500).json({
      status: 'error',
      message: `구글 시트 테스트 중 오류 발생: ${error.message}`,
      error: error.toString()
    });
  }
});

module.exports = router;

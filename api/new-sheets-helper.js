// Google Sheets API 연동 헬퍼
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// 환경 변수 설정
const USE_SERVICE_ACCOUNT = process.env.USE_SERVICE_ACCOUNT === 'true';
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';
const SERVICE_ACCOUNT_KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || path.join(__dirname, '..', 'service-account.json');

/**
 * 서비스 계정 키 가져오기
 * @returns {Object} 서비스 계정 키 JSON
 */
function getServiceAccountFromEnv() {
  try {
    // 파일에서 서비스 계정 키 로드
    if (fs.existsSync(SERVICE_ACCOUNT_KEY_PATH)) {
      console.log(`[sheets-helper] 서비스 계정 키 파일 로드: ${SERVICE_ACCOUNT_KEY_PATH}`);
      return require(SERVICE_ACCOUNT_KEY_PATH);
    }
    
    // 환경 변수에서 서비스 계정 키 로드
    if (process.env.SERVICE_ACCOUNT_KEY) {
      console.log('[sheets-helper] 환경 변수에서 서비스 계정 키 로드');
      return JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
    }
    
    console.error('[sheets-helper] 서비스 계정 키를 찾을 수 없습니다.');
    return null;
  } catch (error) {
    console.error('[sheets-helper] 서비스 계정 키 로드 오류:', error);
    return null;
  }
}

/**
 * Google API 인증 클라이언트 가져오기
 * @returns {Promise<Object>} 인증된 클라이언트
 */
async function getAuthClient() {
  try {
    // 서비스 계정 사용 설정인 경우
    if (USE_SERVICE_ACCOUNT) {
      const serviceAccountKey = getServiceAccountFromEnv();
      
      if (!serviceAccountKey) {
        throw new Error('서비스 계정 키를 찾을 수 없습니다.');
      }
      
      // JWT 클라이언트 생성
      const jwtClient = new google.auth.JWT(
        serviceAccountKey.client_email,
        null,
        serviceAccountKey.private_key,
        ['https://www.googleapis.com/auth/spreadsheets']
      );
      
      // 인증
      await jwtClient.authorize();
      console.log('[sheets-helper] 서비스 계정으로 인증 성공');
      return jwtClient;
    } else {
      console.log('[sheets-helper] API 키 사용');
      // API 키만 사용하는 경우 (제한된 접근)
      return { key: process.env.GOOGLE_API_KEY || '' };
    }
  } catch (error) {
    console.error('[sheets-helper] 인증 오류:', error);
    throw error;
  }
}

/**
 * Google Sheets 클라이언트 가져오기
 * @returns {Promise<Object>} 구글 시트 클라이언트
 */
async function getSheetsClient() {
  const authClient = await getAuthClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

/**
 * 시트 데이터 읽기
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} range - 읽을 범위
 * @returns {Promise<Array<Array<string>>>} 시트 데이터
 */
async function readSheetData(spreadsheetId, range) {
  try {
    const authClient = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    
    return response.data.values || [];
  } catch (error) {
    console.error(`[sheets-helper] 시트 데이터 읽기 오류: ${error.message}`);
    throw error;
  }
}

/**
 * 시트 데이터 직접 읽기 (시트 이름만 지정)
 * @param {string} sheetName - 시트 이름(예: '기관_목록')
 * @param {string} range - 읽을 범위 (예: 'A1:Z'), 생략시 전체 시트 데이터
 * @returns {Promise<Array<Array<string>>>} 시트 데이터
 */
async function readSheet(sheetName, range = '') {
  try {
    // 시트 이름 특수문자 처리
    let formattedSheetName = sheetName;
    if (sheetName.includes(' ') || /[^a-zA-Z0-9_]/.test(sheetName)) {
      formattedSheetName = `'${sheetName}'`;
    }
    
    const fullRange = range ? `${formattedSheetName}!${range}` : formattedSheetName;
    console.log(`[sheets-helper] 시트 데이터 읽기 시도: ${fullRange}`);
    
    // 인증 클라이언트 가져오기
    const authClient = await getAuthClient();
    
    // 시트 클라이언트 생성
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    // 시트 데이터 요청
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: fullRange,
    });
    
    const rows = response.data.values || [];
    console.log(`[sheets-helper] 시트 ${sheetName}에서 ${rows.length}개의 행 읽어옴`);
    
    return rows;
  } catch (error) {
    console.error(`[sheets-helper] 시트 ${sheetName} 읽기 오류:`, error.message);
    
    // 기본 데이터 반환
    if (sheetName === '위원별_담당기관') {
      console.log('[sheets-helper] 위원별 담당기관 기본 데이터 사용');
      return getFallbackCommitteeOrgData();
    } else if (sheetName === '기관_목록') {
      console.log('[sheets-helper] 기관 목록 기본 데이터 사용');
      return [
        ['code', 'name', 'region', 'address', 'phone', 'manager', 'notes'],
        ['A48120002', '창원도우누리노인통합재가센터', '창원시', '', '', '', ''],
        ['A48740002', '창녕군새누리노인통합지원센터', '창녕군', '', '', '', '']
      ];
    }
    
    // 다른 시트는 빈 배열 반환
    console.log(`[sheets-helper] ${sheetName} 시트에 대한 기본 데이터 없음, 빈 배열 반환`);
    return [];
  }
}

/**
 * 위원별 담당기관 기본 데이터 반환 (Vercel 배포용)
 * @returns {Array<Array<string>>} 기본 데이터
 */
function getFallbackCommitteeOrgData() {
  return [
    ['위원ID', '위원명', '기관ID', '기관코드', '기관명', '지역', '담당구분', '상태'],
    ['C001', '신용기', 'O001', 'A48170002', '산청한일노인통합복지센터', '경상남도', '주담당', '정상'],
    ['C001', '신용기', 'O002', 'A48820003', '함안노인복지센터', '경상남도', '주담당', '정상'],
    ['C001', '신용기', 'O003', 'A48170003', '진주노인통합지원센터', '경상남도', '주담당', '정상'],
    ['C001', '신용기', 'O004', 'A48240001', '김해시니어클럽', '경상남도', '주담당', '정상'],
    ['C001', '신용기', 'O005', 'A48240002', '창원도우누리노인종합재가센터', '경상남도', '주담당', '정상'],
    ['C001', '신용기', 'O006', 'A48840001', '마산시니어클럽', '경상남도', '주담당', '정상'],
    ['C001', '신용기', 'O007', 'A48840002', '거제노인통합지원센터', '경상남도', '주담당', '정상'],
    ['C001', '신용기', 'O008', 'A48850001', '동진노인종합복지센터', '경상남도', '주담당', '정상'],
    ['C001', '신용기', 'O009', 'A48850002', '생명의전화노인복지센터', '경상남도', '주담당', '정상'],
    ['C001', '신용기', 'O010', 'A48170001', '보현행정노인복지센터', '경상남도', '주담당', '정상'],
    ['C001', '신용기', 'O011', 'B12345678', '부담당 기관1', '경상남도', '부담당', '정상'],
    ['C001', '신용기', 'O012', 'B87654321', '부담당 기관2', '경상남도', '부담당', '정상']
  ];
}

/**
 * 기본 데이터 반환
 * @param {string} dataType - 데이터 유형
 * @returns {Array<Array<string>>} 기본 데이터
 */
function getFallbackData(dataType) {
  if (dataType === 'committeeOrg') {
    return getFallbackCommitteeOrgData();
  }
  return [];
}

/**
 * 시트 데이터 쓰기
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} range - 쓸 범위
 * @param {Array<Array<string>>} values - 쓸 데이터
 * @returns {Promise<Object>} 응답 결과
 */
async function writeSheetData(spreadsheetId, range, values) {
  try {
    const authClient = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values,
      },
    });
    
    return response.data;
  } catch (error) {
    console.error(`[sheets-helper] 시트 데이터 쓰기 오류: ${error.message}`);
    throw error;
  }
}

/**
 * 행 추가하기
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @param {Array<string>} rowData - 행 데이터
 * @returns {Promise<Object>} 응답 결과
 */
async function appendRow(spreadsheetId, sheetName, rowData) {
  try {
    const authClient = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [rowData],
      },
    });
    
    return response.data;
  } catch (error) {
    console.error(`[sheets-helper] 행 추가 오류: ${error.message}`);
    throw error;
  }
}

/**
 * 행 업데이트하기
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @param {number} rowIndex - 행 인덱스
 * @param {Array<string>} rowData - 행 데이터
 * @returns {Promise<Object>} 응답 결과
 */
async function updateRow(spreadsheetId, sheetName, rowIndex, rowData) {
  try {
    const authClient = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    const range = `${sheetName}!A${rowIndex}`;
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [rowData],
      },
    });
    
    return response.data;
  } catch (error) {
    console.error(`[sheets-helper] 행 업데이트 오류: ${error.message}`);
    throw error;
  }
}

/**
 * 행 삭제하기
 * @param {string} sheetName - 시트 이름
 * @param {number} rowIndex - 행 인덱스
 * @returns {Promise<void>}
 */
async function deleteRow(sheetName, rowIndex) {
  try {
    const authClient = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    // 먼저 헤더 데이터를 가져옴
    const headerData = await readSheetData(SPREADSHEET_ID, `${sheetName}!1:1`);
    
    if (!headerData || !headerData[0]) {
      throw new Error(`시트 ${sheetName}의 헤더 데이터를 찾을 수 없습니다.`);
    }
    
    // 빈 행으로 덮어쓰기
    const emptyRow = Array(headerData[0].length).fill('');
    await updateRow(SPREADSHEET_ID, sheetName, rowIndex, emptyRow);
    
    console.log(`[sheets-helper] ${sheetName} 시트의 ${rowIndex}행 삭제 완료`);
  } catch (error) {
    console.error(`[sheets-helper] 행 삭제 오류: ${error.message}`);
    throw error;
  }
}

/**
 * 행 찾기
 * @param {string} spreadsheetId - 스프레드시트 ID
 * @param {string} sheetName - 시트 이름
 * @param {number} columnIndex - 열 인덱스
 * @param {string} value - 찾을 값
 * @returns {Promise<{rowIndex: number, rowData: Array<string>}>} 행 인덱스와 데이터
 */
async function findRow(spreadsheetId, sheetName, columnIndex, value) {
  try {
    // 기본값 설정
    const sheetId = spreadsheetId || SPREADSHEET_ID;
    
    // 시트 데이터 전체 읽기
    const data = await readSheetData(sheetId, `${sheetName}`);
    
    // 찾고자 하는 값과 일치하는 행 찾기
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row && row[columnIndex] === value) {
        return {
          rowIndex: i + 1, // 시트 인덱스는 1부터 시작
          rowData: row
        };
      }
    }
    
    // 찾지 못한 경우
    return {
      rowIndex: -1,
      rowData: null
    };
  } catch (error) {
    console.error(`[sheets-helper] 행 찾기 오류: ${error.message}`);
    throw error;
  }
}

/**
 * 일정 업데이트
 * @param {string} scheduleId - 일정 ID
 * @param {Object} scheduleData - 일정 데이터
 * @returns {Promise<Object>} 업데이트 결과
 */
async function updateSchedule(scheduleId, scheduleData) {
  try {
    // 일정 ID로 기존 행 찾기
    const sheetName = '일정_관리';
    const { rowIndex, rowData } = await findRow(undefined, sheetName, 0, scheduleId);
    
    // 일정 데이터 형식화
    const formattedData = [
      scheduleData.id,
      scheduleData.title,
      scheduleData.start,
      scheduleData.end,
      scheduleData.committeeId || '',
      scheduleData.committeeName || '',
      scheduleData.organizationId || '',
      scheduleData.organizationName || '',
      scheduleData.description || '',
      scheduleData.status || '예정',
      scheduleData.color || '#3788d8'
    ];
    
    // 기존 행이 있으면 업데이트, 없으면 추가
    if (rowIndex > 0) {
      console.log(`[sheets-helper] 기존 일정 업데이트: ${scheduleId}`);
      return await updateRow(SPREADSHEET_ID, sheetName, rowIndex, formattedData);
    } else {
      console.log(`[sheets-helper] 새 일정 추가: ${scheduleId}`);
      return await appendRow(SPREADSHEET_ID, sheetName, formattedData);
    }
  } catch (error) {
    console.error(`[sheets-helper] 일정 업데이트 오류: ${error.message}`);
    throw error;
  }
}

/**
 * 기관 정보 업데이트
 * @param {string} orgCode - 기관 코드
 * @param {Object} orgData - 기관 데이터
 * @returns {Promise<Object>} 업데이트 결과
 */
async function updateOrganization(orgCode, orgData) {
  try {
    // 기관 코드로 기존 행 찾기
    const sheetName = '기관_목록';
    const { rowIndex, rowData } = await findRow(undefined, sheetName, 0, orgCode);
    
    // 기관 데이터 형식화
    const formattedData = [
      orgData.code,
      orgData.name,
      orgData.region || '',
      orgData.address || '',
      orgData.phone || '',
      orgData.manager || '',
      orgData.notes || ''
    ];
    
    // 기존 행이 있으면 업데이트, 없으면 추가
    if (rowIndex > 0) {
      console.log(`[sheets-helper] 기존 기관 업데이트: ${orgCode}`);
      return await updateRow(SPREADSHEET_ID, sheetName, rowIndex, formattedData);
    } else {
      console.log(`[sheets-helper] 새 기관 추가: ${orgCode}`);
      return await appendRow(SPREADSHEET_ID, sheetName, formattedData);
    }
  } catch (error) {
    console.error(`[sheets-helper] 기관 업데이트 오류: ${error.message}`);
    throw error;
  }
}

/**
 * 기관 삭제
 * @param {string} orgCode - 기관 코드
 * @returns {Promise<void>}
 */
async function deleteOrganization(orgCode) {
  try {
    // 기관 코드로 행 찾기
    const sheetName = '기관_목록';
    const { rowIndex } = await findRow(undefined, sheetName, 0, orgCode);
    
    if (rowIndex > 0) {
      // 해당 행 삭제
      await deleteRow(sheetName, rowIndex);
      console.log(`[sheets-helper] 기관 삭제 완료: ${orgCode}`);
    } else {
      throw new Error(`기관 코드 ${orgCode}를 찾을 수 없습니다.`);
    }
  } catch (error) {
    console.error(`[sheets-helper] 기관 삭제 오류: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getAuthClient,
  getSheetsClient,
  readSheetData,
  writeSheetData,
  getFallbackData,
  appendRow,
  updateRow,
  deleteRow,
  findRow,
  updateSchedule,
  updateOrganization,
  deleteOrganization,
  readSheet
};

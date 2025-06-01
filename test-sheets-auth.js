// 구글 시트 API 인증 테스트 스크립트
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// 서비스 계정 설정
const SERVICE_ACCOUNT_KEY_PATH = './service-account.json';
const SPREADSHEET_ID = '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';

async function testAuth() {
  try {
    console.log('구글 시트 API 인증 테스트 시작...');
    console.log(`서비스 계정 키 파일 경로: ${path.resolve(SERVICE_ACCOUNT_KEY_PATH)}`);
    
    // 서비스 계정 키 파일 존재 확인
    const keyFileExists = fs.existsSync(SERVICE_ACCOUNT_KEY_PATH);
    console.log(`서비스 계정 키 파일 존재: ${keyFileExists}`);
    
    if (!keyFileExists) {
      console.error('서비스 계정 키 파일을 찾을 수 없습니다.');
      return;
    }
    
    // 서비스 계정 키 로드
    const keyContent = fs.readFileSync(SERVICE_ACCOUNT_KEY_PATH, 'utf8');
    const keyData = JSON.parse(keyContent);
    console.log('서비스 계정 키 로드 성공');
    console.log(`클라이언트 이메일: ${keyData.client_email}`);
    
    // JWT 클라이언트 생성
    const authClient = new google.auth.JWT(
      keyData.client_email,
      null,
      keyData.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    
    // 인증 테스트
    console.log('인증 시도 중...');
    await authClient.authorize();
    console.log('인증 성공!');
    
    // 시트 클라이언트 생성
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    // 시트 정보 가져오기
    console.log(`스프레드시트 정보 요청 중: ${SPREADSHEET_ID}`);
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    
    console.log('스프레드시트 정보:');
    console.log(`- 제목: ${spreadsheet.data.properties.title}`);
    console.log('- 시트 목록:');
    spreadsheet.data.sheets.forEach(sheet => {
      console.log(`  * ${sheet.properties.title}`);
    });
    
    // 첫 번째 시트의 데이터 읽기 테스트
    const firstSheetName = spreadsheet.data.sheets[0].properties.title;
    console.log(`첫 번째 시트 '${firstSheetName}'에서 데이터 읽기 테스트...`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${firstSheetName}!A1:C10`
    });
    
    const rows = response.data.values || [];
    console.log(`${rows.length}개의 행을 읽었습니다.`);
    
    if (rows.length > 0) {
      console.log('첫 번째 행 데이터:', rows[0]);
    }
    
    console.log('테스트 완료!');
  } catch (error) {
    console.error('테스트 중 오류 발생:', error.message);
    console.error('상세 오류:', error);
  }
}

// 테스트 실행
testAuth();

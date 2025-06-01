const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// 새로 제공된 스프레드시트 ID 사용
const SPREADSHEET_ID = '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'service-account.json');

console.log('서비스 계정 키 파일 경로:', SERVICE_ACCOUNT_KEY_PATH);
console.log('파일 존재 여부:', fs.existsSync(SERVICE_ACCOUNT_KEY_PATH));

try {
  // 서비스 계정 키 파일 읽기
  console.log('서비스 계정 키 파일 읽기 시도...');
  const keyContent = fs.readFileSync(SERVICE_ACCOUNT_KEY_PATH, 'utf8');
  const key = JSON.parse(keyContent);
  console.log('서비스 계정 이메일:', key.client_email);
  
  // JWT 클라이언트 생성
  console.log('JWT 클라이언트 생성 중...');
  const auth = new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  
  // 구글 시트 API 클라이언트 생성
  console.log('구글 시트 API 클라이언트 생성 중...');
  const sheets = google.sheets({ version: 'v4', auth });
  
  // 새 스프레드시트 ID로 시도
  console.log(`\n스프레드시트(ID: ${SPREADSHEET_ID}) 접근 시도 중...`);
  
  // 스프레드시트 정보 얻기
  sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID
  }).then(response => {
    console.log(`스프레드시트 정보 로드 성공!`);
    console.log('제목:', response.data.properties.title);
    console.log('시트 목록:');
    response.data.sheets.forEach(sheet => {
      console.log(`- ${sheet.properties.title}`);
    });
    
    // 첫 번째 시트의 데이터 읽기 시도
    const firstSheet = response.data.sheets[0].properties.title;
    console.log(`첫 번째 시트 '${firstSheet}'의 데이터 읽기 시도...`);
    
    return sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${firstSheet}!A1:E5`, // 첫 번째 시트의 일부 데이터
    });
  }).then(response => {
    console.log('데이터 로드 성공!');
    console.log('결과:', JSON.stringify(response.data.values, null, 2));
  }).catch(err => {
    console.error(`스프레드시트 접근 실패:`, err.message);
    if (err.response && err.response.data && err.response.data.error) {
      console.error('오류 세부 정보:', JSON.stringify(err.response.data.error, null, 2));
    }
  });
} catch (error) {
  console.error('오류 발생:', error);
} 
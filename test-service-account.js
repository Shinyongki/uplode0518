require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

console.log('환경 변수 설정 확인:');
console.log('- SPREADSHEET_ID:', process.env.SPREADSHEET_ID || '설정되지 않음');
console.log('- USE_SERVICE_ACCOUNT:', process.env.USE_SERVICE_ACCOUNT || '설정되지 않음');
console.log('- SERVICE_ACCOUNT_KEY_PATH:', process.env.SERVICE_ACCOUNT_KEY_PATH || '설정되지 않음');

// 서비스 계정 키 경로
const SERVICE_ACCOUNT_KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || path.join(__dirname, 'service-account.json');
// 스프레드시트 ID - 환경 변수에서 로드되지 않을 경우 기본값 사용
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';

console.log('사용할 서비스 계정 키 경로:', SERVICE_ACCOUNT_KEY_PATH);
console.log('사용할 스프레드시트 ID:', SPREADSHEET_ID);

// 서비스 계정 키 파일이 존재하는지 확인
if (!fs.existsSync(SERVICE_ACCOUNT_KEY_PATH)) {
  console.error(`서비스 계정 키 파일이 없습니다: ${SERVICE_ACCOUNT_KEY_PATH}`);
  process.exit(1);
}

// 서비스 계정 키 파일 내용 로드
try {
  const serviceAccountKey = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY_PATH, 'utf8'));
  console.log('\n서비스 계정 정보:');
  console.log('- 프로젝트 ID:', serviceAccountKey.project_id);
  console.log('- 클라이언트 이메일:', serviceAccountKey.client_email);
  console.log('- 비공개 키 ID:', serviceAccountKey.private_key_id);
  console.log('- 비공개 키 유효성:', serviceAccountKey.private_key && serviceAccountKey.private_key.startsWith('-----BEGIN PRIVATE KEY-----') ? '유효함' : '유효하지 않음');
} catch (error) {
  console.error('서비스 계정 키 파일 파싱 오류:', error);
  process.exit(1);
}

// 비공개 키 줄바꿈 문제 해결
function correctPrivateKey(privateKey) {
  console.log('비공개 키 처리 중...');
  console.log('- 원래 키 길이:', privateKey.length);
  console.log('- 줄바꿈 문자(\\n) 포함 여부:', privateKey.includes('\\n'));
  console.log('- 실제 줄바꿈 포함 여부:', privateKey.includes('\n'));
  
  // \n을 실제 줄바꿈으로 변환
  let correctedKey = privateKey.replace(/\\n/g, '\n');
  
  // 만약 키가 "-----BEGIN PRIVATE KEY-----"로 시작하고 실제 줄바꿈이 있는지 확인
  if (correctedKey.startsWith('-----BEGIN PRIVATE KEY-----') && !correctedKey.includes('\n')) {
    console.log('- 키가 올바른 형식이지만 줄바꿈이 없습니다. 줄바꿈 추가 중...');
    // 적절한 위치에 줄바꿈 추가
    correctedKey = correctedKey
      .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
      .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
  }
  
  console.log('- 수정된 키 길이:', correctedKey.length);
  console.log('- 수정된 키에 실제 줄바꿈 포함 여부:', correctedKey.includes('\n'));
  
  return correctedKey;
}

// 구글 시트 API 인증 및 테스트
async function testGoogleSheetsAPI() {
  try {
    console.log('\n구글 시트 API 연결 테스트 시작...');
    
    // 서비스 계정 키 파일 로드
    const serviceAccountKey = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY_PATH, 'utf8'));
    
    // 비공개 키 수정
    const correctedPrivateKey = correctPrivateKey(serviceAccountKey.private_key);
    
    // 서비스 계정 키 정보 비교 로깅
    console.log('\n비공개 키 처리 결과:');
    console.log('- 원래 키 시작 부분:', serviceAccountKey.private_key.substring(0, 40) + '...');
    console.log('- 수정된 키 시작 부분:', correctedPrivateKey.substring(0, 40) + '...');
    
    // 임시 키 파일 생성 (디버깅용)
    const tempKeyPath = path.join(__dirname, 'temp-key.txt');
    fs.writeFileSync(tempKeyPath, correctedPrivateKey);
    console.log(`- 수정된 키를 ${tempKeyPath}에 저장했습니다.`);
    
    // JWT 클라이언트 생성
    const auth = new google.auth.JWT(
      serviceAccountKey.client_email,
      null,
      correctedPrivateKey,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    
    // 구글 시트 API 클라이언트 생성
    const sheets = google.sheets({ version: 'v4', auth });
    
    // 스프레드시트 정보 조회
    console.log(`스프레드시트 정보 조회 시도: ${SPREADSHEET_ID}`);
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    
    console.log('스프레드시트 정보 조회 성공!');
    console.log('- 스프레드시트 제목:', spreadsheetInfo.data.properties.title);
    console.log('- 시트 개수:', spreadsheetInfo.data.sheets.length);
    console.log('- 시트 목록:');
    spreadsheetInfo.data.sheets.forEach((sheet, index) => {
      console.log(`  ${index + 1}. ${sheet.properties.title}`);
    });
    
    // 첫 번째 시트의 데이터 조회
    const firstSheetTitle = spreadsheetInfo.data.sheets[0].properties.title;
    const range = `${firstSheetTitle}!A1:D10`;
    
    console.log(`\n첫 번째 시트 '${firstSheetTitle}' 데이터 조회 시도...`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range
    });
    
    const rows = response.data.values;
    if (rows.length) {
      console.log(`데이터 조회 성공! ${rows.length}개 행 조회됨`);
      console.log('첫 5개 행:');
      rows.slice(0, 5).forEach((row, i) => {
        console.log(`행 ${i + 1}: ${row.join(', ')}`);
      });
    } else {
      console.log('시트에 데이터가 없습니다.');
    }
    
    console.log('\n구글 시트 API 연결 테스트 성공!');
    return true;
  } catch (error) {
    console.error('구글 시트 API 연결 테스트 실패:', error);
    if (error.response) {
      console.error('응답 상태:', error.response.status);
      console.error('응답 메시지:', error.response.statusText);
      console.error('응답 데이터:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

// 테스트 실행
testGoogleSheetsAPI().then(success => {
  if (success) {
    console.log('\n서비스 계정을 통한 구글 시트 API 연결이 정상적으로 작동합니다.');
    process.exit(0);
  } else {
    console.error('\n서비스 계정을 통한 구글 시트 API 연결에 문제가 있습니다. 위 오류 메시지를 확인하세요.');
    process.exit(1);
  }
});

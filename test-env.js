// .env 파일 로드
require('dotenv').config();

console.log('환경 변수 직접 확인:');
console.log('SPREADSHEET_ID:', process.env.SPREADSHEET_ID);

// 환경 변수를 직접 코드에서 설정
process.env.SPREADSHEET_ID = '1AUkJHQl2YvwemFMJNn1c1ZzHyQDvgQMxXOxA3-s4yG4';
console.log('직접 설정 후 SPREADSHEET_ID:', process.env.SPREADSHEET_ID);

// config/googleSheets.js의 로직을 일부 흉내내어 테스트
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// 서비스 계정 사용 여부 및 키 파일 경로 설정
const USE_SERVICE_ACCOUNT = process.env.USE_SERVICE_ACCOUNT === 'true';
const SERVICE_ACCOUNT_KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || path.join(__dirname, 'service-account.json');

console.log('USE_SERVICE_ACCOUNT:', USE_SERVICE_ACCOUNT);
console.log('SERVICE_ACCOUNT_KEY_PATH:', SERVICE_ACCOUNT_KEY_PATH);

// Google Sheets API 연결 테스트
try {
  // 스프레드시트 ID가 설정되었는지 확인
  if (!process.env.SPREADSHEET_ID) {
    console.error('SPREADSHEET_ID가 설정되지 않았습니다.');
    process.exit(1);
  }

  // 서비스 계정 키 파일이 존재하는지 확인
  if (USE_SERVICE_ACCOUNT && !fs.existsSync(SERVICE_ACCOUNT_KEY_PATH)) {
    console.error(`서비스 계정 키 파일이 존재하지 않습니다: ${SERVICE_ACCOUNT_KEY_PATH}`);
    process.exit(1);
  }

  console.log('환경 변수 및 파일 확인 성공!');
} catch (error) {
  console.error('오류 발생:', error);
} 
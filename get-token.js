const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();

// 인증 설정
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// 인증 함수
function authorize() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]
  );

  // 인증 URL 생성
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  
  console.log('다음 URL을 브라우저에서 열어 인증을 진행하세요:');
  console.log(authUrl);
  console.log('\n인증 후 받은 코드를 다음 명령어로 실행하세요:');
  console.log('node save-token.js 여기에_인증_코드_입력');
}

// 실행
authorize(); 
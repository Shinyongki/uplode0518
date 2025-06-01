const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();

// 인증 설정
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

// 인증 코드 저장 함수
async function saveToken(code) {
  try {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const { client_secret, client_id, redirect_uris } = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]
    );

    // 인증 코드로 토큰 발급
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    
    // 파일에 토큰 저장
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    console.log('토큰이 저장되었습니다:', TOKEN_PATH);
    
    return true;
  } catch (error) {
    console.error('토큰 저장 중 오류 발생:', error);
    return false;
  }
}

// 커맨드 라인 인자에서 인증 코드 가져오기
const authCode = process.argv[2];
if (!authCode) {
  console.error('인증 코드를 입력해주세요: node save-token.js YOUR_AUTH_CODE');
  process.exit(1);
}

// 인증 코드로 토큰 저장
saveToken(authCode); 
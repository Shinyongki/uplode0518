const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { readFromSheet, writeToSheet, appendToSheet } = require('../services/googleSheets');

// 하드코딩된 스프레드시트 ID (환경변수 로드 실패 시 사용)
const DEFAULT_SPREADSHEET_ID = '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';

// Google API 인증 설정
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');
const TOKEN_PATH = path.join(__dirname, '..', 'token.json');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// 환경변수로 서비스 계정 사용 여부 및 키 파일 경로 설정
const USE_SERVICE_ACCOUNT = true; // 강제로 서비스 계정 사용
const SERVICE_ACCOUNT_KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || path.join(__dirname, '..', 'service-account.json');
const SERVICE_ACCOUNT_PRIVATE_KEY = process.env.SERVICE_ACCOUNT_PRIVATE_KEY;
const SERVICE_ACCOUNT_CLIENT_EMAIL = process.env.SERVICE_ACCOUNT_CLIENT_EMAIL;

// OAuth2 클라이언트 생성
const getAuthClient = () => {
  try {
    if (USE_SERVICE_ACCOUNT) {
      // 환경 변수에서 서비스 계정 정보를 사용하는 경우
      if (SERVICE_ACCOUNT_PRIVATE_KEY && SERVICE_ACCOUNT_CLIENT_EMAIL) {
        console.log('환경 변수에서 서비스 계정 정보 사용');
        
        // 비공개 키에서 \n을 실제 줄바꿈으로 변환 (Vercel 환경변수 이슈 대응)
        const privateKey = SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n');
        
        console.log(`Client Email: ${SERVICE_ACCOUNT_CLIENT_EMAIL}`);
        console.log(`Private Key 유효성: ${privateKey.includes('BEGIN PRIVATE KEY') ? '유효' : '유효하지 않음'}`);
        
        return new google.auth.JWT(
          SERVICE_ACCOUNT_CLIENT_EMAIL,
          null,
          privateKey,
          SCOPES
        );
      } 
      // 파일에서 서비스 계정 정보를 읽는 경우
      else {
        console.log(`서비스 계정 키 파일 경로: ${SERVICE_ACCOUNT_KEY_PATH}`);
        
        if (!fs.existsSync(SERVICE_ACCOUNT_KEY_PATH)) {
          throw new Error(`서비스 계정 키 파일이 존재하지 않습니다: ${SERVICE_ACCOUNT_KEY_PATH}`);
        }
        
        try {
          const keyFileContent = fs.readFileSync(SERVICE_ACCOUNT_KEY_PATH, 'utf8');
          const key = JSON.parse(keyFileContent);
          
          if (!key.client_email || !key.private_key) {
            throw new Error('서비스 계정 키 파일에 필수 정보(client_email, private_key)가 누락되었습니다');
          }
          
          console.log(`서비스 계정 이메일: ${key.client_email}`);
          console.log(`비공개 키 유효성: ${key.private_key.includes('BEGIN PRIVATE KEY') ? '유효' : '유효하지 않음'}`);
          
          return new google.auth.JWT(
            key.client_email,
            null,
            key.private_key,
            SCOPES
          );
        } catch (parseError) {
          console.error(`서비스 계정 키 파일 파싱 오류: ${parseError.message}`);
          throw new Error(`서비스 계정 키 파일 파싱 실패: ${parseError.message}`);
        }
      }
    }
    
    // try 블록에서 여기까지 왔다면 OAuth2 인증 방식을 사용
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]
    );
    // 저장된 토큰이 있으면 세팅
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      oAuth2Client.setCredentials(token);
    }
    return oAuth2Client;
  } catch (error) {
    console.error('인증 클라이언트 생성 오류:', error);
    console.error('오류 상세 정보:', JSON.stringify(error) || '상세 정보 없음');
    if (error.stack) {
      console.error('스택 트레이스:', error.stack);
    }
    throw new Error(`인증 클라이언트 생성 실패: ${error.message || '알 수 없는 오류'}`);
  }
};

// 구글 시트 인스턴스 생성
const getSheets = () => {
  const auth = getAuthClient();
  return google.sheets({ version: 'v4', auth });
};

// 인증 URL 생성
const getAuthUrl = () => {
  const oAuth2Client = getAuthClient();
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
};

// 인증 토큰 저장
const saveToken = async (code) => {
  const oAuth2Client = getAuthClient();
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    return true;
  } catch (error) {
    console.error('Error while trying to retrieve access token', error);
    return false;
  }
};

// 구글 시트 데이터 읽기
const readSheetData = async (spreadsheetId, range) => {
  try {
    // 스프레드시트 ID가 없으면 기본값 사용
    const sheetId = spreadsheetId || process.env.SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
    
    console.log(`구글 시트 데이터 읽기 시작: ${sheetId}, 범위: ${range}`);
    
    if (!sheetId) {
      throw new Error('SPREADSHEET_ID가 정의되지 않았습니다');
    }
    
    if (!range) {
      throw new Error('시트 범위(range)가 지정되지 않았습니다');
    }
    
    const result = await readFromSheet(sheetId, range);
    console.log(`구글 시트 데이터 읽기 성공: ${result ? result.length : 0}개 행`);
    return result;
  } catch (error) {
    console.error(`구글 시트 데이터 읽기 실패: ${error.message || '알 수 없는 오류'}`);
    console.error(`오류 상세 정보: ${JSON.stringify(error) || '상세 정보 없음'}`);
    if (error.stack) {
      console.error(`스택 트레이스: ${error.stack}`);
    }
    // 에러를 다시 throw하지만, 내용이 있는 에러 객체를 반환
    throw error.message ? error : new Error('구글 시트 데이터 읽기 실패');
  }
};

// 구글 시트 데이터 쓰기
const writeSheetData = async (spreadsheetId, range, values) => {
  try {
    // 스프레드시트 ID가 없으면 기본값 사용
    const sheetId = spreadsheetId || process.env.SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
    
    if (!sheetId) {
      throw new Error('SPREADSHEET_ID가 정의되지 않았습니다');
    }
    
    if (!range) {
      throw new Error('시트 범위(range)가 지정되지 않았습니다');
    }
    
    if (!values || !Array.isArray(values) || values.length === 0) {
      throw new Error('유효한 데이터(values)가 제공되지 않았습니다');
    }
    
    console.log(`구글 시트 데이터 쓰기 시작: ${sheetId}, 범위: ${range}, 데이터 행: ${values.length}개`);
    const result = await writeToSheet(sheetId, range, values);
    console.log(`구글 시트 데이터 쓰기 성공`);
    return result;
  } catch (error) {
    console.error(`구글 시트 데이터 쓰기 실패: ${error.message || '알 수 없는 오류'}`);
    console.error(`오류 상세 정보: ${JSON.stringify(error) || '상세 정보 없음'}`);
    if (error.stack) {
      console.error(`스택 트레이스: ${error.stack}`);
    }
    // 에러를 다시 throw하지만, 내용이 있는 에러 객체를 반환
    throw error.message ? error : new Error('구글 시트 데이터 쓰기 실패');
  }
};

// 구글 시트 데이터 추가
const appendSheetData = async (spreadsheetId, range, values) => {
  try {
    // 스프레드시트 ID가 없으면 기본값 사용
    const sheetId = spreadsheetId || process.env.SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
    
    if (!sheetId) {
      throw new Error('SPREADSHEET_ID가 정의되지 않았습니다');
    }
    
    if (!range) {
      throw new Error('시트 범위(range)가 지정되지 않았습니다');
    }
    
    if (!values || !Array.isArray(values) || values.length === 0) {
      throw new Error('유효한 데이터(values)가 제공되지 않았습니다');
    }
    
    console.log(`구글 시트 데이터 추가 시작: ${sheetId}, 범위: ${range}, 데이터 행: ${values.length}개`);
    const result = await appendToSheet(sheetId, range, values);
    console.log(`구글 시트 데이터 추가 성공`);
    return result;
  } catch (error) {
    console.error(`구글 시트 데이터 추가 실패: ${error.message || '알 수 없는 오류'}`);
    console.error(`오류 상세 정보: ${JSON.stringify(error) || '상세 정보 없음'}`);
    if (error.stack) {
      console.error(`스택 트레이스: ${error.stack}`);
    }
    // 에러를 다시 throw하지만, 내용이 있는 에러 객체를 반환
    throw error.message ? error : new Error('구글 시트 데이터 추가 실패');
  }
};

// 스프레드시트의 모든 시트 이름 목록 조회
const listAllSheets = async (spreadsheetId) => {
  try {
    console.log(`스프레드시트 시트 목록 조회 시작: ${spreadsheetId}`);
    const sheets = getSheets();
    const response = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId
    });
    
    if (response.data && response.data.sheets) {
      const sheetNames = response.data.sheets.map(sheet => sheet.properties.title);
      console.log(`시트 목록 조회 성공: ${sheetNames.length}개 시트 발견`);
      return sheetNames;
    }
    
    console.log('시트 정보가 없습니다.');
    return [];
  } catch (error) {
    console.error(`시트 목록 조회 실패: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    throw error;
  }
};

module.exports = {
  getAuthUrl,
  saveToken,
  readSheetData,
  writeSheetData,
  appendSheetData,
  getSheets,
  getAuthClient,
  listAllSheets
}; 
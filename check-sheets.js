require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// 서비스 계정 설정
const USE_SERVICE_ACCOUNT = process.env.USE_SERVICE_ACCOUNT === 'true';
const SERVICE_ACCOUNT_KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || './service-account.json';
const TOKEN_PATH = 'token.json';
const CREDENTIALS_PATH = 'credentials.json';
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

async function main() {
  try {
    console.log('구글 시트 확인 시작');
    console.log('서비스 계정 사용:', USE_SERVICE_ACCOUNT ? '예' : '아니오');
    
    let auth;
    
    if (USE_SERVICE_ACCOUNT) {
      console.log('서비스 계정 키 파일:', fs.existsSync(SERVICE_ACCOUNT_KEY_PATH) ? '있음' : '없음');
      
      // 서비스 계정 키 파일로 JWT 클라이언트 생성
      const keyFile = path.resolve(SERVICE_ACCOUNT_KEY_PATH);
      console.log('서비스 계정 키 파일 경로:', keyFile);
      
      const key = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
      console.log('서비스 계정 이메일:', key.client_email);
      
      auth = new google.auth.JWT(
        key.client_email,
        null,
        key.private_key,
        ['https://www.googleapis.com/auth/spreadsheets']
      );
    } else {
      console.log('자격 증명 파일:', fs.existsSync(CREDENTIALS_PATH) ? '있음' : '없음');
      console.log('토큰 파일:', fs.existsSync(TOKEN_PATH) ? '있음' : '없음');
      
      // 인증 클라이언트 생성
      const content = fs.readFileSync(CREDENTIALS_PATH);
      const credentials = JSON.parse(content);
      const { client_secret, client_id, redirect_uris } = credentials.web;
      auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
      
      if (fs.existsSync(TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
        auth.setCredentials(token);
      } else {
        throw new Error('토큰 파일이 없습니다. 먼저 인증을 진행해주세요.');
      }
    }
    
    // 구글 시트 API 초기화
    const sheets = google.sheets({ version: 'v4', auth });
    
    // 시트 정보 가져오기
    console.log('스프레드시트 ID:', SPREADSHEET_ID);
    const spreadsheetInfo = await sheets.spreadsheets.get({ 
      spreadsheetId: SPREADSHEET_ID 
    });
    
    console.log('시트 목록:');
    const sheetTitles = spreadsheetInfo.data.sheets.map(s => s.properties.title);
    sheetTitles.forEach(title => console.log(`- ${title}`));
    
    // committees 시트가 있는지 확인
    if (sheetTitles.includes('committees')) {
      console.log('\n"committees" 시트 데이터 확인 중...');
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'committees!A:C',
      });
      
      const rows = response.data.values;
      if (rows && rows.length > 0) {
        console.log('헤더:', rows[0]);
        console.log(`총 ${rows.length - 1}명의 위원 데이터 있음`);
        console.log('데이터 샘플:');
        rows.slice(1, 4).forEach((row, i) => {
          console.log(`  ${i+1}. ${row.join(', ')}`);
        });
      } else {
        console.log('데이터가 없습니다.');
        
        // committees 시트에 데이터가 없으면 테스트 데이터 추가
        console.log('\n테스트용 데이터 추가 시도...');
        
        console.log('테스트 데이터 추가 중...');
        // 테스트 데이터 추가
        const testData = [
          ['이름', 'ID', '역할'],
          ['신용기', 'C001', 'committee'],
          ['문일지', 'C002', 'committee'],
          ['김수연', 'C003', 'committee'],
          ['이연숙', 'C004', 'committee'],
          ['이정혜', 'C005', 'committee']
        ];
        
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: 'committees!A1:C9',
          valueInputOption: 'RAW',
          resource: {
            values: testData,
          },
        });
        
        console.log('테스트 데이터 추가 완료');
      }

      // 위원별 담당 기관 시트도 검사
      if (sheetTitles.includes('committee_orgs')) {
        console.log('\n"committee_orgs" 시트 데이터 확인 중...');
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'committee_orgs!A:D',
        });
        
        const rows = response.data.values;
        if (rows && rows.length > 0) {
          console.log('헤더:', rows[0]);
          console.log(`총 ${rows.length - 1}개의 기관-위원 매칭 데이터 있음`);
          console.log('데이터 샘플:');
          rows.slice(1, 4).forEach((row, i) => {
            console.log(`  ${i+1}. ${row.join(', ')}`);
          });
        } else {
          console.log('데이터가 없습니다.');
        }
      } else {
        console.log('\n"committee_orgs" 시트가 없습니다. 시트를 생성하고 위원-기관 매칭 데이터를 추가해야 합니다.');
        
        // 위원별 담당기관 정보 추가
        console.log('\n테스트용 "committee_orgs" 시트 생성 시도...');
        // 새 시트 추가
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              addSheet: {
                properties: {
                  title: 'committee_orgs'
                }
              }
            }]
          }
        });
        
        console.log('담당 기관 데이터 추가 중...');
        // 테스트 데이터 추가
        const orgData = [
          ['기관코드', '기관명', '주담당', '부담당'],
          ['A48120001', '동진노인종합복지센터', '신용기', '김수연,이연숙'],
          ['A48120002', '창원도우누리노인복지센터', '신용기', '김수연'],
          ['A48120003', '마산시니어클럽', '문일지', '신용기'],
          ['A48120004', '김해시니어클럽', '김수연', '이정혜'],
          ['A48120005', '생명의전화노인복지센터', '이정혜', '문일지'],
          ['A48120006', '보현행정노인복지센터', '이연숙', '이정혜']
        ];
        
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: 'committee_orgs!A1:D7',
          valueInputOption: 'RAW',
          resource: {
            values: orgData,
          },
        });
        
        console.log('담당 기관 데이터 추가 완료');
      }
    } else {
      console.log('토큰 파일이 없습니다. 먼저 인증을 진행해주세요.');
    }
  } catch (error) {
    console.error('오류 발생:', error.message);
    console.error(error.stack);
  }
}

main(); 
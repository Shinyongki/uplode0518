require('dotenv').config();
const { readSheetData } = require('./config/googleSheets');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

async function getCommitteesList() {
  try {
    console.log('스프레드시트 ID:', SPREADSHEET_ID);
    
    // 위원 목록 시트에서 데이터 조회
    const values = await readSheetData(SPREADSHEET_ID, '위원별_담당기관!A:G');
    
    if (!values || values.length <= 1) {
      console.log('위원 정보를 찾을 수 없습니다.');
      return;
    }
    
    // 헤더 행 출력
    console.log('헤더:', values[0].join(', '));
    
    // 위원 데이터 출력 (헤더 행 제외)
    console.log('\n== 위원 목록 ==');
    
    // 고유한 위원 정보만 추출
    const committees = new Map();
    values.slice(1).forEach(row => {
      if (row[0] && row[1]) {  // 위원ID와 위원명이 있는 경우만
        committees.set(row[0], row[1]);
      }
    });
    
    // 고유한 위원 목록 출력
    let index = 1;
    for (const [id, name] of committees.entries()) {
      console.log(`${index++}. ${id} | ${name}`);
    }
    
  } catch (error) {
    console.error('오류 발생:', error);
  }
}

getCommitteesList(); 
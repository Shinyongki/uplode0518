require('dotenv').config();
const { readSheetData } = require('./config/googleSheets');

async function testSheetConnection() {
  try {
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
    
    console.log('스프레드시트 ID:', SPREADSHEET_ID);
    console.log('시트에서 데이터 읽기 시도 중...');
    
    const values = await readSheetData(SPREADSHEET_ID, '지표_목록!A:O');
    
    console.log('데이터 가져오기 결과:');
    console.log('- 행 수:', values ? values.length : 0);
    
    if (values && values.length > 0) {
      console.log('- 헤더:', values[0]);
      
      if (values.length > 1) {
        console.log('- 첫 번째 데이터:', values[1]);
      }
    } else {
      console.error('데이터가 없거나 시트가 비어 있습니다.');
    }
  } catch (error) {
    console.error('오류 발생:', error);
  }
}

testSheetConnection(); 
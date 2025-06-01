const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const router = express.Router();

// 구글 시트 인증 설정
const getAuth = () => {
  try {
    return new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, '../../service-account.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  } catch (error) {
    console.error('Google Auth 초기화 오류:', error);
    throw error;
  }
};

// 구글 시트 ID
const SPREADSHEET_ID = '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';

// 시트 데이터 읽기 함수
async function readSheetData(sheetName, range) {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${range}`,
    });
    
    return response.data.values;
  } catch (error) {
    console.error(`시트 데이터 읽기 오류 (${sheetName}):`, error);
    throw error;
  }
}

// 시트 데이터 쓰기 함수
async function writeSheetData(sheetName, range, values) {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${range}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: values,
      },
    });
    
    return response.data;
  } catch (error) {
    console.error(`시트 데이터 쓰기 오류 (${sheetName}):`, error);
    throw error;
  }
}

// 시트 데이터 추가 함수
async function appendSheetData(sheetName, values) {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: values,
      },
    });
    
    return response.data;
  } catch (error) {
    console.error(`시트 데이터 추가 오류 (${sheetName}):`, error);
    throw error;
  }
}

// 방문일정 데이터 가져오기
router.get('/schedules', async (req, res) => {
  try {
    const data = await readSheetData('방문일정', 'A1:I');
    
    if (!data || data.length === 0) {
      return res.status(404).json({ error: '데이터가 없습니다.' });
    }
    
    // 헤더 추출
    const headers = data[0];
    
    // 데이터 변환
    const schedules = data.slice(1).map(row => {
      const schedule = {};
      headers.forEach((header, index) => {
        if (index < row.length) {
          schedule[header] = row[index];
        } else {
          schedule[header] = '';
        }
      });
      
      // 필요한 필드 추가
      schedule.id = schedule.위원ID + '_' + schedule.기관코드 + '_' + schedule.방문일자.replace(/-/g, '');
      schedule.date = schedule.방문일자;
      schedule.committeeName = schedule.위원명;
      schedule.organizationName = schedule.기관명;
      schedule.orgCode = schedule.기관코드;
      schedule.startTime = schedule.방문시간;
      schedule.endTime = ''; // 종료 시간이 없으면 빈 문자열
      schedule.status = schedule.상태 || 'pending';
      schedule.notes = schedule.메모 || '';
      
      return schedule;
    });
    
    res.json({
      status: 'success',
      schedules: schedules
    });
  } catch (error) {
    console.error('방문일정 데이터 조회 실패:', error);
    res.status(500).json({
      status: 'error',
      message: '방문일정 데이터를 가져오는데 실패했습니다.',
      error: error.message
    });
  }
});

// 방문일정 데이터 저장하기
router.post('/schedules', async (req, res) => {
  try {
    const { schedules } = req.body;
    
    if (!schedules || !Array.isArray(schedules)) {
      return res.status(400).json({
        status: 'error',
        message: '유효한 일정 데이터가 필요합니다.'
      });
    }
    
    // 기존 데이터 가져오기
    const existingData = await readSheetData('방문일정', 'A1:I');
    const headers = existingData[0];
    
    // 기존 데이터를 Map으로 변환 (위원ID + 기관코드 + 방문일자 조합을 키로 사용)
    const existingSchedules = new Map();
    existingData.slice(1).forEach(row => {
      const key = `${row[0]}_${row[2]}_${row[4].replace(/-/g, '')}`;
      existingSchedules.set(key, row);
    });
    
    // 업데이트할 행과 추가할 행 분리
    const rowsToUpdate = [];
    const rowsToAppend = [];
    
    schedules.forEach(schedule => {
      // 구글 시트에 저장할 형식으로 변환
      const rowData = [
        schedule.위원ID || schedule.committeeId || '',
        schedule.위원명 || schedule.committeeName || '',
        schedule.기관코드 || schedule.orgCode || '',
        schedule.기관명 || schedule.organizationName || '',
        schedule.방문일자 || schedule.date || '',
        schedule.방문시간 || schedule.startTime || '',
        schedule.목적 || schedule.purpose || '',
        schedule.메모 || schedule.notes || '',
        schedule.상태 || schedule.status || 'pending'
      ];
      
      // 키 생성
      const key = `${rowData[0]}_${rowData[2]}_${rowData[4].replace(/-/g, '')}`;
      
      if (existingSchedules.has(key)) {
        // 기존 데이터가 있으면 업데이트
        const rowIndex = existingData.findIndex(row => 
          row[0] === rowData[0] && 
          row[2] === rowData[2] && 
          row[4] === rowData[4]
        );
        
        if (rowIndex > 0) { // 헤더(인덱스 0)는 제외
          rowsToUpdate.push({
            range: `방문일정!A${rowIndex + 1}:I${rowIndex + 1}`,
            values: [rowData]
          });
        }
      } else {
        // 새 데이터 추가
        rowsToAppend.push(rowData);
      }
    });
    
    // 업데이트 처리
    const updatePromises = rowsToUpdate.map(update => 
      writeSheetData('방문일정', update.range, update.values)
    );
    
    // 일괄 업데이트 실행
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }
    
    // 새 데이터 추가
    if (rowsToAppend.length > 0) {
      await appendSheetData('방문일정', rowsToAppend);
    }
    
    res.json({
      status: 'success',
      message: '일정 데이터가 성공적으로 저장되었습니다.',
      updated: rowsToUpdate.length,
      added: rowsToAppend.length
    });
  } catch (error) {
    console.error('방문일정 데이터 저장 실패:', error);
    res.status(500).json({
      status: 'error',
      message: '방문일정 데이터를 저장하는데 실패했습니다.',
      error: error.message
    });
  }
});

// 단일 일정 업데이트
router.put('/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const scheduleData = req.body;
    
    if (!scheduleData) {
      return res.status(400).json({
        status: 'error',
        message: '유효한 일정 데이터가 필요합니다.'
      });
    }
    
    // ID 분해 (위원ID_기관코드_날짜)
    const idParts = id.split('_');
    if (idParts.length !== 3) {
      return res.status(400).json({
        status: 'error',
        message: '유효하지 않은 일정 ID입니다.'
      });
    }
    
    const committeeId = idParts[0];
    const orgCode = idParts[1];
    
    // 날짜 형식 변환 (YYYYMMDD -> YYYY-MM-DD)
    const dateStr = idParts[2];
    const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    
    // 기존 데이터 가져오기
    const existingData = await readSheetData('방문일정', 'A1:I');
    
    // 업데이트할 행 찾기
    const rowIndex = existingData.findIndex(row => 
      row[0] === committeeId && 
      row[2] === orgCode && 
      row[4] === formattedDate
    );
    
    if (rowIndex <= 0) { // 헤더(인덱스 0)는 제외, 데이터가 없으면 오류
      return res.status(404).json({
        status: 'error',
        message: '업데이트할 일정을 찾을 수 없습니다.'
      });
    }
    
    // 업데이트할 데이터 준비
    const rowData = [
      scheduleData.위원ID || scheduleData.committeeId || committeeId,
      scheduleData.위원명 || scheduleData.committeeName || existingData[rowIndex][1],
      scheduleData.기관코드 || scheduleData.orgCode || orgCode,
      scheduleData.기관명 || scheduleData.organizationName || existingData[rowIndex][3],
      scheduleData.방문일자 || scheduleData.date || formattedDate,
      scheduleData.방문시간 || scheduleData.startTime || existingData[rowIndex][5],
      scheduleData.목적 || scheduleData.purpose || existingData[rowIndex][6],
      scheduleData.메모 || scheduleData.notes || existingData[rowIndex][7],
      scheduleData.상태 || scheduleData.status || existingData[rowIndex][8] || 'pending'
    ];
    
    // 데이터 업데이트
    await writeSheetData('방문일정', `A${rowIndex + 1}:I${rowIndex + 1}`, [rowData]);
    
    res.json({
      status: 'success',
      message: '일정이 성공적으로 업데이트되었습니다.',
      schedule: {
        id: id,
        committeeId: rowData[0],
        committeeName: rowData[1],
        orgCode: rowData[2],
        organizationName: rowData[3],
        date: rowData[4],
        startTime: rowData[5],
        purpose: rowData[6],
        notes: rowData[7],
        status: rowData[8]
      }
    });
  } catch (error) {
    console.error('일정 업데이트 실패:', error);
    res.status(500).json({
      status: 'error',
      message: '일정을 업데이트하는데 실패했습니다.',
      error: error.message
    });
  }
});

// 단일 일정 삭제 (실제로는 상태를 'canceled'로 변경)
router.delete('/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // ID 분해 (위원ID_기관코드_날짜)
    const idParts = id.split('_');
    if (idParts.length !== 3) {
      return res.status(400).json({
        status: 'error',
        message: '유효하지 않은 일정 ID입니다.'
      });
    }
    
    const committeeId = idParts[0];
    const orgCode = idParts[1];
    
    // 날짜 형식 변환 (YYYYMMDD -> YYYY-MM-DD)
    const dateStr = idParts[2];
    const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    
    // 기존 데이터 가져오기
    const existingData = await readSheetData('방문일정', 'A1:I');
    
    // 삭제할 행 찾기
    const rowIndex = existingData.findIndex(row => 
      row[0] === committeeId && 
      row[2] === orgCode && 
      row[4] === formattedDate
    );
    
    if (rowIndex <= 0) { // 헤더(인덱스 0)는 제외, 데이터가 없으면 오류
      return res.status(404).json({
        status: 'error',
        message: '삭제할 일정을 찾을 수 없습니다.'
      });
    }
    
    // 상태를 'canceled'로 변경
    const rowData = [...existingData[rowIndex]];
    rowData[8] = 'canceled';
    
    // 데이터 업데이트
    await writeSheetData('방문일정', `A${rowIndex + 1}:I${rowIndex + 1}`, [rowData]);
    
    res.json({
      status: 'success',
      message: '일정이 성공적으로 취소되었습니다.'
    });
  } catch (error) {
    console.error('일정 삭제 실패:', error);
    res.status(500).json({
      status: 'error',
      message: '일정을 삭제하는데 실패했습니다.',
      error: error.message
    });
  }
});

module.exports = router;

// 구글 시트 일정 관리 API
const express = require('express');
const router = express.Router();
const sheetsHelper = require('./sheets-helper');

// 스프레드시트 ID 설정
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';

// 일정 데이터 가져오기
router.get('/', async (req, res) => {
  try {
    // 방문일정 시트에서 데이터 가져오기
    const sheetName = '방문일정';
    const data = await sheetsHelper.readSheet(sheetName);
    
    if (!data || data.length === 0) {
      return res.status(200).json({
        status: 'success',
        schedules: []
      });
    }
    
    // 헤더 행 가져오기 (첫 번째 행)
    const headers = data[0];
    
    // 데이터 행 처리 (헤더 제외)
    const schedules = data.slice(1).map(row => {
      const schedule = {};
      
      // 각 열을 헤더와 매핑하여 객체 생성
      headers.forEach((header, index) => {
        if (row[index] !== undefined) {
          schedule[header] = row[index];
        } else {
          schedule[header] = '';
        }
      });
      
      return schedule;
    });
    
    return res.status(200).json({
      status: 'success',
      schedules
    });
  } catch (error) {
    console.error('구글 시트에서 일정 데이터 가져오기 오류:', error);
    return res.status(500).json({
      status: 'error',
      message: '구글 시트에서 일정 데이터를 가져오는 중 오류가 발생했습니다.'
    });
  }
});

// 일정 데이터 저장하기
router.post('/', async (req, res) => {
  try {
    const { sheetName, schedules } = req.body;
    
    if (!sheetName || !schedules || !Array.isArray(schedules)) {
      return res.status(400).json({
        status: 'error',
        message: '유효하지 않은 요청 형식입니다.'
      });
    }
    
    console.log(`구글 시트 '${sheetName}'에 ${schedules.length}개의 일정 데이터 저장 시도`);
    
    // 기존 시트 데이터 가져오기
    const existingData = await sheetsHelper.readSheet(sheetName);
    
    if (!existingData || existingData.length === 0) {
      // 시트가 비어있는 경우, 헤더 행 생성
      const headers = ['위원ID', '위원명', '기관코드', '기관명', '방문일자', '방문시간', '목적', '메모', '상태'];
      await sheetsHelper.writeSheetData(SPREADSHEET_ID, `${sheetName}!A1:I1`, [headers]);
      
      // 데이터 행 추가
      const values = schedules.map(schedule => [
        schedule.위원ID || '',
        schedule.위원명 || '',
        schedule.기관코드 || '',
        schedule.기관명 || '',
        schedule.방문일자 || '',
        schedule.방문시간 || '',
        schedule.목적 || '',
        schedule.메모 || '',
        schedule.상태 || 'pending'
      ]);
      
      if (values.length > 0) {
        await sheetsHelper.writeSheetData(SPREADSHEET_ID, `${sheetName}!A2:I${values.length + 1}`, values);
      }
    } else {
      // 시트에 이미 데이터가 있는 경우
      const headers = existingData[0];
      
      // 기존 데이터 삭제 (헤더 제외)
      if (existingData.length > 1) {
        // 기존 데이터 범위 계산
        const lastRow = existingData.length;
        await sheetsHelper.writeSheetData(SPREADSHEET_ID, `${sheetName}!A2:${String.fromCharCode(65 + headers.length - 1)}${lastRow}`, 
          Array(lastRow - 1).fill(Array(headers.length).fill('')));
      }
      
      // 새 데이터 추가
      const values = schedules.map(schedule => [
        schedule.위원ID || '',
        schedule.위원명 || '',
        schedule.기관코드 || '',
        schedule.기관명 || '',
        schedule.방문일자 || '',
        schedule.방문시간 || '',
        schedule.목적 || '',
        schedule.메모 || '',
        schedule.상태 || 'pending'
      ]);
      
      if (values.length > 0) {
        await sheetsHelper.writeSheetData(SPREADSHEET_ID, `${sheetName}!A2:I${values.length + 1}`, values);
      }
    }
    
    return res.status(200).json({
      status: 'success',
      message: '일정 데이터가 구글 시트에 성공적으로 저장되었습니다.'
    });
  } catch (error) {
    console.error('구글 시트에 일정 데이터 저장 오류:', error);
    return res.status(500).json({
      status: 'error',
      message: '구글 시트에 일정 데이터를 저장하는 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;

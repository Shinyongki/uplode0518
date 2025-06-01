const { readSheetData, writeSheetData } = require('../config/googleSheets');
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// 일정 관리를 위한 시트 범위
const SCHEDULES_RANGE = '일정_관리!A:I'; // ID, 위원ID, 위원명, 기관코드, 기관명, 방문일자, 시작시간, 종료시간, 메모

/**
 * 모든 일정 가져오기
 */
const getAllSchedules = async () => {
  try {
    const values = await readSheetData(SPREADSHEET_ID, SCHEDULES_RANGE);
    
    if (!values || values.length === 0) {
      console.log('일정 목록이 비어 있습니다.');
      return [];
    }
    
    // 첫 번째 행은 헤더로 간주
    const headers = values[0];
    console.log('일정 헤더:', headers);
    
    const schedules = values.slice(1).map(row => {
      const schedule = {};
      headers.forEach((header, index) => {
        if (row[index] !== undefined) {
          schedule[header] = row[index];
        } else {
          schedule[header] = '';
        }
      });
      return schedule;
    });
    
    console.log(`총 ${schedules.length}개 일정 로드됨`);
    return schedules;
  } catch (error) {
    console.error('Error fetching schedules:', error);
    throw error;
  }
};

/**
 * 특정 위원의 일정 가져오기
 */
const getSchedulesByCommitteeId = async (committeeId) => {
  try {
    const schedules = await getAllSchedules();
    return schedules.filter(schedule => schedule.committeeId === committeeId || schedule.위원ID === committeeId);
  } catch (error) {
    console.error(`Error fetching schedules for committee ${committeeId}:`, error);
    throw error;
  }
};

/**
 * 특정 기관의 일정 가져오기
 */
const getSchedulesByOrgCode = async (orgCode) => {
  try {
    const schedules = await getAllSchedules();
    return schedules.filter(schedule => schedule.orgCode === orgCode || schedule.기관코드 === orgCode);
  } catch (error) {
    console.error(`Error fetching schedules for organization ${orgCode}:`, error);
    throw error;
  }
};

/**
 * 특정 날짜 범위의 일정 가져오기
 */
const getSchedulesByDateRange = async (startDate, endDate) => {
  try {
    const schedules = await getAllSchedules();
    return schedules.filter(schedule => {
      const visitDate = new Date(schedule.visitDate || schedule.방문일자);
      return visitDate >= new Date(startDate) && visitDate <= new Date(endDate);
    });
  } catch (error) {
    console.error(`Error fetching schedules for date range:`, error);
    throw error;
  }
};

/**
 * 새 일정 추가
 */
const addSchedule = async (scheduleData) => {
  try {
    // 위원 이름이 '모니터링위원N' 형식인 경우 실제 이름으로 변환
    if (scheduleData.committeeName && scheduleData.committeeName.startsWith('모니터링위원')) {
      const committeeNameMap = {
        '모니터링위원1': '신용기',
        '모니터링위원2': '김수연',
        '모니터링위원3': '문일지',
        '모니터링위원4': '이연숙',
        '모니터링위원5': '이정혜'
      };

      if (committeeNameMap[scheduleData.committeeName]) {
        console.log(`위원 이름 변환: ${scheduleData.committeeName} -> ${committeeNameMap[scheduleData.committeeName]}`);
        scheduleData.committeeName = committeeNameMap[scheduleData.committeeName];
      }
    }

    // 1단계: 모든 일정 데이터 가져오기
    const values = await readSheetData(SPREADSHEET_ID, SCHEDULES_RANGE);
    
    if (!values || values.length === 0) {
      console.log('일정 목록이 비어 있습니다. 새 헤더를 생성합니다.');
      const newHeaders = ['id', 'committeeId', 'committeeName', 'orgCode', 'orgName', 'visitDate', 'startTime', 'endTime', 'notes'];
      await writeSheetData(SPREADSHEET_ID, SCHEDULES_RANGE, [newHeaders]);
      
      // 새 ID 생성
      scheduleData.id = 'S001';
      
      // 새 일정 추가
      const newRow = [
        scheduleData.id,
        scheduleData.committeeId,
        scheduleData.committeeName,
        scheduleData.orgCode,
        scheduleData.orgName,
        scheduleData.visitDate,
        scheduleData.startTime,
        scheduleData.endTime,
        scheduleData.notes || ''
      ];
      
      await writeSheetData(SPREADSHEET_ID, '일정_관리!A2:I2', [newRow]);
      return scheduleData;
    }
    
    // 2단계: 헤더 및 데이터 처리
    const headers = values[0];
    const schedules = values.slice(1);
    
    // 3단계: 새 ID 생성
    let maxId = 0;
    schedules.forEach(row => {
      const idIndex = headers.indexOf('id') !== -1 ? headers.indexOf('id') : headers.indexOf('ID');
      if (idIndex !== -1) {
        const id = row[idIndex];
        if (id && id.startsWith('S')) {
          const idNum = parseInt(id.substring(1));
          if (!isNaN(idNum) && idNum > maxId) {
            maxId = idNum;
          }
        }
      }
    });
    
    scheduleData.id = `S${String(maxId + 1).padStart(3, '0')}`;
    
    // 4단계: 새 일정 추가
    const newRow = [];
    headers.forEach(header => {
      const key = header.toLowerCase();
      if (key === 'id') {
        newRow.push(scheduleData.id);
      } else if (key === 'committeeid' || key === '위원id') {
        newRow.push(scheduleData.committeeId);
      } else if (key === 'committeename' || key === '위원명') {
        newRow.push(scheduleData.committeeName);
      } else if (key === 'orgcode' || key === '기관코드') {
        newRow.push(scheduleData.orgCode);
      } else if (key === 'orgname' || key === '기관명') {
        newRow.push(scheduleData.orgName);
      } else if (key === 'visitdate' || key === '방문일자') {
        newRow.push(scheduleData.visitDate);
      } else if (key === 'starttime' || key === '시작시간') {
        newRow.push(scheduleData.startTime);
      } else if (key === 'endtime' || key === '종료시간') {
        newRow.push(scheduleData.endTime);
      } else if (key === 'notes' || key === '메모') {
        newRow.push(scheduleData.notes || '');
      } else {
        newRow.push('');
      }
    });
    
    // 5단계: 데이터 추가
    const newRowIndex = schedules.length + 2; // 헤더(1) + 기존 데이터 개수 + 1
    const range = `일정_관리!A${newRowIndex}:${String.fromCharCode(65 + headers.length - 1)}${newRowIndex}`;
    await writeSheetData(SPREADSHEET_ID, range, [newRow]);
    
    return scheduleData;
  } catch (error) {
    console.error('Error adding schedule:', error);
    throw error;
  }
};

/**
 * 일정 업데이트
 */
const updateSchedule = async (scheduleId, updateData) => {
  try {
    // 위원 이름이 '모니터링위원N' 형식인 경우 실제 이름으로 변환
    if (updateData.committeeName && updateData.committeeName.startsWith('모니터링위원')) {
      const committeeNameMap = {
        '모니터링위원1': '신용기',
        '모니터링위원2': '김수연',
        '모니터링위원3': '문일지',
        '모니터링위원4': '이연숙',
        '모니터링위원5': '이정혜'
      };

      if (committeeNameMap[updateData.committeeName]) {
        console.log(`위원 이름 변환: ${updateData.committeeName} -> ${committeeNameMap[updateData.committeeName]}`);
        updateData.committeeName = committeeNameMap[updateData.committeeName];
      }
    }

    // 1단계: 모든 일정 데이터 가져오기
    const values = await readSheetData(SPREADSHEET_ID, SCHEDULES_RANGE);
    
    if (!values || values.length === 0) {
      console.log('일정 목록이 비어 있습니다.');
      return null;
    }
    
    // 2단계: 헤더 및 데이터 처리
    const headers = values[0];
    const schedules = values.slice(1);
    
    // 3단계: 대상 일정 찾기
    const idIndex = headers.indexOf('id') !== -1 ? headers.indexOf('id') : headers.indexOf('ID');
    const scheduleIndex = schedules.findIndex(row => row[idIndex] === scheduleId);
    
    if (scheduleIndex === -1) {
      console.log(`일정 ID ${scheduleId}를 찾을 수 없습니다.`);
      return null;
    }
    
    // 4단계: 업데이트 데이터 적용
    const updatedRow = [...schedules[scheduleIndex]];
    
    Object.keys(updateData).forEach(key => {
      let keyIndex = -1;
      
      // 키 이름 변환 (camelCase -> 한글 또는 그대로)
      if (key === 'committeeId') {
        keyIndex = headers.indexOf('committeeId') !== -1 ? headers.indexOf('committeeId') : headers.indexOf('위원ID');
      } else if (key === 'committeeName') {
        keyIndex = headers.indexOf('committeeName') !== -1 ? headers.indexOf('committeeName') : headers.indexOf('위원명');
      } else if (key === 'orgCode') {
        keyIndex = headers.indexOf('orgCode') !== -1 ? headers.indexOf('orgCode') : headers.indexOf('기관코드');
      } else if (key === 'orgName') {
        keyIndex = headers.indexOf('orgName') !== -1 ? headers.indexOf('orgName') : headers.indexOf('기관명');
      } else if (key === 'visitDate') {
        keyIndex = headers.indexOf('visitDate') !== -1 ? headers.indexOf('visitDate') : headers.indexOf('방문일자');
      } else if (key === 'startTime') {
        keyIndex = headers.indexOf('startTime') !== -1 ? headers.indexOf('startTime') : headers.indexOf('시작시간');
      } else if (key === 'endTime') {
        keyIndex = headers.indexOf('endTime') !== -1 ? headers.indexOf('endTime') : headers.indexOf('종료시간');
      } else if (key === 'notes') {
        keyIndex = headers.indexOf('notes') !== -1 ? headers.indexOf('notes') : headers.indexOf('메모');
      } else {
        keyIndex = headers.indexOf(key);
      }
      
      if (keyIndex !== -1) {
        updatedRow[keyIndex] = updateData[key];
      }
    });
    
    // 5단계: 데이터 업데이트
    schedules[scheduleIndex] = updatedRow;
    
    // 6단계: 전체 데이터 다시 쓰기
    const updatedValues = [headers, ...schedules];
    const fullRange = `일정_관리!A1:${String.fromCharCode(65 + headers.length - 1)}${updatedValues.length}`;
    await writeSheetData(SPREADSHEET_ID, fullRange, updatedValues);
    
    // 7단계: 업데이트된 일정 객체 반환
    const updatedSchedule = {};
    headers.forEach((header, index) => {
      updatedSchedule[header] = updatedRow[index] || '';
    });
    
    return updatedSchedule;
  } catch (error) {
    console.error(`Error updating schedule ${scheduleId}:`, error);
    throw error;
  }
};

/**
 * 일정 삭제
 */
const deleteSchedule = async (scheduleId) => {
  try {
    // 1단계: 모든 일정 데이터 가져오기
    const values = await readSheetData(SPREADSHEET_ID, SCHEDULES_RANGE);
    
    if (!values || values.length === 0) {
      console.log('일정 목록이 비어 있습니다.');
      return false;
    }
    
    // 2단계: 헤더 및 데이터 처리
    const headers = values[0];
    const schedules = values.slice(1);
    
    // 3단계: 대상 일정 찾기
    const idIndex = headers.indexOf('id') !== -1 ? headers.indexOf('id') : headers.indexOf('ID');
    const scheduleIndex = schedules.findIndex(row => row[idIndex] === scheduleId);
    
    if (scheduleIndex === -1) {
      console.log(`일정 ID ${scheduleId}를 찾을 수 없습니다.`);
      return false;
    }
    
    // 4단계: 일정 삭제
    schedules.splice(scheduleIndex, 1);
    
    // 5단계: 전체 데이터 다시 쓰기
    const updatedValues = [headers, ...schedules];
    const fullRange = `일정_관리!A1:${String.fromCharCode(65 + headers.length - 1)}${updatedValues.length}`;
    await writeSheetData(SPREADSHEET_ID, fullRange, updatedValues);
    
    return true;
  } catch (error) {
    console.error(`Error deleting schedule ${scheduleId}:`, error);
    throw error;
  }
};

module.exports = {
  getAllSchedules,
  getSchedulesByCommitteeId,
  getSchedulesByOrgCode,
  getSchedulesByDateRange,
  addSchedule,
  updateSchedule,
  deleteSchedule
};

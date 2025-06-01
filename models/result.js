const { readSheetData, writeSheetData, appendSheetData, getSheets } = require('../config/googleSheets');
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// 모니터링 결과를 저장하기 위한 통합 시트 범위 (헤더 확장)
const RESULTS_RANGE = '모니터링_결과_통합!B2:K'; // B열부터 시작하도록 수정

// 마스터 모니터링 시트가 존재하는지 확인하고 없으면 생성
const checkAndCreateMasterSheet = async () => {
  try {
    console.log('마스터_모니터링 시트 확인 중...');
    const sheets = getSheets();
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    
    if (response.data && response.data.sheets) {
      const sheetNames = response.data.sheets.map(sheet => sheet.properties.title);
      const hasMasterSheet = sheetNames.includes('마스터_모니터링');
      
      if (!hasMasterSheet) {
        console.log('마스터_모니터링 시트가 없습니다. 새로 생성합니다.');
        
        // 새 시트 추가
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              addSheet: {
                properties: {
                  title: '마스터_모니터링'
                }
              }
            }]
          }
        });
        
        // 헤더 추가
        const masterHeaders = [
          '기관ID', '기관코드', '기관명', '지표ID', '결과', '의견', 
          '평가월', '평가일자', 'category', '지역', '담당위원'
        ];
        
        await appendSheetData(SPREADSHEET_ID, '마스터_모니터링!A:K', [masterHeaders]);
        console.log('마스터_모니터링 시트가 생성되고 헤더가 추가되었습니다.');
        return true;
      } else {
        console.log('마스터_모니터링 시트가 이미 존재합니다.');
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('마스터_모니터링 시트 확인/생성 중 오류:', error);
    return false;
  }
};

// 모니터링 결과 저장
const saveMonitoringResult = async (resultData) => {
  try {
    console.log('모니터링 결과 저장 시작:', JSON.stringify(resultData));
    
    // 마스터 시트 확인 및 생성
    await checkAndCreateMasterSheet();
    
    const { 
      기관ID, 
      기관코드, 
      기관명, 
      지표ID, 
      결과,
      의견,
      평가월,
      평가일자,
      category,  // 추가 필드
      지역,      // 추가 필드
      위원명,
      isUpdate   // 수정 모드 여부
    } = resultData;
    
    // 이것이 수정 요청인지 확인 (컨트롤러에서 전달)
    const shouldUpdate = isUpdate === true;
    console.log(`${shouldUpdate ? '수정' : '추가'} 모드로 처리합니다.`);
    
    // 수정: 수정 모드에서도 원래 지표ID를 그대로 사용
    // const displayIndicatorId = shouldUpdate ? `수정_${지표ID}` : 지표ID;
    const displayIndicatorId = 지표ID; // 항상 원래 지표ID 사용
    
    // 저장할 데이터 행 (헤더 구조에 맞춤)
    // | 기관ID | 기관코드 | 기관명 | 지표ID | 결과 | 의견 | 평가월 | 평가일자 | category | 지역 |
    const rowData = [
      기관ID || '',
      기관코드 || '',
      기관명 || '',
      displayIndicatorId || '', // 수정된 부분: 항상 원래 지표ID 사용
      결과 || '',
      의견 || '',
      평가월 || '',
      평가일자 || new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }).replace(/\//g, '-').replace(',', ''), // 한국 시간으로 저장 (24시간 형식)
      category || '',  // 추가 필드
      지역 || ''       // 추가 필드
    ];
    
    console.log('저장할 데이터 행:', rowData);

    // 다른 접근법: 전체 데이터를 가져와서 수정 후 전체를 다시 쓰기
    // 이 방식은 훨씬 더 안정적이지만 데이터가 많으면 비효율적입니다
    // 하지만 현재 상황에서는 가장 확실한 방법입니다

    // 1단계: 전체 데이터 가져오기
    const allData = await readSheetData(SPREADSHEET_ID, RESULTS_RANGE);
    if (!allData || allData.length === 0) {
      console.log('기존 데이터가 없습니다. 새 데이터를 추가합니다.');
      const appendResult = await appendSheetData(SPREADSHEET_ID, RESULTS_RANGE, [rowData]);
      console.log('통합 시트 추가 결과:', appendResult);
      
      // 위원별 전용 시트에도 동일한 데이터 추가 (위원명이 있는 경우)
      if(위원명) {
        const committeeSheetRange = `${위원명}_모니터링!B:K`;
        const committeeResult = await appendSheetData(SPREADSHEET_ID, committeeSheetRange, [rowData]);
        console.log('위원별 시트 추가 결과:', committeeResult);
      }
      
      // 마스터_모니터링 시트에도 동일한 데이터 추가
      try {
        const masterSheetRange = '마스터_모니터링!A:K';
        // 담당위원 정보를 포함한 데이터 행 생성
        const masterRowData = [...rowData];
        // 담당위원 정보 추가 (마지막 열)
        masterRowData.push(위원명 || '');
        
        const masterResult = await appendSheetData(SPREADSHEET_ID, masterSheetRange, [masterRowData]);
        console.log('마스터 모니터링 시트 추가 결과:', masterResult);
      } catch (masterError) {
        console.error('마스터 모니터링 시트 데이터 추가 중 오류:', masterError);
        // 마스터 시트 오류가 전체 프로세스를 중단하지 않도록 함
      }
      
      return { success: true, message: '모니터링 결과가 성공적으로 저장되었습니다.' };
    }

    // 헤더 정보 저장
    const headers = allData[0];
    const 기관코드Index = headers.indexOf('기관코드');
    const 지표IDIndex = headers.indexOf('지표ID');
    const 평가월Index = headers.indexOf('평가월');
    const 위원명Index = headers.findIndex(header => header.includes('위원') || header.includes('담당자'));
    
    // 2단계: 중복 데이터 확인 및 처리
    let hasDuplicate = false;
    let mainSheetModified = false;
    
    // 기존 데이터에서 중복 제거
    const filteredData = [headers];
    
    for (let i = 1; i < allData.length; i++) {
      const row = allData[i];
      
      // 빈 행은 건너뛰기
      if (!row || row.every(cell => !cell)) {
        continue;
      }
      
      // 수정: 항상 '수정_' 접두사를 제거하고 비교
      const rowIndicatorId = (row[지표IDIndex] || '').replace(/^수정_/, '');
      const currentIndicatorId = displayIndicatorId.replace(/^수정_/, '');
      
      // 중복 확인 (기관코드, 지표ID, 평가월이 모두 일치하는 경우)
      if (row[기관코드Index] === 기관코드 && 
          rowIndicatorId === currentIndicatorId && 
          row[평가월Index] === 평가월) {
        // 중복 발견 - 이 행은 제외
        hasDuplicate = true;
        console.log(`중복 데이터 발견 및 제거: ${i}번째 행, 지표ID(${rowIndicatorId})`);
        continue;
      }
      
      // 중복이 아닌 행은 유지
      filteredData.push(row);
    }
    
    // 새 데이터 추가
    filteredData.push(rowData);
    
    // 3단계: 전체 데이터 다시 쓰기
    console.log(`전체 데이터 다시 쓰기 (총 ${filteredData.length}행, 헤더 포함)`);
    const fullRange = `모니터링_결과_통합!B1:K${filteredData.length}`; // B열부터 시작하도록 수정
    const writeResult = await writeSheetData(SPREADSHEET_ID, fullRange, filteredData);
    console.log('전체 데이터 덮어쓰기 완료:', writeResult);
    mainSheetModified = true;
    
    let committeeSheetModified = false;
    
    if (위원명) {
      const committeeSheetRange = `${위원명}_모니터링!B:K`; // A:J에서 B:K로 수정
      const committeeData = await readSheetData(SPREADSHEET_ID, committeeSheetRange);
      
      if (committeeData && committeeData.length > 0) {
        // 위원별 시트 헤더 정보
        const committeeHeaders = committeeData[0];
        const 기관코드CommIndex = committeeHeaders.indexOf('기관코드');
        const 지표IDCommIndex = committeeHeaders.indexOf('지표ID');
        const 평가월CommIndex = committeeHeaders.indexOf('평가월');
        
        // 중복 데이터 제거 및 새 데이터 추가
        const filteredCommitteeData = [committeeHeaders]; // 헤더 유지
        let hasCommitteeDuplicate = false;
        
        for (let i = 1; i < committeeData.length; i++) {
          const row = committeeData[i];
          
          // 빈 행은 건너뛰기
          if (!row || row.every(cell => !cell)) {
            continue;
          }
          
          // 수정: 항상 '수정_' 접두사를 제거하고 비교
          const rowIndicatorId = (row[지표IDCommIndex] || '').replace(/^수정_/, '');
          const currentIndicatorId = displayIndicatorId.replace(/^수정_/, '');
          
          // 중복 확인
          if (row[기관코드CommIndex] === 기관코드 && 
              rowIndicatorId === currentIndicatorId && 
              row[평가월CommIndex] === 평가월) {
            // 중복 발견 - 이 행은 제외
            hasCommitteeDuplicate = true;
            console.log(`위원 시트 중복 데이터 발견 및 제거: ${i}번째 행, 지표ID(${rowIndicatorId})`);
            continue;
          }
          
          // 중복이 아닌 행은 유지
          filteredCommitteeData.push(row);
        }
        
        // 새 데이터 추가
        filteredCommitteeData.push(rowData);
        
        // 전체 데이터 다시 쓰기
        console.log(`위원 시트 전체 데이터 다시 쓰기 (총 ${filteredCommitteeData.length}행, 헤더 포함)`);
        // 전체 범위 지정 (B1부터 시작)
        const fullCommitteeRange = `${위원명}_모니터링!B1:K${filteredCommitteeData.length}`;
        const committeeWriteResult = await writeSheetData(SPREADSHEET_ID, fullCommitteeRange, filteredCommitteeData);
        console.log('위원 시트 전체 데이터 덮어쓰기 완료:', committeeWriteResult);
        committeeSheetModified = true;
      } else {
        // 위원별 시트가 없거나 비어있는 경우 새로 생성
        console.log('위원별 시트 생성 (헤더 + 신규 데이터)');
        const committeeSheetRange = `${위원명}_모니터링!B:K`; // 범위 수정
        await appendSheetData(SPREADSHEET_ID, committeeSheetRange, [headers, rowData]);
        committeeSheetModified = true;
      }
    }
    
    // 마스터_모니터링 시트 업데이트
    let masterSheetModified = false;
    try {
      const masterSheetRange = '마스터_모니터링!A:K';
      const masterData = await readSheetData(SPREADSHEET_ID, masterSheetRange);
      
      if (masterData && masterData.length > 0) {
        // 마스터 시트 헤더 정보
        const masterHeaders = masterData[0];
        const 기관코드MasterIndex = masterHeaders.indexOf('기관코드');
        const 지표IDMasterIndex = masterHeaders.indexOf('지표ID');
        const 평가월MasterIndex = masterHeaders.indexOf('평가월');
        
        // 중복 데이터 제거 및 새 데이터 추가
        const filteredMasterData = [masterHeaders]; // 헤더 유지
        let hasMasterDuplicate = false;
        
        for (let i = 1; i < masterData.length; i++) {
          const row = masterData[i];
          
          // 빈 행은 건너뛰기
          if (!row || row.every(cell => !cell)) {
            continue;
          }
          
          // 중복 확인
          const rowIndicatorId = (row[지표IDMasterIndex] || '').replace(/^수정_/, '');
          const currentIndicatorId = displayIndicatorId.replace(/^수정_/, '');
          
          if (row[기관코드MasterIndex] === 기관코드 && 
              rowIndicatorId === currentIndicatorId && 
              row[평가월MasterIndex] === 평가월) {
            // 중복 발견 - 이 행은 제외
            hasMasterDuplicate = true;
            console.log(`마스터 시트 중복 데이터 발견 및 제거: ${i}번째 행, 지표ID(${rowIndicatorId})`);
            continue;
          }
          
          // 중복이 아닌 행은 유지
          filteredMasterData.push(row);
        }
        
        // 담당위원 정보를 포함한 데이터 행 생성
        const masterRowData = [...rowData];
        // 담당위원 정보 추가 (마지막 열)
        masterRowData.push(위원명 || '');
        
        // 새 데이터 추가
        filteredMasterData.push(masterRowData);
        
        // 전체 데이터 다시 쓰기
        console.log(`마스터 시트 전체 데이터 다시 쓰기 (총 ${filteredMasterData.length}행, 헤더 포함)`);
        const fullMasterRange = `마스터_모니터링!A1:K${filteredMasterData.length}`;
        const masterWriteResult = await writeSheetData(SPREADSHEET_ID, fullMasterRange, filteredMasterData);
        console.log('마스터 시트 전체 데이터 덮어쓰기 완료:', masterWriteResult);
        masterSheetModified = true;
      } else {
        // 마스터 시트가 없거나 비어있는 경우
        console.log('마스터 시트 데이터 없음, 새로 추가');
        const masterHeaders = [
          '기관ID', '기관코드', '기관명', '지표ID', '결과', '의견', 
          '평가월', '평가일자', 'category', '지역', '담당위원'
        ];
        
        // 담당위원 정보를 포함한 데이터 행 생성
        const masterRowData = [...rowData];
        // 담당위원 정보 추가 (마지막 열)
        masterRowData.push(위원명 || '');
        
        await appendSheetData(SPREADSHEET_ID, masterSheetRange, [masterHeaders, masterRowData]);
        masterSheetModified = true;
      }
    } catch (masterError) {
      console.error('마스터 시트 업데이트 중 오류:', masterError);
      // 마스터 시트 오류가 전체 프로세스를 중단하지 않도록 함
    }
    
    // 6단계: 결과 반환
    if (shouldUpdate || hasDuplicate) {
      return { 
        success: true, 
        message: '모니터링 결과가 성공적으로 수정되었습니다.', 
        updateInfo: {
          method: '전체 데이터 덮어쓰기',
          mainSheetModified, 
          committeeSheetModified,
          masterSheetModified,
          hasDuplicate,
          displayId: displayIndicatorId
        }
      };
    } else {
      return { 
        success: true, 
        message: '모니터링 결과가 성공적으로 저장되었습니다.',
        saveInfo: {
          method: '전체 데이터 덮어쓰기',
          mainSheetModified,
          committeeSheetModified,
          masterSheetModified
        }
      };
    }
  } catch (error) {
    console.error('Error saving monitoring result:', error);
    throw error;
  }
};

// 특정 기관의 모니터링 결과 가져오기
const getResultsByOrganization = async (orgCode) => {
  try {
    console.log(`기관 코드(${orgCode})의 결과 조회 시작`);
    
    // 데이터 읽기 전에 시트 존재 여부 확인
    const values = await readSheetData(SPREADSHEET_ID, RESULTS_RANGE);
    console.log('시트 데이터 읽기 완료:', values ? `${values.length}행` : '데이터 없음');
    
    if (!values || values.length === 0) {
      console.log('결과 데이터가 없습니다.');
      return [];
    }
    
    // 고정된 헤더 사용 (시트의 첫 번째 행은 이미 제외됨)
    const headers = ['기관ID', '기관코드', '기관명', '지표ID', '결과', '의견', '평가월', '평가일자', 'category', '지역'];
    
    const allResults = values.map(row => {
      const result = {};
      headers.forEach((header, index) => {
        result[header] = (index < row.length) ? (row[index] || '') : '';
      });
      return result;
    });
    
    console.log(`전체 ${allResults.length}개 결과 중 기관 코드(${orgCode}) 필터링`);
    
    // 해당 기관 코드의 결과만 필터링
    const filteredResults = allResults.filter(result => result.기관코드 === orgCode);
    console.log(`기관 코드(${orgCode})에 대한 결과 ${filteredResults.length}개 찾음`);
    
    // 각 지표와 월별로 가장 최신 결과만 유지
    const latestResults = new Map();
    
    filteredResults.forEach(result => {
      const key = `${result.지표ID}_${result.평가월}`;
      const existingResult = latestResults.get(key);
      
      if (!existingResult || new Date(result.평가일자) > new Date(existingResult.평가일자)) {
        latestResults.set(key, result);
      }
    });
    
    const finalResults = Array.from(latestResults.values());
    console.log(`중복 제거 후 최종 결과 ${finalResults.length}개 반환`);
    
    return finalResults;
  } catch (error) {
    console.error(`Error fetching results for organization ${orgCode}:`, error);
    console.error('Error details:', error.stack);
    throw error;
  }
};

// 특정 위원의 모니터링 결과 가져오기
const getResultsByCommittee = async (committeeName) => {
  try {
    console.log(`위원(${committeeName})의 결과 조회 시작`);
    const sheetRange = `${committeeName}_모니터링!B:K`; // A:J에서 B:K로 수정
    const values = await readSheetData(SPREADSHEET_ID, sheetRange);
    
    if (!values || values.length === 0) {
      console.log(`위원(${committeeName})의 결과 데이터가 없습니다.`);
      return [];
    }
    
    // 첫 번째 행은 헤더로 간주
    let headers = ['기관ID', '기관코드', '기관명', '지표ID', '결과', '의견', '평가월', '평가일자', 'category', '지역'];
    
    // 실제 헤더가 있으면 사용
    if (values.length > 0) {
      const firstRow = values[0];
      // 첫 번째 행이 헤더인지 검증
      if (firstRow.includes('기관ID') || firstRow.includes('기관코드')) {
        headers = firstRow;
        console.log('시트에서 헤더 발견:', headers);
      } else {
        console.log('첫 번째 행이 헤더가 아닌 것으로 판단됨, 기본 헤더 사용');
      }
    }
    
    const results = values.slice(1).map(row => {
      const result = {};
      headers.forEach((header, index) => {
        if (index < row.length) {
          result[header] = row[index];
        } else {
          result[header] = '';
        }
      });
      return result;
    });
    
    // 중복 지표 제거 - 각 지표ID별로 가장 최신 결과만 유지
    const latestResults = [];
    const processedIndicators = new Map(); // 지표ID와 평가월 조합을 키로 사용
    
    // 평가일자 기준으로 정렬 (최신 것이 먼저 오도록)
    const sortedResults = [...results].sort((a, b) => {
      if (a.평가일자 && b.평가일자) {
        return new Date(b.평가일자) - new Date(a.평가일자);
      }
      return 0;
    });
    
    // 각 지표별로 가장 최신 결과만 포함
    for (const result of sortedResults) {
      const indicatorId = result.지표ID.replace(/^수정_/, '');
      const monthKey = result.평가월 || '';
      const compositeKey = `${indicatorId}_${monthKey}`;
      
      if (!processedIndicators.has(compositeKey)) {
        processedIndicators.set(compositeKey, true);
        latestResults.push(result);
      }
    }
    
    console.log(`위원(${committeeName})의 결과 ${latestResults.length}개 찾음`);
    return latestResults;
  } catch (error) {
    console.error(`Error fetching results for committee ${committeeName}:`, error);
    throw error;
  }
};

// 특정 기관과 지표에 대한 모니터링 결과 가져오기
const getResultByOrgAndIndicator = async (orgCode, indicatorId) => {
  try {
    console.log(`기관(${orgCode})의 지표(${indicatorId}) 결과 조회 시작`);
    const orgResults = await getResultsByOrganization(orgCode);
    
    if (!orgResults || orgResults.length === 0) {
      console.log(`기관(${orgCode})의 결과가 없습니다.`);
      return null;
    }
    
    // 수정: 항상 '수정_' 접두사를 제거하고 비교
    const currentIndicatorId = indicatorId.replace(/^수정_/, '');
    
    // 가장 최근 결과를 먼저 찾기 위해 평가일자로 정렬
    const filteredResults = orgResults.filter(result => {
      const resultIndicatorId = result.지표ID.replace(/^수정_/, '');
      return resultIndicatorId === currentIndicatorId;
    });
    
    console.log(`기관(${orgCode})의 지표(${currentIndicatorId}) 결과 ${filteredResults.length}개 찾음`);
    
    if (filteredResults.length === 0) {
      return null;
    }
    
    const sortedResults = [...filteredResults].sort((a, b) => {
      if (a.평가일자 && b.평가일자) {
        return new Date(b.평가일자) - new Date(a.평가일자);
      }
      return 0;
    });
    
    const latestResult = sortedResults[0];
    console.log('최신 결과 데이터:', latestResult);
    
    return latestResult;
  } catch (error) {
    console.error(`Error fetching result for organization ${orgCode} and indicator ${indicatorId}:`, error);
    throw error;
  }
};

// 중복 데이터 정리를 위한 유지보수 기능
const cleanupDuplicateData = async () => {
  try {
    console.log('중복 데이터 정리 작업 시작');
    
    // 1단계: 전체 데이터 가져오기
    const allData = await readSheetData(SPREADSHEET_ID, RESULTS_RANGE);
    if (!allData || allData.length <= 1) {
      console.log('정리할 데이터가 없습니다.');
      return { success: true, message: '정리할 데이터가 없습니다.', cleaned: 0 };
    }
    
    // 헤더 정보 저장
    const headers = allData[0];
    const 기관코드Index = headers.indexOf('기관코드');
    const 지표IDIndex = headers.indexOf('지표ID');
    const 평가월Index = headers.indexOf('평가월');
    const 평가일자Index = headers.indexOf('평가일자');
    const 위원명Index = headers.findIndex(header => header.includes('위원') || header.includes('담당자'));
    
    // 2단계: 데이터를 객체로 변환하여 정리
    const dataMap = new Map(); // 기관코드_지표ID_평가월 조합을 키로 사용
    const filteredData = [headers]; // 헤더는 유지
    let duplicatesRemoved = 0;
    
    // 모든 행 처리
    for (let i = 1; i < allData.length; i++) {
      const row = allData[i];
      
      // 빈 행은 건너뛰기
      if (!row || row.every(cell => !cell)) {
        continue;
      }
      
      const 기관코드 = row[기관코드Index] || '';
      const 지표ID = (row[지표IDIndex] || '').replace(/^수정_/, '');
      const 평가월 = row[평가월Index] || '';
      const 평가일자 = row[평가일자Index] || '';
      const 위원명 = 위원명Index >= 0 ? (row[위원명Index] || '') : '';
      
      // 고유 키 생성
      const key = `${기관코드}_${지표ID}_${평가월}_${위원명}`;
      
      // 이미 처리된 항목이면 평가일자 비교
      if (dataMap.has(key)) {
        const existingRow = dataMap.get(key);
        const existingDate = existingRow[평가일자Index] || '';
        
        // 현재 행의 날짜가 더 최신인 경우 기존 항목 대체
        if (평가일자 && existingDate && new Date(평가일자) > new Date(existingDate)) {
          dataMap.set(key, row);
          duplicatesRemoved++;
          console.log(`중복 데이터 갱신: ${key}, 최신일자: ${평가일자}`);
        } else {
          // 현재 행이 더 오래된 경우 무시
          duplicatesRemoved++;
          console.log(`중복 데이터 무시: ${key}, 기존일자: ${existingDate}`);
        }
      } else {
        // 처음 보는 항목이면 맵에 추가
        dataMap.set(key, row);
      }
    }
    
    // 3단계: 정리된 데이터를 배열로 변환
    for (const row of dataMap.values()) {
      filteredData.push(row);
    }
    
    // 4단계: 전체 데이터를 다시 쓰기
    console.log(`정리된 데이터 다시 쓰기 (총 ${filteredData.length}행, 헤더 포함)`);
    // 전체 범위를 지정하여 덮어쓰기 (B1부터 시작)
    const fullRange = `모니터링_결과_통합!B1:K${filteredData.length}`;
    const writeResult = await writeSheetData(SPREADSHEET_ID, fullRange, filteredData);
    console.log('정리된 데이터 덮어쓰기 완료:', writeResult);
    
    // 5단계: 위원별 시트도 정리
    // 모든 시트 목록을 가져와서 위원별 시트 식별 및 처리
    // 이 부분은 구글 시트 API를 통해 모든 시트 목록을 가져오는 기능이 필요합니다.
    // 지금은 생략하고 향후 필요시 구현할 수 있습니다.
    
    // 결과 반환
    return {
      success: true,
      message: `중복 데이터 정리가 완료되었습니다. ${duplicatesRemoved}개의 중복 항목이 제거되었습니다.`,
      cleaned: duplicatesRemoved,
      totalRows: filteredData.length - 1
    };
  } catch (error) {
    console.error('중복 데이터 정리 중 오류 발생:', error);
    throw error;
  }
};

module.exports = {
  saveMonitoringResult,
  getResultsByOrganization,
  getResultsByCommittee,
  getResultByOrgAndIndicator,
  cleanupDuplicateData,
  checkAndCreateMasterSheet
}; 
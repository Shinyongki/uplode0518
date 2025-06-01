// 지표 API 처리 모듈
const express = require('express');
const { google } = require('googleapis');
const sheetsHelper = require('./sheets-helper');
const cacheManager = require('./cache-manager');

// 캐시 키 설정
const CACHE_KEY_PREFIX = 'indicators';
const CACHE_TTL = 60 * 15; // 15분 캐시

// 지표 컬럼 매핑 (구글 시트 '지표_목록' 시트 기준)
const INDICATOR_COLUMNS = {
  ID: 'id',
  CODE: 'code',
  NAME: 'name',
  CATEGORY: 'category',
  REVIEW_MATERIALS: '점검자료',
  COMMON_REQUIRED: '공통필수',
  COMMON_OPTIONAL: '공통선택',
  EVALUATION_LINKED: '평가연계',
  ONLINE_CHECK: '온라인점검',
  ONSITE_CHECK: '현장점검',
  DESCRIPTION: 'description'
};

/**
 * 지표 API 핸들러
 * @param {Object} req - 요청 객체
 * @param {Object} res - 응답 객체
 */
async function handleIndicatorsRequest(req, res) {
  try {
    // 쿼리 파라미터 추출
    const period = req.query.period; // 매월, 반기, 1~3월 등
    const orgCode = req.query.orgCode; // 기관 코드

    // 필수 파라미터 확인
    if (!period || !orgCode) {
      return res.status(400).json({
        status: 'error',
        message: '필수 파라미터가 누락되었습니다. (period, orgCode)'
      });
    }

    console.log(`[API] 지표 요청: 주기=${period}, 기관코드=${orgCode}`);

    // 캐시 키 생성
    const cacheKey = `${CACHE_KEY_PREFIX}_${period}_${orgCode}`;

    // 캐시 강제 초기화 (개발 테스트용)
    cacheManager.del(cacheKey);
    console.log(`[API] 캐시 초기화: ${cacheKey}`);
    
    // 캐시 사용 완전히 비활성화 - 항상 최신 데이터 가져오기
    // const cachedData = cacheManager.get(cacheKey);
    // if (cachedData) {
    //   console.log(`[API] 캐시된 지표 데이터 반환: ${cacheKey}`);
    //   return res.status(200).json(cachedData);
    // }
    console.log('[API] 캐시 사용 안함 - 항상 구글 시트에서 최신 데이터 가져오기');
    console.log('[API] 구글 시트 연결 강제 시도');

    // 구글 시트에서 지표 데이터 가져오기
    let indicators = [];
    try {
      console.log('[API] 구글 시트에서 지표 데이터 가져오기 시도');
      
      // 구글 시트 연결 시도 - 실제 데이터만 반환
      try {
        indicators = await getIndicatorsFromSheet(period, orgCode);
        console.log('[API] 구글 시트에서 가져온 데이터:', indicators ? indicators.length : 0, '개');
        
        // 데이터가 있는 경우 처리
        if (indicators && indicators.length > 0) {
          console.log('[API] 구글 시트에서 성공적으로 데이터를 가져왔습니다.');
          console.log('[API] 첫 번째 지표 예시:', indicators[0]);
        } else {
          throw new Error('구글 시트에서 가져온 데이터가 없습니다.');
        }
      } catch (sheetError) {
        console.error('[API] 구글 시트 연결 오류:', sheetError.message);
        // 오류를 클라이언트에 전달
        return res.status(500).json({
          status: 'error',
          message: `구글 시트 연결 오류: ${sheetError.message}`,
          error: sheetError.toString(),
          source: 'google-sheets'
        });
      }
    } catch (error) {
      console.error('[API] 구글 시트에서 데이터를 가져오는 중 오류 발생:', error);
      console.log('[API] 오류 상세 정보:', error.message);
      if (error.stack) {
        console.log('[API] 오류 스택:', error.stack);
      }
      // 오류 발생 시 빈 배열 반환
      console.log('[API] 오류 발생으로 인해 빈 배열을 반환합니다.');
      indicators = [];
    }

    // 응답 데이터 구성
    const responseData = {
      status: 'success',
      data: {
        indicators: indicators,
        period: period,
        orgCode: orgCode,
        timestamp: new Date().toISOString()
      }
    };

    // 캐시에 저장
    cacheManager.set(cacheKey, responseData, CACHE_TTL);

    // 응답 반환
    res.status(200).json(responseData);
  } catch (error) {
    console.error('[API] 지표 데이터 조회 중 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '지표 데이터를 가져오는 중 오류가 발생했습니다.',
      error: error.message
    });
  }
}

/**
 * 구글 시트에서 지표 데이터 가져오기
 * @param {string} period - 주기 (매월, 반기, 1~3월 등)
 * @param {string} orgCode - 기관 코드
 * @returns {Promise<Array>} 지표 목록
 */
async function getIndicatorsFromSheet(period, orgCode) {
  try {
    console.log('[API] 구글 시트 연결 시작 - 인증 클라이언트 가져오기');
    console.log('[API] 환경 변수 확인: USE_SERVICE_ACCOUNT =', process.env.USE_SERVICE_ACCOUNT);
    console.log('[API] 환경 변수 확인: SPREADSHEET_ID =', process.env.SPREADSHEET_ID);
    console.log('[API] 환경 변수 확인: SERVICE_ACCOUNT_KEY_PATH =', process.env.SERVICE_ACCOUNT_KEY_PATH);
    
    // 구글 시트 인증 클라이언트 가져오기
    let authClient;
    try {
      authClient = await sheetsHelper.getAuthClient();
      console.log('[API] 인증 클라이언트 가져오기 성공:', authClient ? '성공' : '실패');
      
      if (!authClient) {
        throw new Error('인증 클라이언트가 null입니다.');
      }
    } catch (authError) {
      console.error('[API] 인증 클라이언트 가져오기 실패:', authError);
      throw new Error(`인증 오류: ${authError.message}`);
    }
    
    // 구글 시트 API 클라이언트 생성
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    console.log('[API] 구글 시트 API 클라이언트 생성 성공');
    
    // 스프레드시트 ID 확인
    const spreadsheetId = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';
    if (!spreadsheetId) {
      throw new Error('SPREADSHEET_ID가 정의되지 않았습니다.');
    }
    console.log('[API] 스프레드시트 ID:', spreadsheetId);
    
    // 시트 이름 설정 - 테스트에서 확인된 시트 이름 사용
    const sheetName = 'indicators'; // 구글 시트에 실제 존재하는 시트 이름
    console.log(`[API] 시트 이름 설정: '${sheetName}'`);
    
    // 범위 설정 (A:O는 A열부터 O열까지 모든 데이터)
    const range = `${sheetName}!A:O`;
    
    console.log(`[API] 구글 시트 조회: 시트=${sheetName}, 범위=${range}`);
    
    // 구글 시트 API 호출
    console.log(`[API] 구글 시트 API 호출 시도: spreadsheetId=${spreadsheetId}, range=${range}`);
    
    let response;
    try {
      // 간단한 테스트: 스프레드시트의 모든 시트 목록 가져오기
      console.log('[API] 스프레드시트의 모든 시트 목록 가져오기 시도');
      try {
        const sheetsResponse = await sheets.spreadsheets.get({
          spreadsheetId
        });
        console.log('[API] 스프레드시트 정보 가져오기 성공!');
        console.log('[API] 시트 목록:', sheetsResponse.data.sheets.map(sheet => sheet.properties.title));
        
        // 시트 이름 확인
        const sheetExists = sheetsResponse.data.sheets.some(sheet => sheet.properties.title === sheetName);
        console.log(`[API] '${sheetName}' 시트 존재 여부:`, sheetExists ? '존재함' : '존재하지 않음');
        
        if (!sheetExists) {
          throw new Error(`'${sheetName}' 시트가 존재하지 않습니다.`);
        }
      } catch (sheetsError) {
        console.error('[API] 스프레드시트 정보 가져오기 실패:', sheetsError.message);
      }
      
      // 원래 코드: 시트의 데이터 가져오기
      response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      console.log('[API] 구글 시트 API 호출 성공!');
      console.log('[API] 구글 시트 응답 데이터 구조:', Object.keys(response.data));
      
      // 가져온 데이터 샘플 출력
      if (response.data && response.data.values && response.data.values.length > 0) {
        console.log('[API] 처음 5개 행 출력:');
        for (let i = 0; i < Math.min(5, response.data.values.length); i++) {
          console.log(`[API] 행 ${i}:`, response.data.values[i]);
        }
      } else {
        console.log('[API] 가져온 데이터가 없습니다.');
      }
    } catch(apiError) {
      console.error('[API] 구글 시트 API 호출 실패:', apiError.message);
      if(apiError.errors) {
        console.error('[API] 오류 상세 정보:', JSON.stringify(apiError.errors));
      }
      throw apiError;
    }
    
    // 데이터 추출
    const rows = response.data.values || [];
    console.log(`[API] 구글 시트 응답 받음: ${rows.length}개 행 데이터`);
    if (rows.length > 0) {
      console.log('[API] 첫 번째 행 (헤더):', rows[0]);
      if (rows.length > 1) {
        console.log('[API] 두 번째 행 (첫 번째 데이터):', rows[1]);
      }
    }
    
    // 헤더 행 추출 (첫 번째 행)
    const headers = rows[0] || [];
    
    // 헤더 인덱스 매핑
    const headerIndexMap = {};
    headers.forEach((header, index) => {
      headerIndexMap[header] = index;
    });
    
    console.log('헤더 정보:', headers);
    console.log('헤더 인덱스 매핑:', headerIndexMap);
    
    // 필요한 열 인덱스 확인 (이미지에 보이는 실제 데이터 구조 반영)
    const idIndex = headerIndexMap['id'] || 0;
    const codeIndex = headerIndexMap['code'] || 1;
    const nameIndex = headerIndexMap['name'] || 2;
    const categoryIndex = headerIndexMap['category'] || 3;
    const reviewMaterialsIndex = headerIndexMap['점검자료'] || 4;
    const commonRequiredIndex = headerIndexMap['공통필수'] || 5;
    const commonOptionalIndex = headerIndexMap['공통선택'] || 6;
    const evaluationLinkedIndex = headerIndexMap['평가연계'] || 7;
    const onlineCheckIndex = headerIndexMap['온라인점검'] || 8;
    const onsiteCheckIndex = headerIndexMap['현장점검'] || 9;
    // 상세설명 필드는 '설명' 또는 'description' 컬럼에 있을 수 있음
    const descriptionIndex = headerIndexMap['설명'] || headerIndexMap['description'] || 10;
    
    console.log('실제 description 인덱스:', descriptionIndex);
    console.log('실제 description 헤더 이름:', headers[descriptionIndex]);
    console.log('모든 헤더 이름:', headers.join(', '));
    
    // 지표 데이터 변환
    const indicators = [];
    
    // 주기별 매핑 (카테고리 기준) - 연중 카테고리를 반기 탭에 포함
    const periodMapping = {
      '매월': ['매월'],
      '반기': ['반기', '연중'],  // 연중 카테고리를 반기 탭에 포함
      '1~3월': ['1~3월', '분기']
    };
    
    // 선택된 주기에 해당하는 카테고리 목록
    const targetCategories = periodMapping[period] || [period];
    
    // 첫 번째 행(헤더)을 제외하고 데이터 처리
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // 빈 행 건너뛰기
      if (!row || row.length === 0) continue;
      
      // 지표 ID와 카테고리 확인
      const indicatorId = row[idIndex];
      const indicatorCode = row[codeIndex];
      const indicatorCategory = row[categoryIndex];
      
      // 카테고리가 선택된 주기와 일치하는 지표만 필터링
      if (targetCategories.includes(indicatorCategory)) {
        // 공통필수/공통선택 여부 확인
        const isCommonRequired = row[commonRequiredIndex] === 'O';
        const isCommonOptional = row[commonOptionalIndex] === 'O';
        
        // 평가연계 여부 확인
        const isEvaluationLinked = row[evaluationLinkedIndex] === 'O';
        
        // 점검 방법 확인
        const onlineCheck = row[onlineCheckIndex] || '';
        const onsiteCheck = row[onsiteCheckIndex] || '';
        
        // 점검 유형 결정
        let checkType = '';
        if (onlineCheck === '필수' || onlineCheck === '우선') {
          checkType = '온라인';
        } else if (onsiteCheck === '필수' || onsiteCheck === '우선') {
          checkType = '현장';
        }
        
        // 우선순위 결정
        let priority = '';
        if (onlineCheck === '필수' || onsiteCheck === '필수') {
          priority = '필수';
        } else if (onlineCheck === '우선' || onsiteCheck === '우선') {
          priority = '우선';
        } else if (onlineCheck === '선택' || onsiteCheck === '선택') {
          priority = '선택';
        }
        
        // description 값 확인 및 로그 추가
        const descValue = row[descriptionIndex] || '';
        console.log(`지표 ${indicatorId} description 값:`, descValue);
        
        // 상세설명이 없는 경우 디버깅을 위해 전체 행 데이터 로깅
        if (!descValue) {
          console.log(`지표 ${indicatorId} 행 전체 데이터:`, row);
        }
        
        indicators.push({
          id: indicatorId,
          code: indicatorCode,
          name: row[nameIndex] || `지표 ${indicatorCode}`,
          category: indicatorCategory,
          reviewMaterials: row[reviewMaterialsIndex] || '',
          isCommonRequired,
          isCommonOptional,
          isEvaluationLinked,
          // 한글 필드명 추가 (클라이언트 호환성 유지)
          '공통필수': isCommonRequired ? 'O' : '',
          '공통선택': isCommonOptional ? 'O' : '',
          '평가연계': isEvaluationLinked ? 'O' : '',
          '검토자료': row[reviewMaterialsIndex] || '',
          commonRequired: isCommonRequired ? 'O' : '',
          commonOptional: isCommonOptional ? 'O' : '',
          evaluationLinked: isEvaluationLinked ? 'O' : '',
          onlineCheck,
          onsiteCheck,
          checkType,
          priority,
          description: descValue,
          period: period // 현재 선택된 주기 정보 추가
        });
      }
    }
    
    console.log(`[API] 구글 시트에서 ${indicators.length}개 지표 데이터 추출 완료`);
    
    return indicators;
  } catch (error) {
    console.error('[API] 구글 시트에서 지표 데이터 가져오기 실패:', error);
    console.error('[API] 오류 상세 정보:', error.message);
    if (error.stack) {
      console.error('[API] 오류 스택:', error.stack);
    }
    if (error.response) {
      console.error('[API] 오류 응답 데이터:', error.response.data);
      console.error('[API] 오류 응답 상태:', error.response.status);
    }
    
    // 오류 발생 시 로그만 출력하고 오류 반환
    console.log('[API] 구글 시트 연결 오류 발생:', error.message);
    
    // 오류 반환 - 클라이언트에서 처리하도록 함
    throw error;
  }
}

/**
 * 샘플 지표 데이터 생성 (개발 및 테스트용)
 * @param {string} period - 주기 (매월, 반기, 1~3월 등)
 * @returns {Array} 샘플 지표 목록
 */
function getSampleIndicators(period) {
  console.log(`신용기 위원의 샘플 지표 데이터 생성: 주기=${period}`);
  
  // 주기별 지표 수
  const countMap = {
    '매월': 10,
    '반기': 6,
    '1~3월': 4,
    '연중': 3
  };
  
  const count = countMap[period] || 5;
  const indicators = [];
  
  // 실제 구글 시트 데이터 구조와 클라이언트 기대 구조에 맞는 샘플 데이터
  const sampleData = [
    // 매월 점검 지표 - 이미지에 있는 실제 구글 시트 데이터와 일치하도록 수정
    { 
      id: 'IND-매월-001', 
      code: 'M001', 
      name: '노인복지 소중기관 서비스환경 점검시',
      period: '매월',
      category: '매월',
      characteristic: '정량',
      checkMethod: '현장점검',
      reviewMaterials: '소중기관 서비스환경 점검시 설명',
      description: '소중기관 서비스환경 점검의 목적과 내용',
      commonRequired: 'O',
      commonOptional: '',
      evaluationLinked: 'O',
      onlineCheck: '',
      onsiteCheck: 'O'
    },
    { 
      id: 'IND-매월-002', 
      code: 'M002', 
      name: '종사자 근무환경 점검',
      period: '매월',
      category: '매월',
      characteristic: '정량',
      checkMethod: '현장점검',
      reviewMaterials: '연간사업계획서 상 사업관리, 종사자 근무표',
      description: '종사자 근무 환경 점검',
      commonRequired: 'O',
      commonOptional: '',
      evaluationLinked: '',
      onlineCheck: '',
      onsiteCheck: 'O'
    },
    { 
      id: 'IND-매월-003', 
      code: 'M003', 
      name: '종사자 근로계약',
      period: '매월',
      category: '매월',
      characteristic: '정량',
      checkMethod: 'LMS 점검',
      reviewMaterials: '사업부서 비치 운영계획서',
      description: '종사자 근로 계약 점검',
      commonRequired: 'O',
      commonOptional: '',
      evaluationLinked: 'O',
      onlineCheck: '',
      onsiteCheck: 'O'
    },
    { 
      id: 'IND-매월-004', 
      code: 'M004', 
      name: '서비스 제공기록 작성',
      period: '매월',
      category: '매월',
      characteristic: '정량',
      checkMethod: '현장점검',
      reviewMaterials: 'LMS 시스템(활동지언서 및 합동회의)',
      description: '서비스 이용자에 대한 제공 점검',
      commonRequired: '',
      commonOptional: 'O',
      evaluationLinked: '',
      onlineCheck: '',
      onsiteCheck: 'O'
    },
    { 
      id: 'IND-매월-005', 
      code: 'M005', 
      name: '종사자 역량강화교육 이수',
      period: '매월',
      category: '매월',
      characteristic: '정량',
      checkMethod: '현장점검',
      reviewMaterials: 'LMS 시스템(활동지언서 및 합동회의)',
      description: '종사자 역량강화교육 이수 점검',
      commonRequired: 'O',
      commonOptional: '',
      evaluationLinked: '',
      onlineCheck: '',
      onsiteCheck: 'O'
    },
    { 
      id: 'IND-매월-006', 
      code: 'Y005', 
      name: '노인복지시설 인증제 준비',
      period: '매월',
      category: '매월',
      characteristic: '정성',
      checkMethod: '현장점검',
      reviewMaterials: '노인장기요양시설등',
      description: '노인복지시설 인증제 준비 점검',
      commonRequired: '',
      commonOptional: '',
      evaluationLinked: 'O',
      onlineCheck: '',
      onsiteCheck: 'O'
    },
    { 
      id: 'IND-매월-007', 
      code: 'M007', 
      name: '통합 돌봄(방문의료 대비 서비스 의뢰서 작성)',
      period: '매월',
      category: '매월',
      characteristic: '정성',
      checkMethod: '현장점검',
      reviewMaterials: '방문의료 대비 서비스 의뢰서',
      description: '방문의료 대비 서비스 의뢰서 작성 점검',
      commonRequired: 'O',
      commonOptional: '',
      evaluationLinked: '',
      onlineCheck: '',
      onsiteCheck: 'O'
    },
    { 
      id: 'IND-매월-008', 
      code: 'M008', 
      name: '서비스 대상자 식사 제공',
      period: '매월',
      category: '매월',
      characteristic: '정성',
      checkMethod: '시스템점검',
      reviewMaterials: '식단표, 식단관리 기록',
      description: '대상자에 대한 식사 제공 점검'
    },
    { 
      id: 'IND-매월-009', 
      code: 'M009', 
      name: '이용자 우울증 모니터링 점검',
      period: '매월',
      category: '매월',
      characteristic: '정성',
      checkMethod: '서류점검',
      reviewMaterials: '우울증 점검 기록지',
      description: '우울증 점검 모니터링 점검'
    },
    { 
      id: 'IND-매월-010', 
      code: 'M010', 
      name: '생활지원사 서비스 기록',
      period: '매월',
      category: '매월',
      characteristic: '정성',
      checkMethod: '인터뷰',
      reviewMaterials: '생활지원사 서비스 기록지',
      description: '생활지원사 서비스 기록 점검'
    }
  ];
  
  // 반기 점검 지표 추가
  const additionalSampleData = [
    { 
      id: 'IND-반기-001', 
      code: 'H001', 
      name: '반기 점검 지표 1',
      period: '반기',
      characteristic: '정성',
      checkMethod: '인터뷰',
      description: '반기 점검 지표 1 설명'
    },
    { 
      id: 'IND-반기-002', 
      code: 'H002', 
      name: '반기 점검 지표 2',
      period: '반기',
      characteristic: '정량',
      checkMethod: '시스템점검',
      description: '반기 점검 지표 2 설명'
    },
    { 
      id: 'IND-1~3월-001', 
      code: 'Q001', 
      name: '1~3월 점검 지표 1',
      period: '1~3월',
      characteristic: '정성',
      checkMethod: '현장점검',
      description: '1~3월 점검 지표 1 설명'
    },
    { 
      id: 'IND-1~3월-002', 
      code: 'Q002', 
      name: '1~3월 점검 지표 2',
      period: '1~3월',
      characteristic: '필수',
      checkMethod: '서류점검',
      description: '1~3월 점검 지표 2 설명'
    },
    { 
      id: 'IND-연중-001', 
      code: 'Y001', 
      name: '연간 사업계획 수립 및 이행',
      period: '연중',
      characteristic: '정성',
      checkMethod: '서류점검',
      description: '연간 사업계획 수립 및 이행 점검'
    }
  ];
  
  // 기존 샘플 데이터와 추가 데이터 합치기
  const allSampleData = [...sampleData, ...additionalSampleData];
  
  // 주기별 필터링 매핑 정의
  const periodMapping = {
    '매월': ['매월'],
    '반기': ['반기', '연중'],  // 반기 탭에는 연중 카테고리도 포함
    '1~3월': ['1~3월', '분기'],
    '연중': ['연중']
  };
  
  console.log(`전체 샘플 데이터 개수: ${allSampleData.length}`);
  
  // 주기에 맞는 샘플 데이터 필터링
  const filteredData = allSampleData.filter(item => {
    // 해당 주기에 맞는 카테고리인지 확인
    const validCategories = periodMapping[period] || [period];
    return validCategories.includes(item.period);
  });
  
  console.log(`필터링된 샘플 데이터 개수 (${period}): ${filteredData.length}`);
  
  // 지표 수에 맞게 데이터 생성 (count가 필터링된 데이터 개수보다 클 경우 모든 데이터 반환)
  const selectedData = filteredData.length <= count ? filteredData : filteredData.slice(0, count);
  
  // 필터링된 데이터 가공 - 필요한 필드 추가 및 변환
  const processedData = selectedData.map(item => {
    // reviewMaterials 필드가 없는 경우 공백 문자열로 추가
    if (!item.reviewMaterials) {
      item.reviewMaterials = '';
    }

    // isCommonRequired, isCommonOptional, isEvaluationLinked 추가
    item.isCommonRequired = item.commonRequired === 'O';
    item.isCommonOptional = item.commonOptional === 'O';
    item.isEvaluationLinked = item.evaluationLinked === 'O';

    // 한글 필드명 추가 (클라이언트 호환성 유지)
    item['공통필수'] = item.commonRequired;
    item['공통선택'] = item.commonOptional;
    item['평가연계'] = item.evaluationLinked;
    item['검토자료'] = item.reviewMaterials;

    // 점검 유형 및 우선순위 결정
    let checkType = '';
    if (item.onlineCheck && (item.onlineCheck === '필수' || item.onlineCheck === '우선')) {
      checkType = '온라인';
    } else if (item.onsiteCheck && (item.onsiteCheck === '필수' || item.onsiteCheck === '우선')) {
      checkType = '현장';
    }
    item.checkType = checkType;
    
    // checkMethod 값도 동일하게 설정
    item.checkMethod = checkType || '온라인';

    let priority = '';
    if (item.onlineCheck === '필수' || item.onsiteCheck === '필수') {
      priority = '필수';
    } else if (item.onlineCheck === '우선' || item.onsiteCheck === '우선') {
      priority = '우선';
    } else if (item.onlineCheck === '선택' || item.onsiteCheck === '선택') {
      priority = '선택';
    }
    item.priority = priority;

    return item;
  });

  // 클라이언트 측 형식에 맞게 반환
  return processedData;
}

module.exports = handleIndicatorsRequest;

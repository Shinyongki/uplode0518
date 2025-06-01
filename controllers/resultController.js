// const resultModel = require('../models/result');

// 모델 가져오기
const resultModel = require('../models/result');
const { readSheetData } = require('../config/googleSheets');
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';

// 모니터링 결과 저장
const saveMonitoringResult = async (req, res) => {
  try {
    // 세션에서 위원 정보 가져오기
    if (!req.session || !req.session.committee) {
      return res.status(401).json({
        status: 'error',
        message: '로그인이 필요합니다.'
      });
    }
    
    const committeeName = req.session.committee.name;
    const resultData = req.body;
    
    console.log('수신된 결과 데이터:', JSON.stringify(resultData));
    
    // 필수 필드 검증
    if (!resultData.기관코드 || !resultData.지표ID || !resultData.결과) {
      return res.status(400).json({
        status: 'error',
        message: '기관코드, 지표ID, 결과는 필수 항목입니다.'
      });
    }
    
    // category와 지역 필드 확인 및 추가
    if (!resultData.hasOwnProperty('category')) {
      console.log('category 필드가 없음, 빈 값으로 추가');
      resultData.category = '';
    }
    
    if (!resultData.hasOwnProperty('지역')) {
      console.log('지역 필드가 없음, 빈 값으로 추가');
      resultData.지역 = '';
    }
    
    // 위원 이름 자동 추가
    resultData.위원명 = committeeName;
    // 평가일자가 없는 경우 현재 날짜로 설정
    if (!resultData.평가일자) {
      resultData.평가일자 = new Date().toISOString().split('T')[0];
    }

    // 수정 요청인 경우 (update, overwrite 또는 isUpdate 플래그 체크)
    const isUpdate = resultData.update === true || 
                    resultData.overwrite === true || 
                    resultData.isUpdate === true;
    
    console.log(`${isUpdate ? '수정' : '저장'} 요청으로 처리 - 같은 월/지표 데이터 ${isUpdate ? '덮어쓰기' : '추가'}`);
    
    // 저장할 최종 데이터에 수정 여부 플래그 추가
    resultData.isUpdate = isUpdate;
    console.log('저장할 최종 데이터:', JSON.stringify(resultData));
    
    // 구글 시트에 데이터 저장
    const result = await resultModel.saveMonitoringResult(resultData);
    
    // 프론트엔드에 수정 모드였는지 여부를 응답에 포함
    return res.status(200).json({
      status: 'success',
      message: `모니터링 결과가 성공적으로 ${isUpdate ? '수정' : '저장'}되었습니다.`,
      data: { 
        result,
        wasUpdate: isUpdate 
      }
    });
  } catch (error) {
    console.error('모니터링 결과 저장 중 오류 발생:', error);
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 특정 기관의 모니터링 결과 가져오기
const getResultsByOrganization = async (req, res) => {
  try {
    const { orgCode } = req.params;
    
    if (!orgCode) {
      return res.status(400).json({
        status: 'error',
        message: '기관 코드가 필요합니다.'
      });
    }
    
    console.log(`기관(${orgCode}) 결과 API 요청`);
    
    // 구글 시트에서 결과 가져오기
    const results = await resultModel.getResultsByOrganization(orgCode);
    
    // 결과 데이터 검증 및 필드 확인
    if (results && results.length > 0) {
      console.log(`기관(${orgCode}) 결과 ${results.length}개 확인`);
      
      // 모든 결과에 category와 지역 필드가 있는지 확인하고 없으면 추가
      results.forEach(result => {
        if (!result.hasOwnProperty('category')) {
          result.category = '';
        }
        
        if (!result.hasOwnProperty('지역')) {
          result.지역 = '';
        }
      });
    } else {
      console.log(`기관(${orgCode})에 대한 결과 없음`);
    }
    
    return res.status(200).json({
      status: 'success',
      data: { results }
    });
  } catch (error) {
    console.error(`기관 모니터링 결과 조회 중 오류 발생 (코드: ${req.params.orgCode}):`, error);
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 내 모니터링 결과 가져오기
const getMyResults = async (req, res) => {
  try {
    // 세션에서 위원 정보 가져오기
    if (!req.session || !req.session.committee) {
      return res.status(401).json({
        status: 'error',
        message: '로그인이 필요합니다.'
      });
    }
    
    const committeeName = req.session.committee.name;
    console.log(`위원(${committeeName}) 결과 API 요청`);
    
    // 구글 시트에서 결과 가져오기
    const results = await resultModel.getResultsByCommittee(committeeName);
    
    // 결과 데이터 검증 및 필드 확인
    if (results && results.length > 0) {
      console.log(`위원(${committeeName}) 결과 ${results.length}개 확인`);
      
      // 모든 결과에 category와 지역 필드가 있는지 확인하고 없으면 추가
      results.forEach(result => {
        if (!result.hasOwnProperty('category')) {
          result.category = '';
        }
        
        if (!result.hasOwnProperty('지역')) {
          result.지역 = '';
        }
      });
    } else {
      console.log(`위원(${committeeName})에 대한 결과 없음`);
    }
    
    return res.status(200).json({
      status: 'success',
      data: { results }
    });
  } catch (error) {
    console.error('내 모니터링 결과 조회 중 오류 발생:', error);
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 특정 기관과 지표에 대한 모니터링 결과 가져오기
const getResultByOrgAndIndicator = async (req, res) => {
  try {
    const { orgCode, indicatorId } = req.params;
    
    if (!orgCode || !indicatorId) {
      return res.status(400).json({
        status: 'error',
        message: '기관 코드와 지표 ID가 필요합니다.'
      });
    }
    
    console.log(`기관(${orgCode})의 지표(${indicatorId}) 결과 API 요청`);
    
    // 구글 시트에서 결과 가져오기
    const result = await resultModel.getResultByOrgAndIndicator(orgCode, indicatorId);
    
    // 결과 데이터 검증 및 필드 확인
    if (result) {
      console.log(`기관(${orgCode})의 지표(${indicatorId}) 결과 확인:`, result);
      
      // category와 지역 필드가 있는지 확인하고 없으면 추가
      if (!result.hasOwnProperty('category')) {
        result.category = '';
      }
      
      if (!result.hasOwnProperty('지역')) {
        result.지역 = '';
      }
    } else {
      console.log(`기관(${orgCode})의 지표(${indicatorId})에 대한 결과 없음`);
    }
    
    return res.status(200).json({
      status: 'success',
      data: { result }
    });
  } catch (error) {
    console.error(`기관(${req.params.orgCode})의 지표(${req.params.indicatorId}) 결과 조회 중 오류 발생:`, error);
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 중복 데이터 정리 (관리자 전용)
const cleanupDuplicateResults = async (req, res) => {
  try {
    // 세션에서 위원 정보 가져오기 및 관리자 권한 확인
    if (!req.session || !req.session.committee) {
      return res.status(401).json({
        status: 'error',
        message: '로그인이 필요합니다.'
      });
    }
    
    // 관리자 권한 확인 (필요에 따라 추가 로직 구현)
    const isAdmin = req.session.committee.isAdmin === true;
    if (!isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: '관리자만 이 기능을 사용할 수 있습니다.'
      });
    }
    
    console.log('중복 데이터 정리 작업 요청');
    
    // 중복 데이터 정리 실행
    const cleanupResult = await resultModel.cleanupDuplicateData();
    
    return res.status(200).json({
      status: 'success',
      message: cleanupResult.message,
      data: { 
        cleanupResult
      }
    });
  } catch (error) {
    console.error('중복 데이터 정리 중 오류 발생:', error);
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 위원별 모니터링 결과 가져오기
const getResultsByCommittee = async (req, res) => {
  try {
    console.log('위원별 모니터링 결과 API 요청됨');
    
    // 세션에서 사용자 정보 가져오기
    const committee = req.session?.committee;
    if (!committee) {
      console.log('로그인 정보 없음, 인증 필요');
      return res.status(401).json({
        status: 'error',
        message: '로그인이 필요합니다.'
      });
    }
    
    console.log('위원 정보:', committee);
    
    // 구글 시트에서 위원-기관 매칭 정보 가져오기
    const sheetRange = '모니터링_결과!A:Z'; // 모니터링 결과가 저장된 시트 범위
    
    let data;
    try {
      data = await readSheetData(SPREADSHEET_ID, sheetRange);
    } catch (error) {
      console.error('구글 시트 읽기 오류:', error);
      // 샘플 데이터 제공
      return res.status(200).json({
        status: 'success',
        data: { 
          results: getSampleResultData(committee)
        },
        source: 'sample_data'
      });
    }
    
    if (!data || data.length < 2) {
      console.log('모니터링 결과 데이터를 찾을 수 없습니다. 샘플 데이터를 사용합니다.');
      return res.status(200).json({
        status: 'success',
        data: { 
          results: getSampleResultData(committee)
        },
        source: 'empty_sheet_sample_data'
      });
    }

    // 헤더를 제외한 실제 데이터
    const headers = data[0];
    const rows = data.slice(1);
    console.log(`총 ${rows.length}개 모니터링 결과 데이터 로드됨`);
    
    // 현재 위원의 결과만 필터링 (마스터 계정은 모든 결과)
    let filteredRows = rows;
    if (committee.role !== 'master') {
      filteredRows = rows.filter(row => {
        const rowCommitteeId = row[1] || ''; // 위원 ID 인덱스가 1이라고 가정
        return rowCommitteeId === committee.id;
      });
    }
    
    console.log(`위원(${committee.name})에 해당하는 결과 ${filteredRows.length}개 찾음`);
    
    // 결과 데이터를 적절한 형식으로 변환
    const results = filteredRows.map(row => {
      return {
        id: row[0] || '',
        committeeId: row[1] || '',
        committeeName: row[2] || '',
        orgCode: row[3] || '',
        orgName: row[4] || '',
        monitoringDate: row[5] || '',
        indicators: row[6] ? JSON.parse(row[6]) : [],
        comments: row[7] || ''
      };
    });

    return res.status(200).json({
      status: 'success',
      data: { results },
      source: 'sheet_data'
    });
  } catch (error) {
    console.error('모니터링 결과 조회 중 오류:', error);
    
    // 오류가 발생하더라도 샘플 데이터 제공
    const committee = req.session?.committee || { id: 'unknown', name: 'Unknown User' };
    return res.status(200).json({
      status: 'success',
      data: { 
        results: getSampleResultData(committee)
      },
      source: 'error_fallback_sample_data'
    });
  }
};

// 샘플 모니터링 결과 데이터 제공 함수
function getSampleResultData(committee) {
  // 기관 목록
  const organizations = [
    { code: 'A48120001', name: '동진노인통합지원센터', region: '창원시 의창구' },
    { code: 'A48120002', name: '창원도우누리노인종합재가센터', region: '창원시 의창구' },
    { code: 'A48120006', name: '성로노인통합지원센터', region: '창원시 마산합포구' },
    { code: 'A48720001', name: '의령노인통합지원센터', region: '의령군' }
  ];
  
  // 마스터 계정일 경우 모든 결과 반환
  if (committee.role === 'master') {
    return [
      {
        id: 'result-001',
        committeeId: 'C001',
        committeeName: '신용기',
        orgCode: 'A48120001',
        orgName: '동진노인통합지원센터',
        monitoringDate: '2023-05-10',
        indicators: [
          { id: 'ind-001', name: '기관 운영규정', period: '매월', completed: true, score: 90 },
          { id: 'ind-002', name: '운영계획 및 예산', period: '매월', completed: true, score: 85 }
        ]
      },
      {
        id: 'result-002',
        committeeId: 'C001',
        committeeName: '신용기',
        orgCode: 'A48120002',
        orgName: '창원도우누리노인종합재가센터',
        monitoringDate: '2023-05-15',
        indicators: [
          { id: 'ind-001', name: '기관 운영규정', period: '매월', completed: true, score: 88 },
          { id: 'ind-002', name: '운영계획 및 예산', period: '매월', completed: true, score: 92 }
        ]
      },
      {
        id: 'result-003',
        committeeId: 'C004',
        committeeName: '이연숙',
        orgCode: 'A48120006',
        orgName: '성로노인통합지원센터',
        monitoringDate: '2023-05-20',
        indicators: [
          { id: 'ind-001', name: '기관 운영규정', period: '매월', completed: true, score: 95 },
          { id: 'ind-002', name: '운영계획 및 예산', period: '매월', completed: true, score: 90 }
        ]
      }
    ];
  }
  
  // 해당 위원에게 할당된 조직 중 2개만 샘플 결과 생성
  const committeeOrgs = organizations.slice(0, 2);
  
  return committeeOrgs.map((org, index) => ({
    id: `result-${index + 1}`,
    committeeId: committee.id,
    committeeName: committee.name,
    orgCode: org.code,
    orgName: org.name,
    monitoringDate: new Date(Date.now() - (index * 86400000)).toISOString().split('T')[0],
    indicators: [
      { id: 'ind-001', name: '기관 운영규정', period: '매월', completed: true, score: 85 + (index * 5) },
      { id: 'ind-002', name: '운영계획 및 예산', period: '매월', completed: true, score: 80 + (index * 5) }
    ]
  }));
}

module.exports = {
  saveMonitoringResult,
  getResultsByOrganization,
  getMyResults,
  getResultByOrgAndIndicator,
  cleanupDuplicateResults,
  getResultsByCommittee
}; 
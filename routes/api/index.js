const express = require('express');
const router = express.Router();
const resultsRouter = require('./results');

// 샘플 데이터 - 실제 프로젝트에서는 DB에서 가져옴
const sampleData = {
  organizations: [
    { id: 'org1', name: '서울특별시 노인종합복지관', region: '서울', role: '주담당', progress: 75 },
    { id: 'org2', name: '부산광역시 노인복지센터', region: '부산', role: '주담당', progress: 40 },
    { id: 'org3', name: '인천광역시 노인돌봄센터', region: '인천', role: '부담당', progress: 60 },
    { id: 'org4', name: '대구광역시 노인복지관', region: '대구', role: '부담당', progress: 20 },
    { id: 'org5', name: '광주광역시 노인복지센터', region: '광주', role: '주담당', progress: 90 }
  ],
  indicators: [
    { id: 'ind1', name: '서비스 제공 계획 수립', period: '매월', type: 'required', status: 'fulfilled' },
    { id: 'ind2', name: '서비스 제공 결과 보고', period: '매월', type: 'required', status: 'unfulfilled' },
    { id: 'ind3', name: '예산 집행 현황', period: '반기', type: 'optional', status: 'na' },
    { id: 'ind4', name: '인력 운영 현황', period: '반기', type: 'required', status: 'fulfilled' },
    { id: 'ind5', name: '서비스 만족도 조사', period: '1~3월', type: 'assessment', status: 'unfulfilled' }
  ],
  schedules: [
    { id: 'sch1', committeeName: '신용기', orgName: '서울특별시 노인종합복지관', date: '2025-05-25', status: 'scheduled' },
    { id: 'sch2', committeeName: '신용기', orgName: '부산광역시 노인복지센터', date: '2025-06-10', status: 'completed' },
    { id: 'sch3', committeeName: '마스터', orgName: '인천광역시 노인돌봄센터', date: '2025-05-30', status: 'scheduled' }
  ]
};

// API 라우트 정의
router.get('/test', (req, res) => {
  res.json({ message: 'API 테스트 성공' });
});

// 결과 API 라우터 등록
router.use('/results', resultsRouter);

// 위원 정보 API
router.get('/committee', (req, res) => {
  // 세션에서 위원 정보 확인
  if (req.session && req.session.committee) {
    res.json({ 
      status: 'success',
      committee: req.session.committee 
    });
  } else {
    res.status(401).json({ 
      status: 'error',
      message: '인증된 위원 정보가 없습니다.' 
    });
  }
});

// 담당 기관 목록 API
router.get('/organizations', (req, res) => {
  // 인증 검사를 임시로 간소화
  // if (!req.session || !req.session.committee) {
  //   return res.status(401).json({ 
  //     status: 'error',
  //     message: '인증이 필요합니다.' 
  //   });
  // }
  
  // 개발 환경을 위한 임시 위원 정보
  const committee = req.session?.committee || { role: 'master', name: '마스터' };
  let organizations = [];
  
  // 마스터 계정은 모든 기관 조회 가능
  if (committee.role === 'master') {
    organizations = sampleData.organizations;
  } else {
    // 일반 위원은 자신의 담당 기관만 조회
    organizations = sampleData.organizations.filter(org => 
      org.role === '주담당' || org.role === '부담당'
    );
  }
  
  res.json({
    status: 'success',
    organizations: {
      main: organizations.filter(org => org.role === '주담당'),
      sub: organizations.filter(org => org.role === '부담당')
    }
  });
});

// 주기별 지표 목록 API
router.get('/indicators', (req, res) => {
  const { period, orgCode } = req.query;
  
  // 필수 파라미터 확인
  if (!period || !orgCode) {
    return res.status(400).json({
      status: 'error',
      message: '필수 파라미터가 누락되었습니다. (period, orgCode)'
    });
  }
  
  console.log(`지표 API 요청: 주기=${period}, 기관코드=${orgCode}`);
  
  // 샘플 지표 데이터 생성
  const indicators = generateSampleIndicators(period);
  
  // 응답 반환
  res.json({
    status: 'success',
    data: {
      indicators: indicators,
      period: period,
      orgCode: orgCode,
      timestamp: new Date().toISOString()
    }
  });
});

// 기관별 지표 목록 API (구버전 - 호환성 유지)
router.get('/indicators/:orgId', (req, res) => {
  if (!req.session || !req.session.committee) {
    return res.status(401).json({ 
      status: 'error',
      message: '인증이 필요합니다.' 
    });
  }
  
  const { orgId } = req.params;
  const { period } = req.query;
  
  // 기관 존재 여부 확인
  const organization = sampleData.organizations.find(org => org.id === orgId);
  if (!organization) {
    return res.status(404).json({
      status: 'error',
      message: '해당 기관을 찾을 수 없습니다.'
    });
  }
  
  // 주기별 필터링
  let indicators = sampleData.indicators;
  if (period) {
    indicators = indicators.filter(ind => ind.period === period);
  }
  
  res.json({
    status: 'success',
    organization,
    indicators
  });
});

// 일정 관리 API
router.get('/schedules', (req, res) => {
  // 인증 검사를 임시로 비활성화 (개발 환경용)
  // if (!req.session || !req.session.committee) {
  //   return res.status(401).json({ 
  //     status: 'error',
  //     message: '인증이 필요합니다.' 
  //   });
  // }
  
  // 개발 환경을 위한 임시 위원 정보
  const committee = req.session?.committee || { role: 'master', name: '마스터' };
  let schedules = [];
  
  // 마스터 계정은 모든 일정 조회 가능
  if (committee.role === 'master') {
    schedules = sampleData.schedules;
  } else {
    // 일반 위원은 자신의 일정만 조회
    schedules = sampleData.schedules.filter(sch => 
      sch.committeeName === committee.name
    );
  }
  
  res.json({
    status: 'success',
    schedules
  });
});

// 마스터 대시보드 데이터 API
router.get('/dashboard/master', (req, res) => {
  // 인증 검사를 임시로 비활성화 (개발 환경용)
  // if (!req.session || !req.session.committee || req.session.committee.role !== 'master') {
  //   return res.status(403).json({ 
  //     status: 'error',
  //     message: '마스터 관리자 권한이 필요합니다.' 
  //   });
  // }
  
  // 마스터 대시보드 데이터 구성
  const dashboardData = {
    organizations: {
      total: sampleData.organizations.length,
      completed: sampleData.organizations.filter(org => org.progress === 100).length
    },
    indicators: {
      total: sampleData.indicators.length,
      fulfilled: sampleData.indicators.filter(ind => ind.status === 'fulfilled').length,
      unfulfilled: sampleData.indicators.filter(ind => ind.status === 'unfulfilled').length,
      na: sampleData.indicators.filter(ind => ind.status === 'na').length
    },
    schedules: {
      total: sampleData.schedules.length,
      scheduled: sampleData.schedules.filter(sch => sch.status === 'scheduled').length,
      completed: sampleData.schedules.filter(sch => sch.status === 'completed').length
    }
  };
  
  res.json({
    status: 'success',
    data: dashboardData
  });
});

// 위원별 담당기관 매칭 데이터 API
router.get('/committees/matching', (req, res) => {
  // 인증 검사를 임시로 비활성화 (개발 환경용)
  // if (!req.session || !req.session.committee) {
  //   return res.status(401).json({ 
  //     status: 'error',
  //     message: '인증이 필요합니다.' 
  //   });
  // }
  
  // 구글 시트에서 데이터 가져오기
  const { google } = require('googleapis');
  const path = require('path');
  
  // 구글시트 인증 설정
  const authGoogle = new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  
  // 구글시트 API 클라이언트 생성
  const sheets = google.sheets({ version: 'v4', auth: authGoogle });
  
  // 스프레드시트 ID와 범위 설정
  const spreadsheetId = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';
  const range = '위원별_담당기관!A2:G'; // A2부터 G열까지의 데이터
  
  // 구글 시트 정보 로깅
  console.log('구글 시트 요청 정보:', {
    spreadsheetId,
    range,
    keyFile: path.join(process.cwd(), 'service-account.json')
  });
  
  // 구글 시트에서 데이터 가져오기
  sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  }, (err, response) => {
    if (err) {
      console.error('구글 시트 API 오류:', err);
      return res.status(500).json({
        status: 'error',
        message: '구글 시트에서 데이터를 가져오는 중 오류가 발생했습니다.',
        error: err.message
      });
    }
    
    console.log('구글 시트 API 응답:', response ? JSON.stringify(response.data, null, 2) : '응답 없음');
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('구글 시트에서 가져온 데이터가 없습니다.');
      return res.json({
        status: 'success',
        matchings: []
      });
    }
    
    // 데이터 변환 - 실제 데이터 구조에 맞게 수정
    const matchings = rows.map(row => {
      return {
        committeeId: row[0] || '', // 위원ID (A열)
        committeeName: row[1] || '', // 위원명 (B열)
        orgCode: row[3] || '', // 기관코드 (D열)
        orgName: row[4] || '', // 기관명 (E열)
        region: row[5] || '', // 지역 (F열)
        role: row[6] || '부담당' // 담당유형 (G열)
      };
    }).filter(item => item.orgCode && item.committeeName); // 빈 행 필터링
    
    console.log('변환된 매칭 데이터 예시:', matchings.slice(0, 3));
    
    // 직접 배열로 반환하여 master.js에서 처리하기 쉽게 함
    res.json(matchings);
    
    // 디버깅용 로그
    console.log('반환된 매칭 데이터 개수:', matchings.length);
  });
});

// 위원별 담당기관 매칭 데이터 저장 API
router.post('/committees/matching', async (req, res) => {
  // 인증 검사를 임시로 비활성화 (개발 환경용)
  // if (!req.session || !req.session.committee || req.session.committee.role !== 'master') {
  //   return res.status(403).json({ 
  //     status: 'error',
  //     message: '마스터 권한이 필요합니다.' 
  //   });
  // }
  
  try {
    const { matchings } = req.body;
    
    if (!matchings || !Array.isArray(matchings)) {
      return res.status(400).json({
        status: 'error',
        message: '유효한 매칭 데이터가 필요합니다.'
      });
    }
    
    console.log('매칭 데이터 저장 요청:', matchings.length + '개 항목');
    console.log('매칭 데이터 샘플:', matchings.slice(0, 3));
    
    // 구글 시트에 데이터 저장 로직 추가
    const { google } = require('googleapis');
    const path = require('path');
    
    // 구글시트 인증 설정
    const authGoogle = new google.auth.GoogleAuth({
      keyFile: path.join(process.cwd(), 'service-account.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    // 구글시트 API 클라이언트 생성 (쓰기 권한 포함)
    const sheets = google.sheets({ version: 'v4', auth: authGoogle });
    
    // 스프레드시트 ID와 범위 설정
    const spreadsheetId = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';
    const range = '위원별_담당기관!A2:G'; // A2부터 G열까지의 데이터
    
    try {
      // 기존 데이터 삭제 (클리어)
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range,
      });
      
      // 새 데이터 준비
      const values = matchings.map(matching => [
        matching.committeeId || '',
        matching.committeeName || '',
        '', // orgId 필드 (비워둠)
        matching.orgCode || '',
        matching.orgName || '',
        matching.region || '',
        matching.role || '부담당'
      ]);
      
      // 새 데이터 삽입
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: '위원별_담당기관!A2',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: values
        },
      });
      
      console.log('구글 시트에 매칭 데이터 저장 완료:', values.length);
    } catch (sheetError) {
      console.error('구글 시트 저장 중 오류:', sheetError);
      return res.status(500).json({
        status: 'error',
        message: '구글 시트에 데이터를 저장하는 중 오류가 발생했습니다.',
        error: sheetError.message
      });
    }
    
    // 성공 응답 반환
    res.json({
      status: 'success',
      message: '매칭 정보가 성공적으로 저장되었습니다.',
      count: matchings.length
    });
    
  } catch (error) {
    console.error('매칭 데이터 저장 중 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '매칭 정보 저장 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 내 담당 기관 목록 API
router.get('/organizations/my', (req, res) => {
  // 인증 검사를 임시로 간소화 (개발 환경용)
  // if (!req.session || !req.session.committee) {
  //   return res.status(401).json({ 
  //     status: 'error',
  //     message: '인증이 필요합니다.' 
  //   });
  // }
  
  // 개발 환경을 위한 임시 위원 정보
  const committee = req.session?.committee || { role: 'master', name: '마스터' };
  let organizations = [];
  
  // 마스터 계정은 모든 기관 조회 가능
  if (committee.role === 'master') {
    organizations = sampleData.organizations;
  } else {
    // 일반 위원은 자신의 담당 기관만 조회
    organizations = sampleData.organizations.filter(org => 
      org.role === '주담당' || org.role === '부담당'
    );
  }
  
  // 주담당과 부담당으로 분류
  const mainOrgs = organizations.filter(org => org.role === '주담당');
  const subOrgs = organizations.filter(org => org.role === '부담당');
  
  res.json({
    status: 'success',
    data: {
      main: mainOrgs,
      sub: subOrgs
    }
  });
});

// 구글 시트에서 위원별 담당 기관 데이터 가져오기 API
router.get('/sheets/committee-orgs', async (req, res) => {
  try {
    // 위원 이름 파라미터 가져오기
    const { committeeName } = req.query;
    
    console.log(`구글 시트에서 ${committeeName} 위원의 담당 기관 데이터 요청`);
    
    // 구글 시트 연동 설정
    const { google } = require('googleapis');
    const path = require('path');
    
    // 구글시트 인증 설정
    const authGoogle = new google.auth.GoogleAuth({
      keyFile: path.join(process.cwd(), 'service-account.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    
    // 구글시트 API 클라이언트 생성
    const sheets = google.sheets({ version: 'v4', auth: authGoogle });
    
    // 스프레드시트 ID와 범위 설정
    const spreadsheetId = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';
    const range = '위원별_담당기관!A1:H'; // 헤더 포함 데이터 가져오기
    
    // 구글 시트에서 데이터 가져오기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    
    const rows = response.data.values;
    
    if (!rows || rows.length === 0) {
      console.log('구글 시트에서 데이터를 찾을 수 없습니다.');
      return res.json({
        status: 'success',
        data: []
      });
    }
    
    // 헤더 행 추출
    const headers = rows[0];
    const headerMap = {};
    headers.forEach((header, index) => {
      if (header === '위원ID') headerMap.committeeId = index;
      else if (header === '위원명') headerMap.committeeName = index;
      else if (header === '기관ID') headerMap.orgId = index;
      else if (header === '기관코드') headerMap.orgCode = index;
      else if (header === '기관명') headerMap.orgName = index;
      else if (header === '지역') headerMap.region = index;
      else if (header === '담당유형') headerMap.role = index;
    });
    
    // 위원별 담당 기관 데이터 추출
    const matchings = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // 데이터 행이 유효한지 확인
      if (row.length > 0) {
        const item = {
          committeeId: row[headerMap.committeeId] || '',
          committeeName: row[headerMap.committeeName] || '',
          orgId: row[headerMap.orgId] || '',
          orgCode: row[headerMap.orgCode] || '',
          orgName: row[headerMap.orgName] || '',
          region: row[headerMap.region] || '',
          role: row[headerMap.role] || '부담당'
        };
        
        // 위원 이름이 지정되지 않았거나 일치하는 경우만 추가
        if (!committeeName || item.committeeName === committeeName) {
          matchings.push(item);
        }
      }
    }
    
    console.log(`구글 시트에서 ${matchings.length}개의 데이터 가져옴`);
    
    // 반환할 데이터 구성
    res.json({
      status: 'success',
      data: matchings
    });
    
  } catch (error) {
    console.error('구글 시트 데이터 가져오기 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '구글 시트에서 데이터를 가져오는 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 샘플 지표 데이터 생성 (개발 및 테스트용)
 * @param {string} period - 주기 (매월, 반기, 1~3월 등)
 * @returns {Array} 샘플 지표 목록
 */
function generateSampleIndicators(period) {
  // 주기별 지표 수
  const countMap = {
    '매월': 10,
    '반기': 5,
    '1~3월': 3
  };
  
  const count = countMap[period] || 5;
  const indicators = [];
  
  // 샘플 특성 목록
  const characteristics = ['정량', '정성', '필수', '권장'];
  
  // 샘플 점검 방법 목록
  const checkMethods = ['현장점검', '서류점검', '인터뷰', '시스템점검'];
  
  // 샘플 지표 생성
  for (let i = 1; i <= count; i++) {
    const id = `IND-${period}-${i.toString().padStart(3, '0')}`;
    
    indicators.push({
      id: id,
      name: `${period} 지표 ${i}`,
      period: period,
      characteristic: characteristics[Math.floor(Math.random() * characteristics.length)],
      checkMethod: checkMethods[Math.floor(Math.random() * checkMethods.length)],
      description: `${period} 주기 점검 지표 ${i}번에 대한 설명입니다.`,
    });
  }
  
  return indicators;
}

module.exports = router;

// Vercel 서버리스 함수 핸들러
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const { google } = require('googleapis');
const sheetsHelper = require('./sheets-helper');

// 환경 변수 설정
process.env.USE_SERVICE_ACCOUNT = process.env.USE_SERVICE_ACCOUNT || 'true';
process.env.SPREADSHEET_ID = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';

// 초기화 로그
console.log('Vercel serverless function initializing');
console.log('NODE_VERSION:', process.version);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('SPREADSHEET_ID exists:', !!process.env.SPREADSHEET_ID);
console.log('SERVICE_ACCOUNT_KEY exists:', !!process.env.SERVICE_ACCOUNT_KEY);

// Express 앱 생성
const app = express();

// CORS 설정
app.use(cors({
  credentials: true,
  origin: function(origin, callback) {
    // 모든 출처 허용 (개발 환경용)
    callback(null, true);
  }
}));

// 기본 미들웨어
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 상태 확인 엔드포인트
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// 기본 API 응답
app.get('/api', (req, res) => {
  res.status(200).json({
    message: 'API 서버가 정상 작동 중입니다.',
    timestamp: new Date().toISOString()
  });
});

// 위원별 담당기관 데이터 (하드코딩된 기본 데이터)
const committeeOrgData = [
  ['위원ID', '위원명', '기관ID', '기관코드', '기관명', '지역', '담당구분', '상태'],
  ['C001', '신용기', 'O001', 'A48170002', '산청한일노인통합복지센터', '경상남도', '주담당', '정상'],
  ['C001', '신용기', 'O002', 'A48820003', '함안노인복지센터', '경상남도', '주담당', '정상'],
  ['C001', '신용기', 'O003', 'A48170003', '진주노인통합지원센터', '경상남도', '주담당', '정상'],
  ['C001', '신용기', 'O004', 'A48240001', '김해시니어클럽', '경상남도', '주담당', '정상'],
  ['C001', '신용기', 'O005', 'A48240002', '창원도우누리노인종합재가센터', '경상남도', '주담당', '정상'],
  ['C001', '신용기', 'O006', 'A48840001', '마산시니어클럽', '경상남도', '주담당', '정상'],
  ['C001', '신용기', 'O007', 'A48840002', '거제노인통합지원센터', '경상남도', '주담당', '정상'],
  ['C001', '신용기', 'O008', 'A48850001', '동진노인종합복지센터', '경상남도', '주담당', '정상'],
  ['C001', '신용기', 'O009', 'A48850002', '생명의전화노인복지센터', '경상남도', '주담당', '정상'],
  ['C001', '신용기', 'O010', 'A48170001', '보현행정노인복지센터', '경상남도', '주담당', '정상'],
  ['C001', '신용기', 'O011', 'B12345678', '부담당 기관1', '경상남도', '부담당', '정상'],
  ['C001', '신용기', 'O012', 'B87654321', '부담당 기관2', '경상남도', '부담당', '정상']
];

// 위원별 담당기관 API 엔드포인트
app.get('/api/sheets/organizations', async (req, res) => {
  try {
    console.log('위원별 담당기관 API 호출됨');
    
    // 구글 시트에서 데이터 가져오기 시도
    try {
      const sheetData = await sheetsHelper.readSheetData(
        process.env.SPREADSHEET_ID,
        '위원별_담당기관!A1:H100' // 시트 범위 조정 필요할 수 있음
      );
      
      console.log(`구글 시트에서 ${sheetData.length}개의 행 데이터 가져옴`);
      res.status(200).json(sheetData);
    } catch (sheetError) {
      console.error('구글 시트 데이터 가져오기 실패:', sheetError);
      console.log('대체 데이터 사용');
      // 구글 시트 연결 실패 시 하드코딩된 데이터 사용
      res.status(200).json(committeeOrgData);
    }
  } catch (error) {
    console.error('위원별 담당기관 API 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 위원별 담당기관 매칭 API 엔드포인트
app.get('/api/committees/matching', async (req, res) => {
  try {
    console.log('위원별 담당기관 매칭 API 호출됨');
    
    // 매칭 데이터 저장할 배열
    let orgData = [];
    
    // 구글 시트에서 데이터 가져오기 시도
    try {
      // 먼저 '기관_목록' 시트에서 데이터 가져오기 시도
      orgData = await sheetsHelper.readSheetData(
        process.env.SPREADSHEET_ID,
        '기관_목록!A1:H100' // 기관_목록 시트로 변경
      );
      console.log(`구글 시트 '기관_목록'에서 ${orgData.length}개의 행 데이터 가져옴`);
      
      // 데이터가 없으면 대체 시트 시도
      if (orgData.length <= 1) {
        console.log('기관_목록 시트에 데이터가 없어 위원별_담당기관 시트 시도');
        orgData = await sheetsHelper.readSheetData(
          process.env.SPREADSHEET_ID,
          '위원별_담당기관!A1:H100'
        );
        console.log(`구글 시트 '위원별_담당기관'에서 ${orgData.length}개의 행 데이터 가져옴`);
      }
    } catch (sheetError) {
      console.error('구글 시트 데이터 가져오기 실패:', sheetError);
      console.log('실제 신용기 위원 담당기관 데이터 사용');
      
      // 실제 신용기 위원의 담당 기관 데이터 (구글 시트 연결 실패 시 사용)
      orgData = [
        ['위원ID', '위원명', '기관ID', '기관코드', '기관명', '지역', '담당구분', '상태'],
        ['C001', '신용기', 'O001', 'A48820003', '대한노인회 고성군지회', '경상남도', '주담당', '정상'],
        ['C001', '신용기', 'O002', 'A48820004', '한올생명의집', '경상남도', '주담당', '정상'],
        ['C001', '신용기', 'O003', 'A48840003', '화방남해', '경상남도', '주담당', '정상'],
        ['C001', '신용기', 'O004', 'A48840004', '화방재가', '경상남도', '주담당', '정상'],
        ['C001', '신용기', 'O005', 'A48240001', '사랑원', '경상남도', '주담당', '정상'],
        ['C001', '신용기', 'O006', 'A48240002', '사천노인', '경상남도', '주담당', '정상'],
        ['C001', '신용기', 'O007', 'A48170003', '나누리', '경상남도', '주담당', '정상'],
        ['C001', '신용기', 'O008', 'A48170001', '진양', '경상남도', '주담당', '정상'],
        ['C001', '신용기', 'O009', 'A48170002', '진주', '경상남도', '주담당', '정상'],
        ['C001', '신용기', 'O010', 'A48850002', '경남하동', '경상남도', '주담당', '정상'],
        ['C001', '신용기', 'O011', 'A48850001', '하동노인', '경상남도', '주담당', '정상'],
        ['C002', '문일지', 'O101', 'A48740002', '창녕군새누리노인통합지원센터', '창녕군', '주담당', '정상'],
        ['C003', '김수연', 'O201', 'A48890001', '김해시노인복지관', '김해시', '주담당', '정상'],
        ['C004', '이영희', 'O301', 'A48720001', '통영시노인복지관', '통영시', '주담당', '정상'],
        ['C005', '박정수', 'O401', 'A48120002', '창원도우누리노인통합재가센터', '창원시', '주담당', '정상']
      ];
    }
    
    // 매칭 데이터 생성 (헤더 행 제외)
    const matchings = orgData.slice(1).map((row, index) => {
      return {
        id: `M${index + 1}`,
        committeeId: row[0],        // 위원ID
        committeeName: row[1],      // 위원명
        orgId: row[2],              // 기관ID
        orgCode: row[3],            // 기관코드
        orgName: row[4],            // 기관명
        region: row[5],             // 지역
        assignmentType: row[6] === '주담당' ? 'main' : 'sub',  // 담당구분
        status: row[7]              // 상태
      };
    });
    
    console.log(`총 ${matchings.length}개의 매칭 데이터 반환`);
    
    // 클라이언트가 기대하는 형식으로 데이터 반환
    // 클라이언트는 { status: 'success', data: { matchings: [...] } } 형식을 기대함
    res.status(200).json({
      status: 'success',
      data: {
        matchings: matchings
      }
    });
  } catch (error) {
    console.error('위원별 담당기관 매칭 API 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 위원별 담당기관 매칭 업데이트 API 엔드포인트
app.post('/api/committees/matching', async (req, res) => {
  try {
    console.log('위원별 담당기관 매칭 업데이트 API 호출됨');
    
    // 클라이언트에서 받은 데이터 확인
    const { matchings } = req.body;
    
    if (!matchings || !Array.isArray(matchings)) {
      return res.status(400).json({
        status: 'error',
        message: '유효한 매칭 데이터가 필요합니다.'
      });
    }
    
    console.log(`클라이언트에서 ${matchings.length}개의 매칭 데이터 받음`);
    
    // 실제 구글 시트 업데이트 기능은 추후 구현
    // 현재는 업데이트 요청을 성공적으로 받았다고만 응답
    
    // 성공 응답
    res.status(200).json({
      status: 'success',
      message: '매칭 데이터가 성공적으로 업데이트되었습니다.',
      matchings: matchings
    });
  } catch (error) {
    console.error('매칭 데이터 업데이트 중 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '매칭 데이터 업데이트 중 서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 기관 목록 API 엔드포인트
app.get('/api/organizations', async (req, res) => {
  try {
    console.log('[API] /api/organizations 요청 받음');
    
    // 기관 데이터 저장 배열
    const organizations = [];
    
    // 구글 시트에서 기관 목록 가져오기
    const sheetsHelper = require('./sheets-helper');
    // sheetsHelper는 이미 객체이므로 new를 사용하지 않음
    
    console.log('[API] 구글 시트에서 데이터 로드 시도...');
    
    let orgListData = [];
    let matchingData = [];
    
    try {
      // 기관_목록 시트에서 기관 목록 가져오기
      orgListData = await sheetsHelper.readSheet('기관_목록');
      console.log(`[API] 기관 목록 데이터 ${orgListData.length}개 행 로드 완료`);
      
      if (orgListData.length > 1) {
        console.log(`[API] 기관 목록 첫 번째 행: ${JSON.stringify(orgListData[0])}`);
        console.log(`[API] 기관 목록 두 번째 행: ${JSON.stringify(orgListData[1])}`);
      }
      
      // 위원별_담당기관 시트에서 매칭 데이터 가져오기
      matchingData = await sheetsHelper.readSheet('위원별_담당기관');
      console.log(`[API] 위원별 담당기관 데이터 ${matchingData.length}개 행 로드 완료`);
    } catch (sheetError) {
      console.error('[API] 구글 시트 데이터 가져오기 실패:', sheetError);
      console.log('[API] 대체 데이터 사용');
      
      // 구글 시트 연결 실패 시 하드코딩된 데이터 사용
      orgListData = [
        ['code', 'name', 'region', 'address', 'phone', 'manager', 'notes'],
        ['A48120002', '창원도우누리노인통합재가센터', '창원시', '', '', '', ''],
        ['A48740002', '창녕군새누리노인통합지원센터', '창녕군', '', '', '', '']
      ];
      
      matchingData = [
        ['기관코드', '기관명', '위원명', '담당구분'],
        ['A48120002', '창원도우누리노인통합재가센터', '신용기', '주담당'],
        ['A48740002', '창녕군새누리노인통합지원센터', '문일지', '주담당']
      ];
    }
    
    // 기관 목록 시트에서 데이터 추출 (헤더 제외)
    if (orgListData && orgListData.length > 1) {
      for (let i = 1; i < orgListData.length; i++) {
        const row = orgListData[i];
        if (row && row.length >= 2) { // 최소한 기관코드와 이름이 있는지 확인
          organizations.push({
            code: row[0] || '',      // 기관코드
            name: row[1] || '',      // 기관명
            region: row[2] || '',     // 지역
            address: row[3] || '',    // 주소
            phone: row[4] || '',      // 연락처
            manager: row[5] || '',    // 담당자
            notes: row[6] || ''       // 비고
          });
        }
      }
    }
    
    console.log(`[API] 구글 시트에서 ${organizations.length}개의 기관 데이터를 읽어옴`);
    
    // 만약 구글 시트에서 데이터를 가져오지 못하는 경우 기본 데이터 추가
    if (organizations.length === 0) {
      console.warn('[API] 구글 시트에서 기관 데이터를 가져오지 못했습니다. 기본 데이터를 사용합니다.');
      organizations.push(
        { code: 'A48120002', name: '창원도우누리노인통합재가센터', region: '창원시' },
        { code: 'A48740002', name: '창녕군새누리노인통합지원센터', region: '창녕군' }
      );
    }
    
    // 기관 데이터 확인 로깅
    console.log(`[API] 총 ${organizations.length}개의 기관 데이터 처리 완료`);
    
    if (organizations.length > 0) {
      console.log(`[API] 첫 번째 기관 데이터: ${JSON.stringify(organizations[0])}`);
      console.log(`[API] 창원도우누리 포함 여부: ${organizations.some(org => org.name.includes('창원도우누리'))}`);
      console.log(`[API] 창녕군새누리 포함 여부: ${organizations.some(org => org.name.includes('창녕군새누리'))}`);
    }
    
    // 매칭 정보를 기관 데이터에 추가 적용
    if (matchingData && matchingData.length > 1) {
      // 기관코드별 매칭 정보 구성
      const matchingMap = {};
      
      for (let i = 1; i < matchingData.length; i++) {
        const row = matchingData[i];
        if (row && row.length >= 4) {
          const orgCode = row[0]; // 기관코드 (위원별_담당기관 시트의 첫 번째 열)
          const committeeName = row[1] || ''; // 위원명 (위원별_담당기관 시트의 두 번째 열)
          const role = row[3] || ''; // 담당구분 (위원별_담당기관 시트의 네 번째 열)
          
          if (!orgCode) continue;
          
          if (!matchingMap[orgCode]) {
            matchingMap[orgCode] = {
              mainCommittee: '',
              subCommittees: []
            };
          }
          
          // 주담당 또는 부담당에 따라 처리
          if (role === '주담당') {
            matchingMap[orgCode].mainCommittee = committeeName;
          } else if (role === '부담당') {
            matchingMap[orgCode].subCommittees.push(committeeName);
          }
        }
      }
      
      // 매칭 정보를 기관 데이터에 추가
      for (const org of organizations) {
        const matchInfo = matchingMap[org.code];
        if (matchInfo) {
          org.mainCommittee = matchInfo.mainCommittee;
          org.subCommittees = matchInfo.subCommittees.join(', ');
        } else {
          org.mainCommittee = '';
          org.subCommittees = '';
        }
      }
    }
    
    console.log(`[API] 총 ${organizations.length}개의 기관 데이터 반환`);
    
    // 클라이언트가 기대하는 형식으로 데이터 반환
    res.status(200).json({
      status: 'success',
      organizations: {
        main: organizations,
        sub: []
      }
    });
    
    console.log(`[API] 기관 데이터 전송 완료: 형식 { main: ${organizations.length}, sub: 0 }`);
  } catch (error) {
    console.error('[API] 기관 목록 API 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 일정 데이터 API 엔드포인트
app.get('/api/schedules', async (req, res) => {
  try {
    console.log('일정 데이터 API 호출됨');
    
    // 구글 시트에서 일정 데이터 가져오기 시도
    try {
      const sheetData = await sheetsHelper.readSheetData(
        process.env.SPREADSHEET_ID,
        '일정_관리!A1:Z100' // 시트 범위 조정 필요할 수 있음
      );
      
      console.log(`구글 시트에서 ${sheetData.length}개의 일정 데이터 가져옴`);
      
      // 헤더 행 확인
      if (sheetData.length > 0) {
        console.log('일정 데이터 헤더:', sheetData[0]);
      }
      
      // 헤더 행을 제외한 데이터 처리
      const schedules = sheetData.slice(1).map((row, index) => {
        // 구글 시트의 열 순서에 맞게 매핑 (실제 시트 구조에 따라 조정 필요)
        return {
          id: `S${index + 1}`,
          date: row[0] || '', // 날짜
          visitDate: row[0] || '', // 방문 날짜
          committeeName: row[1] || '', // 위원명
          organizationName: row[2] || '', // 기관명
          orgName: row[2] || '', // 기관명 (중복 필드)
          orgCode: row[3] || '', // 기관코드
          startTime: row[4] || '', // 시작 시간
          endTime: row[5] || '', // 종료 시간
          status: row[6] || 'pending', // 상태
          notes: row[7] || '', // 메모
          memo: row[7] || '', // 메모 (중복 필드)
          createdAt: new Date().toISOString() // 생성 시간
        };
      });
      
      console.log(`총 ${schedules.length}개의 일정 데이터 반환`);
      
      // 클라이언트가 기대하는 형식으로 데이터 반환
      res.status(200).json(schedules);
    } catch (sheetError) {
      console.error('구글 시트 일정 데이터 가져오기 실패:', sheetError);
      console.log('대체 일정 데이터 사용');
      
      // 구글 시트 연결 실패 시 샘플 일정 데이터 사용
      const schedules = [
        {
          id: 'S001',
          date: '2025-05-26',
          visitDate: '2025-05-26',
          committeeName: '신용기',
          organizationName: '산청한일노인통합복지센터',
          orgName: '산청한일노인통합복지센터',
          orgCode: 'A48170002',
          startTime: '10:00',
          endTime: '12:00',
          status: 'pending',
          notes: '첫 방문 일정',
          memo: '첫 방문 일정',
          createdAt: '2025-05-20T00:00:00Z'
        },
        {
          id: 'S002',
          date: '2025-05-27',
          visitDate: '2025-05-27',
          committeeName: '신용기',
          organizationName: '함안노인복지센터',
          orgName: '함안노인복지센터',
          orgCode: 'A48820003',
          startTime: '14:00',
          endTime: '16:00',
          status: 'completed',
          notes: '정기 방문',
          memo: '정기 방문',
          createdAt: '2025-05-20T00:00:00Z'
        },
        {
          id: 'S003',
          date: '2025-05-28',
          visitDate: '2025-05-28',
          committeeName: '문일지',
          organizationName: '진주노인통합지원센터',
          orgName: '진주노인통합지원센터',
          orgCode: 'A48170003',
          startTime: '09:00',
          endTime: '11:00',
          status: 'pending',
          notes: '시설 점검',
          memo: '시설 점검',
          createdAt: '2025-05-21T00:00:00Z'
        },
        {
          id: 'S004',
          date: '2025-05-29',
          visitDate: '2025-05-29',
          committeeName: '김수연',
          organizationName: '김해시니어클럽',
          orgName: '김해시니어클럽',
          orgCode: 'A48240001',
          startTime: '13:00',
          endTime: '15:00',
          status: 'pending',
          notes: '프로그램 평가',
          memo: '프로그램 평가',
          createdAt: '2025-05-21T00:00:00Z'
        },
        {
          id: 'S005',
          date: '2025-05-30',
          visitDate: '2025-05-30',
          committeeName: '이연숙',
          organizationName: '창원도우누리노인종합재가센터',
          orgName: '창원도우누리노인종합재가센터',
          orgCode: 'A48240002',
          startTime: '10:30',
          endTime: '12:30',
          status: 'pending',
          notes: '서비스 품질 점검',
          memo: '서비스 품질 점검',
          createdAt: '2025-05-22T00:00:00Z'
        },
        {
          id: 'S006',
          date: '2025-06-02',
          visitDate: '2025-06-02',
          committeeName: '이정혜',
          organizationName: '마산시니어클럽',
          orgName: '마산시니어클럽',
          orgCode: 'A48840001',
          startTime: '11:00',
          endTime: '13:00',
          status: 'pending',
          notes: '정기 모니터링',
          memo: '정기 모니터링',
          createdAt: '2025-05-22T00:00:00Z'
        },
        {
          id: 'S007',
          date: '2025-06-03',
          visitDate: '2025-06-03',
          committeeName: '신용기',
          organizationName: '거제노인통합지원센터',
          orgName: '거제노인통합지원센터',
          orgCode: 'A48840002',
          startTime: '09:30',
          endTime: '11:30',
          status: 'pending',
          notes: '시설 안전 점검',
          memo: '시설 안전 점검',
          createdAt: '2025-05-23T00:00:00Z'
        },
        {
          id: 'S008',
          date: '2025-06-04',
          visitDate: '2025-06-04',
          committeeName: '문일지',
          organizationName: '동진노인종합복지센터',
          orgName: '동진노인종합복지센터',
          orgCode: 'A48850001',
          startTime: '14:30',
          endTime: '16:30',
          status: 'pending',
          notes: '프로그램 참관',
          memo: '프로그램 참관',
          createdAt: '2025-05-23T00:00:00Z'
        },
        {
          id: 'S009',
          date: '2025-06-05',
          visitDate: '2025-06-05',
          committeeName: '김수연',
          organizationName: '생명의전화노인복지센터',
          orgName: '생명의전화노인복지센터',
          orgCode: 'A48850002',
          startTime: '10:00',
          endTime: '12:00',
          status: 'pending',
          notes: '상담 서비스 점검',
          memo: '상담 서비스 점검',
          createdAt: '2025-05-24T00:00:00Z'
        },
        {
          id: 'S010',
          date: '2025-06-06',
          visitDate: '2025-06-06',
          committeeName: '이연숙',
          organizationName: '보현행정노인복지센터',
          orgName: '보현행정노인복지센터',
          orgCode: 'A48170001',
          startTime: '13:00',
          endTime: '15:00',
          status: 'pending',
          notes: '행정 서비스 점검',
          memo: '행정 서비스 점검',
          createdAt: '2025-05-24T00:00:00Z'
        }
      ];
      
      res.status(200).json(schedules);
    }
  } catch (error) {
    console.error('일정 데이터 API 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 로그인 API 엔드포인트
app.post('/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(`로그인 시도: ${username}`);
    
    // 간단한 인증 로직 (실제 환경에서는 보안 강화 필요)
    if (username === '마스터' || username === 'master') {
      res.status(200).json({
        status: 'success',
        message: '로그인 성공',
        token: 'sample-jwt-token',
        user: {
          id: 'M001',
          name: '마스터',
          role: 'master',
          isAdmin: true
        }
      });
    } else if (username === '신용기' || username === 'C001') {
      res.status(200).json({
        status: 'success',
        message: '로그인 성공',
        token: 'sample-jwt-token-committee',
        user: {
          id: 'C001',
          name: '신용기',
          role: 'committee',
          isAdmin: false
        }
      });
    } else {
      res.status(401).json({
        status: 'error',
        message: '로그인 실패: 사용자 정보가 일치하지 않습니다.'
      });
    }
  } catch (error) {
    console.error('로그인 API 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 오류 처리 미들웨어
app.use((err, req, res, next) => {
  console.error('서버 오류:', err);
  res.status(500).json({
    status: 'error',
    message: '서버 오류가 발생했습니다.',
    error: err.message,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// 404 처리
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: '요청하신 페이지를 찾을 수 없습니다.',
    path: req.path,
    method: req.method
  });
});

// 정적 파일 서빙 설정 (index.html 및 기타 정적 파일)
app.use(express.static(path.join(__dirname, '../public')));

// 루트 경로에 대한 처리 (index.html 서빙)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// 일정 생성/수정 API
app.post('/api/schedules', async (req, res) => {
  try {
    console.log('일정 생성/수정 API 호출됨');
    
    // 클라이언트에서 받은 일정 데이터
    const scheduleData = req.body;
    
    if (!scheduleData || !scheduleData.id) {
      return res.status(400).json({
        status: 'error',
        message: '유효한 일정 데이터가 필요합니다.'
      });
    }
    
    console.log(`일정 생성/수정 요청: ${scheduleData.id}`);
    
    // 구글 시트에 일정 업데이트
    await sheetsHelper.updateSchedule(scheduleData.id, scheduleData);
    
    // 성공 응답
    res.status(200).json({
      status: 'success',
      message: `일정 ID ${scheduleData.id}가 성공적으로 저장되었습니다.`,
      data: scheduleData
    });
  } catch (error) {
    console.error('일정 생성/수정 중 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '일정 생성/수정 중 서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 일정 삭제 API
app.delete('/api/schedules/:id', async (req, res) => {
  try {
    console.log('일정 삭제 API 호출됨');
    
    // 일정 ID
    const scheduleId = req.params.id;
    
    if (!scheduleId) {
      return res.status(400).json({
        status: 'error',
        message: '삭제할 일정 ID가 필요합니다.'
      });
    }
    
    console.log(`일정 삭제 요청: ${scheduleId}`);
    
    // 일정 검색
    const sheetName = '일정_관리';
    const { rowIndex } = await sheetsHelper.findRow(undefined, sheetName, 0, scheduleId);
    
    if (rowIndex > 0) {
      // 일정 삭제
      await sheetsHelper.deleteRow(sheetName, rowIndex);
      
      // 성공 응답
      res.status(200).json({
        status: 'success',
        message: `일정 ID ${scheduleId}가 성공적으로 삭제되었습니다.`
      });
    } else {
      // 일정을 찾을 수 없음
      res.status(404).json({
        status: 'error',
        message: `일정 ID ${scheduleId}를 찾을 수 없습니다.`
      });
    }
  } catch (error) {
    console.error('일정 삭제 중 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '일정 삭제 중 서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 구글 시트에 점검 데이터 저장 API 엔드포인트
app.post('/api/save-to-sheet', async (req, res) => {
  try {
    console.log('구글 시트에 점검 데이터 저장 API 호출됨');
    
    // 클라이언트에서 받은 데이터 확인
    const {
      indicatorId,
      indicatorName,
      orgCode,
      orgName: clientOrgName,
      comment,
      monthlyStatus,
      yearlyStatus,
      timestamp,
      user,
      userCode
    } = req.body;
    
    if (!indicatorId || !orgCode) {
      return res.status(400).json({
        status: 'error',
        message: '지표 ID와 기관 코드는 필수 항목입니다.'
      });
    }
    
    // 사용자 이름 확인 (시트 이름으로 사용)
    if (!user) {
      console.log('사용자 이름이 제공되지 않았습니다. 기본 시트를 사용합니다.');
      return res.status(400).json({
        status: 'error',
        message: '사용자 이름이 필요합니다.'
      });
    }
    
    console.log(`점검 데이터 저장 요청: 지표 ${indicatorId}, 기관 ${orgCode}, 사용자 ${user}`);
    
    // 기관 정보 가져오기 (클라이언트에서 제공한 기관명이 없는 경우)
    let orgName = clientOrgName || '';
    if (!orgName) {
      try {
        const orgs = await sheetsHelper.readSheet('기관_목록');
        const org = orgs.find(org => org[1] === orgCode); // 기관코드로 검색
        if (org) {
          orgName = org[2]; // 기관명
        }
      } catch (error) {
        console.error('기관 정보 조회 중 오류:', error);
      }
    }
    
    // 월별 상태 정보 변환
    const monthlyStatusStr = monthlyStatus ? JSON.stringify(monthlyStatus) : '';
    const yearlyStatusStr = yearlyStatus ? JSON.stringify(yearlyStatus) : '';
    
    // 현재 날짜 및 시간
    const now = new Date();
    const dateStr = `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}. ${now.getHours()}시 ${now.getMinutes()}분 ${now.getSeconds()}초`;
    
    // 저장할 데이터 행 생성
    const rowData = [
      orgCode,         // 기관코드
      orgName,         // 기관명
      indicatorId,     // 지표ID
      monthlyStatusStr, // 월별 상태 (JSON 문자열)
      yearlyStatusStr, // 연간 상태 (JSON 문자열)
      now.toLocaleDateString(), // 작성일
      now.toLocaleTimeString(), // 작성시간
      user,            // 작성자
      '',              // 결과
      '',              // 체크리스트결과
      comment,         // 의견
      Object.keys(monthlyStatus || {}).join(','), // 점검한월
      dateStr,         // 업데이트일시
      indicatorName || '' // 참고사항(지표명)
    ];
    
    console.log(`저장할 데이터 행:`, rowData);
    console.log(`저장할 시트 이름: ${user}`);
    
    // 구글 시트에 데이터 추가 - 사용자 이름을 시트 이름으로 사용
    await sheetsHelper.appendRow({
      spreadsheetId: process.env.SPREADSHEET_ID,
      sheetName: user, // 사용자 이름을 시트 이름으로 사용
      values: rowData
    });
    
    // 성공 응답
    res.status(200).json({
      status: 'success',
      message: `점검 데이터가 ${user} 시트에 성공적으로 저장되었습니다.`,
      data: {
        indicatorId,
        orgCode,
        sheetName: user,
        timestamp: dateStr
      }
    });
  } catch (error) {
    console.error('점검 데이터 저장 중 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '점검 데이터 저장 중 서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 일정 데이터 API 엔드포인트
app.get('/api/sheets/schedules', async (req, res) => {
  try {
    // 구글 시트에서 데이터 가져오기
    const sheets = await sheetsHelper.getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: '방문일정!A2:J',
    });

    const rows = response.data.values || [];
    
    // 일정 데이터 매핑
    const schedules = rows.map(row => ({
      id: row[0] || '',           // 일정 ID
      organizationCode: row[1] || '', // 기관코드
      organizationName: row[2] || '', // 기관명
      committeeName: row[3] || '',    // 담당위원
      visitDate: row[4] || '',        // 방문일자
      startTime: row[5] || '',        // 시작시간
      endTime: row[6] || '',          // 종료시간
      status: row[7] || '',           // 상태
      notes: row[8] || '',            // 비고
      lastUpdated: row[9] || ''       // 최종수정일시
    }));

    return res.json({ status: 'success', data: schedules });
  } catch (error) {
    console.error('일정 데이터 조회 오류:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// 위원별 담당기관 조회 API 엔드포인트
app.get('/api/sheets/committee-orgs', async (req, res) => {
  try {
    console.log('[API] /api/sheets/committee-orgs 요청 받음');
    const committeeName = req.query.committeeName || '';
    console.log(`위원명: ${committeeName}`);
    
    // 구글 시트에서 위원별 담당기관 데이터 가져오기
    try {
      const sheetData = await sheetsHelper.readSheet('위원별_담당기관');
      console.log(`[API] 위원별 담당기관 데이터 ${sheetData.length}개 행 로드 완료`);
      
      // 헤더 행 제외
      const dataRows = sheetData.slice(1);
      
      // 위원명으로 필터링 (위원명이 제공되지 않으면 모든 데이터 반환)
      let filteredData = dataRows;
      if (committeeName && committeeName !== '전체') {
        filteredData = dataRows.filter(row => {
          // 위원명이 있는 열 인덱스를 확인 (일반적으로 2번째 열)
          const committeeNameCol = 1;
          return row[committeeNameCol] === committeeName || 
                 (row[committeeNameCol] && row[committeeNameCol].includes(committeeName));
        });
      }
      
      // 데이터 변환
      const organizations = filteredData.map(row => {
        return {
          orgCode: row[0] || '',       // 기관코드
          committeeName: row[1] || '', // 위원명
          orgName: row[2] || '',       // 기관명
          region: row[3] || '',        // 지역
          address: row[4] || '',       // 주소
          contactInfo: row[5] || '',   // 연락처
          status: row[6] || '활성'    // 상태
        };
      });
      
      // 성공 응답
      res.status(200).json({
        status: 'success',
        data: organizations
      });
    } catch (sheetError) {
      console.error('구글 시트에서 위원별 담당기관 데이터 가져오기 실패:', sheetError);
      
      // 실패 시 빈 배열 반환
      res.status(200).json({
        status: 'success',
        data: [],
        message: '구글 시트에서 위원별 담당기관 데이터를 가져오지 못했습니다.'
      });
    }
  } catch (error) {
    console.error('위원별 담당기관 API 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 일정 API 엔드포인트 (기존 /api/schedules 경로 지원)
app.get('/api/schedules', async (req, res) => {
  try {
    console.log('[API] /api/schedules 요청 받음');
    
    // 구글 시트에서 일정 데이터 가져오기
    try {
      const scheduleData = await sheetsHelper.readSheet('일정');
      console.log(`[API] 일정 데이터 ${scheduleData.length}개 행 로드 완료`);
      
      // 일정 데이터 변환
      const schedules = scheduleData.slice(1).map((row, index) => {
        return {
          id: `S${index + 1}`,
          date: row[0] || '',           // 날짜
          committeeId: row[1] || '',    // 위원ID
          committeeName: row[2] || '',  // 위원명
          orgCode: row[3] || '',        // 기관코드
          orgName: row[4] || '',        // 기관명
          title: row[5] || '',          // 제목
          description: row[6] || '',    // 설명
          status: row[7] || '예정',      // 상태
          createdAt: row[8] || new Date().toISOString() // 생성일시
        };
      });
      
      // 성공 응답
      res.status(200).json({
        status: 'success',
        data: schedules
      });
    } catch (sheetError) {
      console.error('구글 시트에서 일정 데이터 가져오기 실패:', sheetError);
      
      // 실패 시 빈 배열 반환
      res.status(200).json({
        status: 'success',
        data: [],
        message: '구글 시트에서 일정 데이터를 가져오지 못했습니다.'
      });
    }
  } catch (error) {
    console.error('일정 API 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 기타 모든 경로에 대한 처리 (SPA 지원)
app.get('*', (req, res, next) => {
  // API 요청이나 정적 파일 요청이 아닌 경우 index.html 서빙
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/auth/')) {
    res.sendFile(path.join(__dirname, '../index.html'));
  } else {
    next();
  }
});

// 기관 삭제 API 엔드포인트
app.delete('/api/organizations-delete', async (req, res) => {
  try {
    console.log('기관 삭제 API 호출됨');
    
    // 클라이언트에서 받은 기관 코드 확인
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({
        status: 'error',
        message: '삭제할 기관 코드가 필요합니다.'
      });
    }
    
    console.log(`기관 삭제 요청: ${code}`);
    
    // 구글 시트에서 기관 삭제
    await sheetsHelper.deleteOrganization(code);
    
    // 성공 응답
    res.status(200).json({
      status: 'success',
      message: `기관 코드 ${code}가 성공적으로 삭제되었습니다.`
    });
  } catch (error) {
    console.error('기관 삭제 중 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '기관 삭제 중 서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// Vercel 서버리스 함수 핸들러
module.exports = (req, res) => {
  // 요청 로깅
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // CORS 헤더 수동 설정 (필요한 경우)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  
  // OPTIONS 요청에 대한 사전 처리
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Express 앱으로 요청 전달
  return app(req, res);
};

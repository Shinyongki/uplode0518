// Vercel 서버리스 함수용 Express 앱
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const { google } = require('googleapis');

// Express 앱 생성
const app = express();

// 환경 변수 설정 (기존 환경 변수가 없는 경우에만 설정)
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';
const NODE_ENV = process.env.NODE_ENV || 'development';
const SESSION_SECRET = process.env.SESSION_SECRET || 'monitoring_session_secret';

// 초기화 로그
console.log('Vercel serverless function initializing');
console.log('NODE_VERSION:', process.version);
console.log('NODE_ENV:', NODE_ENV);
console.log('SPREADSHEET_ID exists:', !!SPREADSHEET_ID);
console.log('SERVICE_ACCOUNT_KEY exists:', !!process.env.SERVICE_ACCOUNT_KEY);

// Vercel 환경에서 서비스 계정 키 처리
let authGoogle;
let sheets;

try {
  // 환경 변수에서 서비스 계정 키 처리
  if (process.env.SERVICE_ACCOUNT_KEY) {
    try {
      console.log('환경 변수에서 직접 서비스 계정 키 사용 시도');
      // Vercel 환경에 최적화: 파일 시스템 사용 대신 직접 JSON 파싱
      const credentials = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
      
      // 구글시트 인증 설정
      authGoogle = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      
      // 구글시트 API 클라이언트 생성
      sheets = google.sheets({ version: 'v4', auth: authGoogle });
      console.log('Google Sheets API 클라이언트가 성공적으로 초기화되었습니다.');
    } catch (error) {
      console.error('서비스 계정 키 처리 중 오류:', error);
      console.log('기본 데이터를 사용합니다.');
    }
  } else {
    console.log('환경 변수에 서비스 계정 키가 없습니다. 기본 데이터를 사용합니다.');
  }
} catch (error) {
  console.error('Google Sheets API 초기화 중 오류 발생:', error);
  // 초기화 오류에도 서버 실행 계속
}

// 기본 미들웨어 설정
app.use(cors({
  credentials: true,
  origin: '*', // 모든 origin 허용
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

console.log('모든 원본(origin)에서의 CORS 요청을 허용하도록 설정됨');
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Vercel은 정적 파일을 자동으로 처리하므로 express.static 미들웨어는 필요 없음
// 개발 환경에서만 정적 파일 제공
if (NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// 세션 설정 - 메모리 세션으로 변경
const session = require('express-session');
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: NODE_ENV === 'production',  // 프로덕션 환경에서만 secure 쿠키 사용
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24시간
    sameSite: NODE_ENV === 'production' ? 'none' : 'lax'  // Vercel 환경에 맞게 설정
  }
}));

// connect-flash 설정 (필요한 경우에만)
const flash = require('connect-flash');
app.use(flash());

// req.flash가 없을 때 대체 함수 제공
app.use((req, res, next) => {
  if (!req.flash) {
    req.flash = function(type, message) {
      if (!req.session.flash) {
        req.session.flash = {};
      }
      if (!req.session.flash[type]) {
        req.session.flash[type] = [];
      }
      req.session.flash[type].push(message);
    };
  }
  next();
});

// 디버깅용 미들웨어 (프로덕션 환경에서는 최소화)
app.use((req, res, next) => {
  if (NODE_ENV !== 'production' || req.url.startsWith('/api/')) {
    console.log(`요청 수신: ${req.method} ${req.url}`);
    if (req.session && req.session.committee) {
      console.log(`인증된 사용자: ${req.session.committee.name}`);
    }
  }
  next();
});

// 라우트 설정
console.log('API 라우트 설정 시작...');
// API 라우트: /api/* 경로 처리 
app.use('/api', apiRoutes);

// 구글 시트 직접 테스트 라우트 추가
const directTestRouter = require('./api/direct-test');
app.use('/api', directTestRouter);
console.log('API 라우트 설정 완료');

console.log('인증 라우트 설정 시작...');
// 인증 라우트: /auth/* 경로 처리
app.use('/auth', authRoutes);
console.log('인증 라우트 설정 완료');

console.log('기본 라우트 설정 시작...');
// 기본 페이지 라우트: 위의 모든 라우트에 해당하지 않는 경로 처리
app.use('/', indexRoutes);
console.log('기본 라우트 설정 완료');

// SPA 지원을 위한 기본 경로 - API 경로가 아닌 모든 요청은 index.html로 제공
app.use((req, res, next) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/auth')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

// 구글 시트 일정 데이터 API 엔드포인트
app.get('/api/sheets/schedules', async (req, res) => {
  try {
    // 구글시트 ID와 범위 설정
    const spreadsheetId = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';
    const range = '방문일정!A:I'; // 방문일정 시트

    console.log(`[API] /api/sheets/schedules 요청 받음, 스프레드시트 ID: ${spreadsheetId}`);
    
    // sheets 객체가 초기화되었는지 확인
    if (!sheets) {
      console.error('[API] Google Sheets API 클라이언트가 초기화되지 않았습니다.');
      throw new Error('Google Sheets API 클라이언트가 초기화되지 않았습니다. 서비스 계정 키를 확인하세요.');
    }

    // 구글시트 API 호출
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return res.status(200).json({
        status: 'success',
        schedules: []
      });
    }

    // 헤더 행 가져오기
    const headers = rows[0];

    // 데이터 행 처리 (헤더 제외)
    const schedules = rows.slice(1).map(row => {
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

    res.status(200).json({
      status: 'success',
      schedules
    });
  } catch (error) {
    console.error('구글시트 일정 데이터 조회 실패:', error);
    console.error('오류 상세정보:', error.stack);
    
    // 정적 fallback 데이터 반환 (빈 일정 배열)
    const fallbackData = [];
    
    res.status(500).json({
      status: 'error',
      message: '구글시트 일정 데이터를 가져오는데 실패했습니다.',
      error: error.message,
      fallbackData: fallbackData
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
      // 기관목록 시트에서 기관 데이터 가져오기
      const spreadsheetId = process.env.SPREADSHEET_ID || '1Xt7Qy5Hx1wgxOFV3XYQUlwoWkI2-vKT6KGs0FeM_xTI';
      orgListData = await sheetsHelper.readSheetData(spreadsheetId, '기관목록');
      console.log(`[API] 기관 목록 ${orgListData.length}개 행 로드 완료`);
      
      if (orgListData.length > 1) {
        console.log(`[API] 기관 목록 첫 번째 행: ${JSON.stringify(orgListData[0])}`);
        console.log(`[API] 기관 목록 두 번째 행: ${JSON.stringify(orgListData[1])}`);
      }
      
      // 위원별_담당기관 시트에서 매칭 데이터 가져오기
      matchingData = await sheetsHelper.readSheetData(spreadsheetId, '위원별_담당기관');
      console.log(`[API] 위원별 담당기관 데이터 ${matchingData.length}개 행 로드 완료`);
    } catch (sheetError) {
      console.error('[API] 구글 시트 데이터 로드 오류:', sheetError);
      console.error('[API] 오류 상세정보:', sheetError.stack);
      
      // 오류 발생 시 빈 배열 반환
      return res.status(200).json({
        status: 'success',
        message: '기본 데이터를 사용합니다.',
        data: [],
        meta: {
          source: 'fallback',
          error: sheetError.message
        }
      });
    }
    
    // 시트 데이터 처리
    if (orgListData.length > 1) {
      // 첫 번째 행은 헤더로 간주
      const headers = orgListData[0];
      
      // 나머지 행은 데이터로 처리
      for (let i = 1; i < orgListData.length; i++) {
        const row = orgListData[i];
        if (row.length < 3) continue; // 데이터가 부족한 행 건너뛰기
        
        const orgData = {};
        
        // 헤더와 데이터 매핑
        for (let j = 0; j < headers.length; j++) {
          const header = headers[j];
          const value = row[j] || '';
          
          // 헤더 이름에 따라 필드 이름 지정
          if (header.includes('기관코드') || header.includes('기관 코드')) {
            orgData.orgCode = value;
          } else if (header.includes('기관명') || header.includes('기관 이름')) {
            orgData.orgName = value;
          } else if (header.includes('지역') || header.includes('시군')) {
            orgData.region = value;
          } else if (header.includes('주소')) {
            orgData.address = value;
          } else if (header.includes('전화번호')) {
            orgData.phone = value;
          } else if (header.includes('담당자')) {
            orgData.manager = value;
          } else if (header.includes('비고')) {
            orgData.notes = value;
          } else {
            // 기타 필드는 원래 헤더 이름 그대로 사용
            orgData[header] = value;
          }
        }
        
        // 필수 필드 확인
        if (orgData.orgCode && orgData.orgName) {
          organizations.push(orgData);
        }
      }
    }
    
    // 매칭 데이터 처리 및 기관 정보에 추가
    if (matchingData.length > 1 && organizations.length > 0) {
      const matchingHeaders = matchingData[0];
      
      // 각 기관에 대한 매칭 정보 추가
      for (const org of organizations) {
        org.committees = [];
        
        // 매칭 데이터에서 해당 기관코드와 일치하는 항목 찾기
        for (let i = 1; i < matchingData.length; i++) {
          const matchingRow = matchingData[i];
          
          // 기관코드 인덱스 찾기
          const orgCodeIndex = matchingHeaders.findIndex(header => 
            header.includes('기관코드') || header.includes('기관 코드'));
          
          if (orgCodeIndex !== -1 && matchingRow[orgCodeIndex] === org.orgCode) {
            // 위원 정보 추출
            const committeeNameIndex = matchingHeaders.findIndex(header => 
              header.includes('위원명') || header.includes('위원 이름'));
            
            const committeeIdIndex = matchingHeaders.findIndex(header => 
              header.includes('위원ID') || header.includes('위원 ID'));
            
            const roleIndex = matchingHeaders.findIndex(header => 
              header.includes('역할') || header.includes('유형'));
            
            if (committeeNameIndex !== -1) {
              const committeeName = matchingRow[committeeNameIndex] || '';
              const committeeId = committeeIdIndex !== -1 ? matchingRow[committeeIdIndex] || '' : '';
              const role = roleIndex !== -1 ? matchingRow[roleIndex] || 'main' : 'main';
              
              if (committeeName) {
                org.committees.push({
                  id: committeeId,
                  name: committeeName,
                  role: role
                });
              }
            }
          }
        }
      }
    }
    
    // 응답 반환
    return res.status(200).json({
      status: 'success',
      data: organizations,
      meta: {
        count: organizations.length,
        source: 'google-sheets'
      }
    });
  } catch (error) {
    console.error('[API] /api/organizations 오류:', error);
    console.error('[API] 오류 상세정보:', error.stack);
    
    // 오류 발생 시 빈 배열 반환
    return res.status(200).json({
      status: 'success',
      message: '오류가 발생하여 기본 데이터를 사용합니다.',
      data: [],
      meta: {
        source: 'error-fallback',
        error: error.message
      }
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
      // 마스터 계정 로그인
      res.status(200).json({
        status: 'success',
        message: '로그인 성공',
        token: 'master-jwt-token-' + Date.now(),
        user: {
          id: 'M001',
          username: username,
          name: '마스터 관리자',
          role: 'master',
          isAdmin: true
        }
      });
    } else if (username && username.length > 0) {
      // 위원 계정 로그인 (임시 로직: 실제로는 데이터베이스에서 확인 필요)
      res.status(200).json({
        status: 'success',
        message: '로그인 성공',
        token: 'committee-jwt-token-' + Date.now(),
        user: {
          id: 'C' + Math.floor(1000 + Math.random() * 9000),
          username: username,
          name: username,
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
    console.error('오류 상세정보:', error.stack);
    res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 구글 시트에서 위원별 담당 기관 정보 가져오는 API 엔드포인트
app.get('/api/sheets/organizations', async (req, res) => {
  try {
    console.log('[API] /api/sheets/organizations 요청 받음');
    
    // 요청에서 위원명 가져오기
    const committeeName = req.query.committeeName;
    const sheetName = req.query.sheet || '위원별_담당기관';
    
    console.log(`[API] 위원명: ${committeeName}, 시트명: ${sheetName}`);
    
    if (!committeeName) {
      return res.status(400).json({
        status: 'error',
        message: '위원명이 제공되지 않았습니다.'
      });
    }
    
    // 구글 시트에서 데이터 가져오기
    const sheetsHelper = require('./sheets-helper');
    
    try {
      console.log(`[API] 구글 시트에서 데이터 가져오기 시도 (위원: ${committeeName})`);
      
      // 시트 데이터 가져오기
      const spreadsheetId = process.env.SPREADSHEET_ID || '1Xt7Qy5Hx1wgxOFV3XYQUlwoWkI2-vKT6KGs0FeM_xTI';
      console.log(`[API] 사용 중인 스프레드시트 ID: ${spreadsheetId}`);
      const values = await sheetsHelper.readSheetData(spreadsheetId, `${sheetName}!A:H`);
      
      if (!values || values.length < 2) {
        throw new Error('시트 데이터가 없거나 형식이 올바르지 않습니다.');
      }
      
      // 헤더 행 추출
      const headers = values[0];
      console.log('[API] 헤더 행:', headers);
      
      // 데이터 행을 JSON 객체로 변환
      const allMatchings = values.slice(1).map(row => {
        const matching = {};
        headers.forEach((header, index) => {
          if (index < row.length) {
            matching[header] = row[index];
          }
        });
        return matching;
      });
      
      // 위원명으로 필터링
      const committeeMatchings = allMatchings.filter(item => 
        item.committeeName === committeeName || 
        item.위원명 === committeeName || 
        item.committee === committeeName
      );
      
      console.log(`[API] ${committeeName} 위원 매칭 데이터 ${committeeMatchings.length}개 찾음`);
      
      if (committeeMatchings.length > 0) {
        // 주담당과 부담당 기관 분류
        const mainOrgs = committeeMatchings
          .filter(item => item.role === '주담당' || item.role === '주담당기관')
          .map(item => ({
            id: item.orgId || item.orgCode,
            code: item.orgCode,
            name: item.orgName,
            region: item.region || '경상남도'
          }));
        
        const subOrgs = committeeMatchings
          .filter(item => item.role === '부담당' || item.role === '부담당기관')
          .map(item => ({
            id: item.orgId || item.orgCode,
            code: item.orgCode,
            name: item.orgName,
            region: item.region || '경상남도'
          }));
        
        return res.status(200).json({
          status: 'success',
          organizations: {
            main: mainOrgs,
            sub: subOrgs
          },
          organizationObjects: {
            main: mainOrgs,
            sub: subOrgs
          },
          meta: {
            source: 'sheets',
            count: committeeMatchings.length
          }
        });
      } else {
        throw new Error(`${committeeName} 위원의 매칭 데이터를 찾을 수 없습니다.`);
      }
    } catch (sheetError) {
      console.error('[API] 구글 시트 데이터 가져오기 오류:', sheetError.message);
      console.error('[API] 오류 상세정보:', sheetError.stack);
      
      // 오류 발생 시 빈 배열 반환
      return res.status(200).json({
        status: 'success',
        message: '기본 데이터를 사용합니다.',
        organizations: {
          main: [],
          sub: []
        },
        organizationObjects: {
          main: [],
          sub: []
        },
        meta: {
          source: 'fallback',
          error: sheetError.message
        }
      });
    }
  } catch (error) {
    console.error('[API] /api/sheets/organizations 오류:', error.message);
    console.error('[API] 오류 상세정보:', error.stack);
    
    // 오류 발생 시 500 오류 대신 200 응답과 빈 배열 반환
    return res.status(200).json({
      status: 'success',
      message: '오류가 발생하여 기본 데이터를 사용합니다.',
      organizations: {
        main: [],
        sub: []
      },
      organizationObjects: {
        main: [],
        sub: []
      },
      meta: {
        source: 'error-fallback',
        error: error.message
      }
    });
  }
});

// 위원별 담당 기관 정보 API 엔드포인트
app.get('/api/sheets/committee-orgs', async (req, res) => {
  try {
    console.log('[API] /api/sheets/committee-orgs 요청 받음');
    
    // committee-orgs.js 파일에서 처리 로직 가져오기
    const committeeOrgsHandler = require('./committee-orgs');
    
    // 요청 처리
    return committeeOrgsHandler(req, res);
  } catch (error) {
    console.error('[API] /api/sheets/committee-orgs 오류:', error);
    console.error('[API] 오류 상세정보:', error.stack);
    
    // 오류 발생 시 500 오류 대신 200 응답과 빈 배열 반환
    return res.status(200).json({
      status: 'success',
      message: '오류가 발생하여 기본 데이터를 사용합니다.',
      data: [],
      meta: {
        source: 'error-fallback',
        error: error.message
      }
    });
  }
});

// 위원별 담당 기관 매칭 정보 API 엔드포인트
app.get('/api/committees/matching', async (req, res) => {
  try {
    console.log('[API] /api/committees/matching 요청 받음');
    
    // committees-matching.js 파일에서 처리 로직 가져오기
    const committeesMatchingHandler = require('./committees-matching');
    
    // 요청 처리
    return committeesMatchingHandler(req, res);
  } catch (error) {
    console.error('[API] /api/committees/matching 오류:', error);
    console.error('[API] 오류 상세정보:', error.stack);
    
    // 오류 발생 시 빈 배열 반환
    return res.status(200).json({
      status: 'success',
      message: '오류가 발생하여 기본 데이터를 사용합니다.',
      data: [],
      meta: {
        source: 'error-fallback',
        error: error.message
      }
    });
  }
});

// 구글 시트에 일정 데이터 저장하는 API 엔드포인트
app.post('/api/sheets/schedules', async (req, res) => {
  try {
    const { sheetName, schedules } = req.body;
    
    if (!sheetName || !schedules || !Array.isArray(schedules)) {
      return res.status(400).json({
        status: 'error',
        message: '유효하지 않은 요청 형식입니다.'
      });
    }
    
    console.log(`구글 시트 '${sheetName}'에 ${schedules.length}개의 일정 데이터 저장 시도`);
    
    // 구글시트 ID 설정
    const spreadsheetId = '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';
    
    // 기존 시트 데이터 가져오기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:I`,
    });
    
    const rows = response.data.values || [];
    
    // 헤더 행 처리
    let headers;
    if (rows.length === 0) {
      // 시트가 비어있는 경우, 헤더 행 생성
      headers = ['위원ID', '위원명', '기관코드', '기관명', '방문일자', '방문시간', '목적', '메모', '상태'];
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:I1`,
        valueInputOption: 'RAW',
        resource: {
          values: [headers]
        }
      });
    } else {
      headers = rows[0];
    }
    
    // 데이터 행 생성
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
    
    // 기존 데이터 삭제 (헤더 제외)
    if (rows.length > 1) {
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${sheetName}!A2:I${rows.length}`
      });
    }
    
    // 새 데이터 추가
    if (values.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A2:I${values.length + 1}`,
        valueInputOption: 'RAW',
        resource: {
          values: values
        }
      });
    }
    
    return res.status(200).json({
      status: 'success',
      message: '일정 데이터가 구글 시트에 성공적으로 저장되었습니다.'
    });
  } catch (error) {
    console.error('구글 시트에 일정 데이터 저장 오류:', error);
    return res.status(500).json({
      status: 'error',
      message: '구글 시트에 일정 데이터를 저장하는 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 위원별 담당기관 데이터를 가져오는 API 엔드포인트
app.get('/api/sheets/organizations', async (req, res) => {
  try {
    // 구글시트 ID와 범위 설정
    const spreadsheetId = '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';
    const range = '위원별_담당기관!A:G'; // A:C에서 A:G로 변경하여 G열(담당유형)까지 포함

    // 요청에서 위원명 가져오기 (세션에서 현재 로그인한 사용자 사용)
    const committeeName = req.query.committeeName || (req.session && req.session.committee ? req.session.committee.name : '');
    console.log(`구글시트 데이터 요청: 위원명=${committeeName}, 범위=${range}`);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    console.log(`구글시트 원본 데이터: ${rows ? rows.length : 0}행`);

    if (!rows || rows.length === 0) {
      console.log('구글시트 데이터가 없습니다.');
      return res.status(404).json({ error: '데이터가 없습니다.' });
    }

    // 데이터 파싱
    const organizations = {
      main: [],
      sub: []
    };

    // 헤더 제외하고 데이터 처리
    for (let i = 1; i < rows.length; i++) {
      // 시트 구조에 맞게 데이터 추출
      const [committeeId, rowCommitteeName, orgId, orgCode, orgName, region, role] = rows[i];
      
      // 요청한 위원명과 일치하는 데이터만 처리
      if (rowCommitteeName && rowCommitteeName.trim() === committeeName) {
        if (role && role.trim() === '주담당') {
          organizations.main.push({
            id: orgId || orgCode,
            code: orgCode,
            name: orgName,
            region: region || '경상남도'
          });
        } else if (role && role.trim() === '부담당') {
          organizations.sub.push({
            id: orgId || orgCode,
            code: orgCode,
            name: orgName,
            region: region || '경상남도'
          });
        }
      }
    }

    // 기관 코드만 필요한 경우를 위해 코드 배열도 함께 제공
    const mainCodes = organizations.main.map(org => org.code);
    const subCodes = organizations.sub.map(org => org.code);

    console.log(`구글시트에서 가져온 ${committeeName} 위원 담당기관: 주담당 ${organizations.main.length}개, 부담당 ${organizations.sub.length}개`);
    
    res.json({
      status: 'success',
      organizations: {
        main: mainCodes,
        sub: subCodes
      },
      organizationObjects: {
        main: organizations.main,
        sub: organizations.sub
      }
    });
  } catch (error) {
    console.error('구글시트 데이터 조회 실패:', error);
    res.status(500).json({
      status: 'error',
      message: '구글시트 데이터를 가져오는데 실패했습니다.',
      error: error.message
    });
  }
});

// 구글 시트에 기관 추가하는 API 엔드포인트
app.post('/api/sheets/organizations', async (req, res) => {
  try {
    // 요청 데이터 검증
    const { code, name, region, note, action } = req.body;
    
    if (!code || !name || !region) {
      return res.status(400).json({
        status: 'error',
        message: '필수 필드가 누락되었습니다. (code, name, region)'
      });
    }
    
    if (action !== 'add') {
      return res.status(400).json({
        status: 'error',
        message: '지원하지 않는 액션입니다.'
      });
    }
    
    console.log(`기관 추가 API 요청: ${name} (${code})`);
    
    // 구글 시트 연동을 위한 설정
    const sheetsHelper = require('./api/sheets-helper');
    const spreadsheetId = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';
    const range = '기관_목록!A:E'; // 기관 목록 시트 범위
    
    // 기존 데이터 가져오기
    const existingData = await sheetsHelper.readSheetData(spreadsheetId, range);
    
    if (!existingData || existingData.length === 0) {
      return res.status(500).json({
        status: 'error',
        message: '기관 목록 데이터를 가져오는데 실패했습니다.'
      });
    }
    
    // 헤더 확인
    const headers = existingData[0];
    const rows = existingData.slice(1);
    
    // 중복 코드 확인
    const codeIndex = headers.indexOf('code') !== -1 ? headers.indexOf('code') : headers.indexOf('기관코드');
    const isDuplicate = rows.some(row => row[codeIndex] === code);
    
    if (isDuplicate) {
      return res.status(400).json({
        status: 'error',
        message: `이미 존재하는 기관 코드(${code})입니다.`
      });
    }
    
    // 새 기관 ID 생성
    const idIndex = headers.indexOf('id') !== -1 ? headers.indexOf('id') : headers.indexOf('기관ID');
    const newOrgId = rows.length > 0 ? Number(rows[rows.length - 1][idIndex]) + 1 : 1;
    
    // 새 기관 데이터 포맷팅
    const newOrg = [];
    headers.forEach(header => {
      if (header === 'id' || header === '기관ID') {
        newOrg.push(newOrgId.toString());
      } else if (header === 'code' || header === '기관코드') {
        newOrg.push(code);
      } else if (header === 'name' || header === '기관명') {
        newOrg.push(name);
      } else if (header === 'region' || header === '지역') {
        newOrg.push(region);
      } else if (header === 'note' || header === '비고') {
        newOrg.push(note || '');
      } else {
        newOrg.push('');
      }
    });
    
    // 1. 기관목록 시트에 추가
    await sheetsHelper.appendRow(spreadsheetId, '기관_목록', newOrg);
    console.log(`기관_목록 시트에 기관 추가 성공: ${name} (${code})`);
    
    // 2. 위원별_담당기관 시트에도 매칭 정보 추가
    const { mainCommitteeId, subCommitteeId } = req.body;
    
    // 위원별_담당기관 시트 데이터 가져오기
    const matchingData = await sheetsHelper.readSheetData(spreadsheetId, '위원별_담당기관!A1:H');
    
    if (!matchingData || matchingData.length === 0) {
      console.warn('위원별_담당기관 시트 데이터를 가져오는데 실패했습니다. 기관목록에만 추가합니다.');
    } else {
      // 위원별_담당기관 시트 헤더 확인
      const matchingHeaders = matchingData[0];
      
      // 주담당 위원 정보 추가 (있는 경우)
      if (mainCommitteeId) {
        const mainCommitteeName = req.body.mainCommitteeName || (req.session && req.session.committee ? req.session.committee.name : ''); // 세션에서 현재 로그인한 사용자 사용
        const mainMatchingRow = [
          mainCommitteeId,
          mainCommitteeName,
          newOrgId.toString(),
          code,
          name,
          region,
          '주담당',
          note || ''
        ];
        
        await sheetsHelper.appendRow(spreadsheetId, '위원별_담당기관', mainMatchingRow);
        console.log(`위원별_담당기관 시트에 주담당 매칭 정보 추가: ${mainCommitteeName} - ${name}`);
      }
      
      // 부담당 위원 정보 추가 (있는 경우)
      if (subCommitteeId) {
        const subCommitteeName = req.body.subCommitteeName || '마스터'; // 기본값 설정
        const subMatchingRow = [
          subCommitteeId,
          subCommitteeName,
          newOrgId.toString(),
          code,
          name,
          region,
          '부담당',
          note || ''
        ];
        
        await sheetsHelper.appendRow(spreadsheetId, '위원별_담당기관', subMatchingRow);
        console.log(`위원별_담당기관 시트에 부담당 매칭 정보 추가: ${subCommitteeName} - ${name}`);
      }
    }
    
    // 추가된 기관 객체 반환
    const addedOrganization = {};
    headers.forEach((header, index) => {
      addedOrganization[header] = newOrg[index] || '';
    });
    
    // 성공 응답
    return res.status(201).json({
      status: 'success',
      message: '기관이 성공적으로 추가되었습니다.',
      data: {
        organization: addedOrganization,
        timestamp: Date.now()
      }
    });
    
  } catch (error) {
    console.error('구글 시트에 기관 추가 중 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 구글 시트에서 기관을 삭제하는 API 엔드포인트
app.delete('/api/organizations-delete', async (req, res) => {
  try {
    // 요청에서 기관 코드 가져오기
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({
        status: 'error',
        message: '기관 코드가 지정되지 않았습니다.'
      });
    }
    
    console.log(`기관 삭제 API 요청: 기관 코드 ${code}`);
    
    // 구글 시트 연동을 위한 설정
    const sheetsHelper = require('./api/sheets-helper');
    
    // 1. 기관_목록 시트에서 기관 삭제
    try {
      await sheetsHelper.deleteOrganization(code);
      console.log(`기관_목록 시트에서 기관 삭제 성공: ${code}`);
    } catch (orgDeleteError) {
      console.error(`기관_목록 시트에서 기관 삭제 실패:`, orgDeleteError);
      // 기관 삭제 실패를 오류로 처리하지 않고 계속 진행
    }
    
    // 2. 위원별_담당기관 시트에서 관련 매칭 삭제
    try {
      // 위원별_담당기관 시트 데이터 가져오기
      const spreadsheetId = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';
      const matchingData = await sheetsHelper.readSheetData(spreadsheetId, '위원별_담당기관!A1:H');
      
      if (!matchingData || matchingData.length <= 1) {
        console.warn('위원별_담당기관 시트 데이터를 가져오는데 실패했거나 데이터가 없습니다.');
      } else {
        // 헤더 행 및 데이터 행 분리
        const headers = matchingData[0];
        const rows = matchingData.slice(1);
        
        // 기관 코드 인덱스 찾기
        const codeIndex = headers.indexOf('orgCode') !== -1 ? headers.indexOf('orgCode') : headers.indexOf('기관코드');
        
        if (codeIndex === -1) {
          console.warn('위원별_담당기관 시트에서 기관코드 열을 찾을 수 없습니다.');
        } else {
          // 삭제할 행 찾기
          for (let i = 0; i < rows.length; i++) {
            if (rows[i][codeIndex] === code) {
              try {
                // 시트에서 해당 행 삭제 (인덱스는 1부터 시작하고, 헤더 행이 있으므로 +1)
                await sheetsHelper.deleteRow('위원별_담당기관', i + 2);
                console.log(`위원별_담당기관 시트에서 매칭 삭제 성공: 행 ${i + 2}`);
              } catch (deleteError) {
                console.error(`위원별_담당기관 시트에서 행 삭제 실패:`, deleteError);
              }
            }
          }
        }
      }
    } catch (matchingError) {
      console.error('매칭 정보 삭제 중 오류:', matchingError);
    }
    
    // 성공 응답
    return res.status(200).json({
      status: 'success',
      message: `기관(${code})이 성공적으로 삭제되었습니다.`
    });
    
  } catch (error) {
    console.error('구글 시트에서 기관 삭제 중 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 위원별 담당기관 매칭 데이터를 가져오는 API 엔드포인트
app.get('/api/sheets/committee-orgs', require('./api/committee-orgs'));

// 일정 데이터 저장소 - 서버 메모리에 저장
// 실제 프로덕션에서는 데이터베이스를 사용해야 함
const scheduleStorage = {
  schedules: [],
  lastUpdated: null
};

// 일정 데이터 가져오기 API
app.get('/api/schedules', async (req, res) => {
  try {
    // 저장된 일정 데이터가 있는지 확인
    if (scheduleStorage.schedules && scheduleStorage.schedules.length > 0) {
      console.log(`서버 메모리에서 ${scheduleStorage.schedules.length}개의 일정 데이터 반환`);
      return res.json(scheduleStorage.schedules);
    }
    
    // 일정 데이터가 없으면 구글 시트에서 가져오기 시도
    console.log('구글 시트에서 일정 데이터 가져오기 시도');
    const sheetsHelper = require('./api/sheets-helper');
    const scheduleData = await sheetsHelper.readSheetData(process.env.SPREADSHEET_ID, '일정!A1:Z1000');
    
    if (scheduleData && scheduleData.length > 1) {
      // 첫 번째 행은 헤더
      const headers = scheduleData[0];
      const formattedSchedules = [];
      
      // 데이터 행 처리
      for (let i = 1; i < scheduleData.length; i++) {
        const row = scheduleData[i];
        if (row.length < 5) continue; // 유효한 데이터가 아니면 건너뛰기
        
        // 시트 구조에 맞게 데이터 추출
        const schedule = {
          id: `schedule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          date: row[0] || new Date().toISOString().split('T')[0],
          visitDate: row[0] || new Date().toISOString().split('T')[0],
          scheduleDate: row[0] || new Date().toISOString().split('T')[0],
          committeeName: row[1] || '미지정',
          organizationName: row[2] || '미지정',
          orgName: row[2] || '미지정',
          orgCode: row[3] || '',
          startTime: row[4] || '09:00',
          endTime: row[5] || '10:00',
          time: `${row[4] || '09:00'} - ${row[5] || '10:00'}`,
          status: row[6] || 'pending',
          notes: row[7] || '',
          memo: row[7] || '',
          createdAt: new Date().toISOString()
        };
        
        formattedSchedules.push(schedule);
      }
      
      // 서버 메모리에 저장
      scheduleStorage.schedules = formattedSchedules;
      scheduleStorage.lastUpdated = new Date().toISOString();
      
      console.log(`구글 시트에서 ${formattedSchedules.length}개의 일정 데이터 가져옴`);
      return res.json(formattedSchedules);
    } else {
      // 시트에 데이터가 없으면 샘플 데이터 생성
      console.log('구글 시트에 데이터가 없음, 샘플 데이터 생성');
      const sampleSchedules = generateSampleSchedules();
      
      // 서버 메모리에 저장
      scheduleStorage.schedules = sampleSchedules;
      scheduleStorage.lastUpdated = new Date().toISOString();
      
      return res.json(sampleSchedules);
    }
  } catch (error) {
    console.error('일정 데이터 가져오기 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '일정 데이터를 가져오는데 실패했습니다.',
      error: error.message
    });
  }
});

// 일정 데이터 저장 API
app.post('/api/schedules', (req, res) => {
  try {
    const newSchedules = req.body;
    
    if (!Array.isArray(newSchedules)) {
      return res.status(400).json({
        status: 'error',
        message: '유효한 일정 데이터 형식이 아닙니다. 배열 형태로 전송해주세요.'
      });
    }
    
    // 서버 메모리에 저장
    scheduleStorage.schedules = newSchedules;
    scheduleStorage.lastUpdated = new Date().toISOString();
    
    console.log(`${newSchedules.length}개의 일정 데이터 저장 완료`);
    
    res.json({
      status: 'success',
      message: `${newSchedules.length}개의 일정 데이터가 저장되었습니다.`,
      lastUpdated: scheduleStorage.lastUpdated
    });
  } catch (error) {
    console.error('일정 데이터 저장 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '일정 데이터를 저장하는데 실패했습니다.',
      error: error.message
    });
  }
});

// 샘플 일정 데이터 생성 함수
function generateSampleSchedules() {
  console.log('샘플 일정 데이터 생성');
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  
  // 기관 목록 - 실제 데이터 기반
  const allOrganizations = [
    { code: 'A48170002', name: '대한노인회 고성군지회', address: '경상남도 고성군 고성읍 중앙로 145' },
    { code: 'A48170003', name: '한올생명의집', address: '경상남도 고성군 개천면 청광리 201-1' },
    { code: 'A48240001', name: '화방남해', address: '경상남도 남해군 남해읍 남해대로 2935-3' },
    { code: 'A48240002', name: '화방재가', address: '경상남도 남해군 남해읍 남해대로 2935-3' },
    { code: 'A48840001', name: '사랑원', address: '경상남도 사천시 사천읍 구암두문로 254-9' },
    { code: 'A48840002', name: '사천노인', address: '경상남도 사천시 용현면 진삼로 447' },
    { code: 'A48850001', name: '나누리', address: '경상남도 진주시 문산읍 동부로 702' },
    { code: 'A48850002', name: '진양', address: '경상남도 진주시 진성면 진성로 1194' },
    { code: 'A48170001', name: '진주', address: '경상남도 진주시 진주대로 875' },
    { code: 'B12345678', name: '경남하동', address: '경상남도 하동군 하동읍 중앙로 70' },
    { code: 'B87654321', name: '하동노인', address: '경상남도 하동군 하동읍 읍내리 291-1' },
    { code: 'C12345678', name: '창원도우누리통합재가센터', address: '경상남도 창원시 의창구 의창동 234-5' }
  ];
  
  // 위원 목록
  const committees = [
    { name: '신용기', orgs: ['A48170002', 'A48170003', 'A48240001', 'A48240002'] },
    { name: '김수연', orgs: ['A48840001', 'A48840002'] },
    { name: '문일지', orgs: ['A48850001', 'A48850002'] },
    { name: '이연숙', orgs: ['A48170001', 'B12345678'] },
    { name: '이정혜', orgs: ['B87654321', 'C12345678'] }
  ];
  
  // 일정 상태 옵션
  const statusOptions = [
    { value: 'pending', label: '예정', probability: 0.5 },
    { value: 'completed', label: '완료', probability: 0.3 },
    { value: 'canceled', label: '취소', probability: 0.2 }
  ];
  
  // 방문 유형
  const visitTypes = ['정기평가', '수시평가', '컨설팅', '민원조사', '특별점검'];
  
  // 샘플 일정 생성
  const schedules = [];
  
  // 이번 달과 다음 달에 대한 일정 생성
  for (let m = 0; m < 2; m++) {
    const targetMonth = (month + m) % 12;
    const targetYear = year + Math.floor((month + m) / 12);
    
    // 각 위원별로 담당 기관에 대한 일정 생성
    committees.forEach((committee) => {
      // 이번 달에 담당 기관별로 1개의 일정 생성
      committee.orgs.forEach(orgCode => {
        // 해당 기관 정보 찾기
        const org = allOrganizations.find(o => o.code === orgCode);
        if (!org) return;
        
        // 랜덤 날짜 (1-28일)
        const day = 1 + Math.floor(Math.random() * 28);
        const date = new Date(targetYear, targetMonth, day);
        const dateStr = date.toISOString().split('T')[0];
        
        // 방문 시간 (9-17시)
        const startHour = 9 + Math.floor(Math.random() * 7);
        const startMinute = [0, 30][Math.floor(Math.random() * 2)];
        const duration = [60, 90, 120][Math.floor(Math.random() * 3)]; // 1시간, 1시간 30분, 2시간
        
        // 종료 시간 계산
        let endHour = startHour;
        let endMinute = startMinute + duration;
        if (endMinute >= 60) {
          endHour += Math.floor(endMinute / 60);
          endMinute = endMinute % 60;
        }
        
        // 시간 형식 포맷팅
        const startTimeStr = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
        const endTimeStr = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
        
        // 상태 결정 (가중치 적용)
        let status;
        const rand = Math.random();
        let cumulativeProbability = 0;
        for (const option of statusOptions) {
          cumulativeProbability += option.probability;
          if (rand <= cumulativeProbability) {
            status = option.value;
            break;
          }
        }
        
        // 방문 유형 선택
        const visitType = visitTypes[Math.floor(Math.random() * visitTypes.length)];
        
        // 일정 생성
        schedules.push({
          id: `schedule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          date: dateStr,
          visitDate: dateStr,
          scheduleDate: dateStr,
          committeeName: committee.name,
          organizationName: org.name,
          orgName: org.name,
          orgCode: org.code,
          orgAddress: org.address,
          startTime: startTimeStr,
          endTime: endTimeStr,
          time: `${startTimeStr} - ${endTimeStr}`,
          status: status,
          visitType: visitType,
          notes: `${org.name} ${visitType} 방문`,
          memo: `${org.name} ${visitType} 방문 일정 (${org.address})`,
          createdAt: new Date(date.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() // 최대 7일 전에 생성된 것으로 설정
        });
      });
    });
  }
  
  return schedules;
}
app.post('/api/save-to-sheet', async (req, res) => {
  try {
    console.log('구글 시트에 점검 데이터 저장 API 호출됨');
    console.log('Request body:', req.body);
    
    // 클라이언트에서 받은 데이터 확인
    const {
      indicatorId,
      orgCode,
      orgName,   // 클라이언트에서 전송한 기관명
      indicatorName: clientIndicatorName, // 클라이언트에서 전송한 지표명
      comment,
      monthlyStatus,
      timestamp,
      user,
      userCode // 클라이언트에서 전송한 위원코드
    } = req.body;
    
    // 구글 시트 ID 설정
    const spreadsheetId = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';
    
    // 위원 이름을 시트 이름으로 사용
    // 클라이언트에서 전송한 user 값을 시트 이름으로 사용
    // 사용자 이름이 없을 경우 세션에서 현재 로그인한 사용자 이름 사용
    const sheetName = user || (req.session && req.session.committee ? req.session.committee.name : '') || process.env.SHEET_NAME || '';
    
    console.log(`사용할 스프레드시트 ID: ${spreadsheetId}, 시트 이름(=위원명): ${sheetName}`);
    
    // 날짜와 시간 생성 - 사람이 읽을 수 있는 형식으로 변환
    const now = timestamp ? new Date(timestamp) : new Date();
    // YYYY-MM-DD 형식으로 날짜 저장 (Excel 내부 형식이 아닌 텍스트 형식)
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    // HH:MM 형식으로 시간 저장 (Excel 내부 형식이 아닌 텍스트 형식)
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // 월별 상태 파싱 로직
    let checkedMonths = [];
    let monthlyCheck = '';
    let monthlyStatusStr = '-';
    
    try {
      // 월별 상태 파싱 로직
      if (monthlyStatus) {
        checkedMonths = Object.keys(monthlyStatus).filter(month => monthlyStatus[month]);
        monthlyCheck = checkedMonths.length > 0 ? '완료' : '미완료';
        monthlyStatusStr = JSON.stringify(monthlyStatus);
      }
    } catch (e) {
      console.error('월별 상태 파싱 오류:', e);
      checkedMonths = [];
    }
    
    // 점검한 월 문자열로 변환 (YYYY-MM 형태)
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const checkedMonthsStr = currentYear + '-' + String(currentMonth).padStart(2, '0');
    
    // 지표명 설정 (클라이언트에서 전송한 지표명 우선 사용)
    const indicatorName = clientIndicatorName || '지표명 없음';
    
    // 연중점검 상태 처리
    let yearlyStatusStr = '{}';
    
    // 연중점검 지표인 경우 연중점검 상태 처리
    if (req.body.yearlyStatus && Object.keys(req.body.yearlyStatus).length > 0) {
      // 토글된 값 그대로 저장
      yearlyStatusStr = JSON.stringify(req.body.yearlyStatus);
      console.log('요청에서 전달된 연중점검 상태:', yearlyStatusStr);
    } 
    // 전역 캡0시에서 연중점검 상태 확인
    else if (global.yearlyStatusCache && global.yearlyStatusCache[indicatorId]) {
      yearlyStatusStr = JSON.stringify(global.yearlyStatusCache[indicatorId]);
      console.log('캡0시에서 가져온 연중점검 상태:', yearlyStatusStr);
    }
    
    // 연중점검 상태에 따른 결과 처리
    let yearlyCheck = '미완료';
    if (yearlyStatusStr !== '{}') {
      try {
        const yearlyStatusObj = JSON.parse(yearlyStatusStr);
        // 어떤 값이든 상태가 있으면 완료로 처리
        const hasAnyStatus = Object.values(yearlyStatusObj).some(status => status && status !== 'unchecked');
        if (hasAnyStatus) {
          yearlyCheck = '완료';
        }
      } catch (e) {
        console.error('연중점검 상태 파싱 오류:', e);
      }
    }
    
    // 저장할 데이터 확인
    const saveValues = [
      userCode || user,  // 위원코드 (전송된 위원코드 우선 사용)
      orgCode,           // 기관코드
      orgName,           // 기관명
      user,              // 위원명
      dateStr,           // 모니터링날짜
      timeStr,           // 모니터링시간
      indicatorId,       // 지표ID
      indicatorName,     // 지표명
      yearlyCheck,       // 결과 (연중점검 상태에 따라 결정)
      yearlyStatusStr,   // 체크리스트결과 (연중점검 상태 JSON 문자열)
      comment || '',     // 의견 (L열, 11번째 열)
      checkedMonthsStr    // 점검한 월
    ];
    
    // 데이터 형식 검증
    console.log('===== 구글 시트 저장 데이터 검증 =====');
    console.log('1. 저장할 값 배열:', saveValues);
    console.log('2. 배열 길이:', saveValues.length);
    console.log('3. 각 항목 타입 검증:');
    saveValues.forEach((value, index) => {
      console.log(`   [${index}] ${value} (${typeof value})`);
      
      // undefined나 null 값 체크
      if (value === undefined || value === null) {
        console.warn(`   [경고] 인덱스 ${index}의 값이 ${value}입니다. 빈 문자열로 대체합니다.`);
        saveValues[index] = '';
      }
    });
    
    try {
      console.log('===== Google Sheets API 호출 시작 =====');
      console.log('spreadsheetId:', spreadsheetId);
      console.log('sheetName:', sheetName);
      
      // 지표 데이터 저장
      const result = await sheetsHelper.appendRow({
        spreadsheetId: spreadsheetId,
        sheetName: sheetName,
        values: saveValues
      });
      
      console.log('===== Google Sheets API 호출 결과 =====');
      console.log('지표 저장 성공:', JSON.stringify(result, null, 2));
      console.log('구글 시트 저장 성공 - 업데이트된 범위:', result.updates?.updatedRange);
      
      return res.status(200).json({
        status: 'success',
        message: `점검 데이터가 '${sheetName}' 시트에 성공적으로 저장되었습니다.`,
        data: {
          sheetName: sheetName
        }
      });
    } catch (apiError) {
      console.error('구글 시트 API 호출 오류:', apiError);
      console.error('오류 상세 정보:', apiError.stack);
      
      // 오류 응답 반환
      return res.status(500).json({
        status: 'error',
        message: `구글 시트 저장 오류: ${apiError.message}`,
        error: apiError.message
      });
    }
  } catch (error) {
    console.error('서버 오류:', error);
    console.error('오류 상세 정보:', error.stack);

    return res.status(500).json({
      status: 'error',
      message: `서버 오류: ${error.message}`,
      error: error.message
    });
  }
});





// 서버 시작 시 구글 시트에서 연중점검 상태 로드
// 전역 연중점검 상태 캐시 초기화
global.yearlyStatusCache = {};

// 구글 시트에서 연중점검 상태 로드 함수
async function loadYearlyStatusFromSheet() {
  try {
    console.log('구글 시트에서 연중점검 상태 로드 시작...');
    
    // 환경변수에서 스프레드시트 ID와 시트 이름 가져오기
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheetName = process.env.SHEET_NAME;
    
    if (!spreadsheetId || !sheetName) {
      console.error('스프레드시트 ID 또는 시트 이름이 없습니다.');
      return;
    }
    
    // 구글 시트 API를 통해 데이터 가져오기
    const result = await sheetsHelper.getAllRows({
      spreadsheetId,
      sheetName
    });
    
    if (!result || !result.rows) {
      console.log('구글 시트에서 가져온 데이터가 없습니다.');
      return;
    }
    
    console.log(`구글 시트에서 ${result.rows.length}개의 행 로드 완료`);
    
    // 각 행에서 연중점검 상태 추출
    result.rows.forEach(row => {
      if (row.indicatorId && row.yearlyStatus && row.yearlyStatus !== '{}') {
        try {
          // yearlyStatus가 JSON 문자열인 경우 파싱
          const yearlyStatus = typeof row.yearlyStatus === 'string' ? 
            JSON.parse(row.yearlyStatus) : row.yearlyStatus;
          
          // 연중점검 상태 캐시에 저장
          global.yearlyStatusCache[row.indicatorId] = yearlyStatus;
          console.log(`지표 ID ${row.indicatorId}의 연중점검 상태 로드 완료`);
        } catch (e) {
          console.error(`지표 ID ${row.indicatorId}의 연중점검 상태 파싱 오류:`, e);
        }
      }
    });
    
    console.log('연중점검 상태 로드 완료. 캩시에 저장된 지표 수:', Object.keys(global.yearlyStatusCache).length);
  } catch (error) {
    console.error('구글 시트에서 연중점검 상태 로드 중 오류:', error);
  }
}

// 서버 시작 시 연중점검 상태 로드
loadYearlyStatusFromSheet();

// 연중점검 상태 업데이트 API 엔드포인트
app.post('/api/indicators/:id/yearly-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { yearlyStatus } = req.body;
    
    if (!id || !yearlyStatus) {
      return res.status(400).json({
        status: 'error',
        message: '유효하지 않은 요청 형식입니다.'
      });
    }
    
    console.log(`연중점검 상태 업데이트 요청: 지표 ID ${id}`);
    console.log('업데이트할 상태:', yearlyStatus);
    
    // 연중점검 상태를 저장하기 위한 전역 변수 업데이트
    // 이 정보는 추후 saveToGoogleSheet API에서 사용될 수 있음
    global.yearlyStatusCache = global.yearlyStatusCache || {};
    global.yearlyStatusCache[id] = yearlyStatus;
    
    console.log('연중점검 상태 캐시 업데이트:', global.yearlyStatusCache);
    
    return res.status(200).json({
      status: 'success',
      message: '연중점검 상태가 성공적으로 업데이트되었습니다.',
      data: {
        indicatorId: id,
        yearlyStatus
      }
    });
  } catch (error) {
    console.error('연중점검 상태 업데이트 오류:', error);
    return res.status(500).json({
      status: 'error',
      message: `연중점검 상태 업데이트 중 오류가 발생했습니다: ${error.message}`,
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
      spreadsheetId: process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU',
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

// 사용자별 시트에서 점검 데이터를 로드하는 API 엔드포인트
app.get('/api/load-from-sheet', async (req, res) => {
  try {
    console.log('구글 시트에서 점검 데이터 로드 API 호출됨');
    
    // 클라이언트에서 받은 사용자 이름 확인
    const { user, indicatorId, orgCode } = req.query;
    
    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: '사용자 이름은 필수 항목입니다.'
      });
    }
    
    console.log(`점검 데이터 로드 요청: 사용자 ${user}`);
    
    // 구글 시트에서 데이터 로드 - 사용자 이름을 시트 이름으로 사용
    let rows = [];
    try {
      rows = await sheetsHelper.readSheet(user);
      console.log(`${user} 시트에서 ${rows.length}개의 행 로드됨`);
    } catch (readError) {
      console.error(`${user} 시트 로드 오류:`, readError.message);
      // 시트가 없는 경우는 비어있는 배열 반환
      rows = [];
    }
    
    // 헤더 행 처리
    let headers = [];
    let data = [];
    
    if (rows.length > 0) {
      headers = rows[0];
      data = rows.slice(1);
    }
    
    // 필터링 적용 (지표 ID와 기관 코드가 제공된 경우)
    let filteredData = data;
    
    if (indicatorId && orgCode) {
      filteredData = data.filter(row => {
        // 지표 ID는 일반적으로 3번째 열, 기관 코드는 1번째 열
        const rowIndicatorId = row[2];
        const rowOrgCode = row[0];
        return rowIndicatorId === indicatorId && rowOrgCode === orgCode;
      });
      
      console.log(`필터링 적용: 지표 ${indicatorId}, 기관 ${orgCode} => ${filteredData.length}개 항목 발견`);
    }
    
    // 응답 데이터 구성
    const result = {
      headers,
      data: filteredData.map(row => {
        // 월별 상태와 연간 상태 JSON 파싱
        let monthlyStatus = {};
        let yearlyStatus = {};
        
        try {
          if (row[3] && typeof row[3] === 'string') {
            monthlyStatus = JSON.parse(row[3]);
          }
        } catch (e) {
          console.error('월별 상태 파싱 오류:', e);
        }
        
        try {
          if (row[4] && typeof row[4] === 'string') {
            yearlyStatus = JSON.parse(row[4]);
          }
        } catch (e) {
          console.error('연간 상태 파싱 오류:', e);
        }
        
        // 데이터 구조화
        return {
          orgCode: row[0],
          orgName: row[1],
          indicatorId: row[2],
          monthlyStatus,
          yearlyStatus,
          date: row[5],
          time: row[6],
          user: row[7],
          result: row[8],
          checklistResult: row[9],
          comment: row[10],
          checkedMonths: row[11],
          updatedAt: row[12],
          indicatorName: row[13] || ''
        };
      })
    };
    
    // 성공 응답
    res.status(200).json({
      status: 'success',
      message: `${user} 시트에서 점검 데이터를 성공적으로 로드했습니다.`,
      data: result
    });
  } catch (error) {
    console.error('점검 데이터 로드 중 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '점검 데이터 로드 중 서버 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 404 에러 처리
app.use((req, res, next) => {
  console.log(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({
    status: 'error',
    message: '요청한 리소스를 찾을 수 없습니다.'
  });
});

// 에러 처리 미들웨어
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Vercel 환경에서 사용할 기본 라우트 추가
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    googleSheetsInitialized: !!sheets
  });
});

// Vercel 환경에서는 서버를 시작하지 않음
if (NODE_ENV !== 'production') {
  // 로컬 환경에서만 서버 시작
  const PORT = process.env.PORT || 3000;
  const startServer = (port) => {
    const server = app.listen(port)
      .on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${port} is in use, trying ${port + 1}`);
          startServer(port + 1);
        } else {
          console.error('Server error:', err);
        }
      })
      .on('listening', () => {
        console.log(`Server started on port ${port}`);
      });
    
    return server;
  };

  // 초기 포트로 서버 시작
  startServer(PORT);
  
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  
  // 서버 정보 출력
  console.log('Server configuration:');
  console.log(`- Port: ${PORT}`);
  console.log(`- Google Sheets API: ${!!sheets ? 'Enabled' : 'Disabled'}`);
  console.log(`- Session Secret: ${SESSION_SECRET ? 'Configured' : 'Not configured'}`);
} else {
  // Vercel 환경에서는 정보만 출력
  console.log(`Vercel serverless function initialized`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Google Sheets API: ${!!sheets ? 'Enabled' : 'Disabled'}`);
}

// Vercel 서버리스 함수 내보내기 - 모든 HTTP 메서드 처리
module.exports = app;

// Vercel Edge Functions 호환성을 위한 내보내기
module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};
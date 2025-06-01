// Vercel 서버리스 함수로 Express 앱을 래핑
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const morgan = require('morgan');
const fs = require('fs');
const { google } = require('googleapis');

// 환경 변수 설정
process.env.USE_SERVICE_ACCOUNT = process.env.USE_SERVICE_ACCOUNT || 'true';
process.env.SPREADSHEET_ID = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';

// 환경 변수 로깅
console.log('Vercel serverless function initialized');
console.log('NODE_VERSION:', process.version);
console.log('USE_SERVICE_ACCOUNT:', process.env.USE_SERVICE_ACCOUNT);
console.log('SPREADSHEET_ID exists:', !!process.env.SPREADSHEET_ID);
console.log('SERVICE_ACCOUNT_KEY exists:', !!process.env.SERVICE_ACCOUNT_KEY);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Vercel 환경에서 서비스 계정 키 처리
try {
  if (process.env.SERVICE_ACCOUNT_KEY) {
    try {
      console.log('환경 변수에서 서비스 계정 키를 가져옵니다.');
      const serviceAccountPath = path.join(__dirname, 'service-account.json');
      fs.writeFileSync(serviceAccountPath, process.env.SERVICE_ACCOUNT_KEY);
      process.env.SERVICE_ACCOUNT_KEY_PATH = serviceAccountPath;
      console.log('서비스 계정 키 파일이 생성되었습니다:', serviceAccountPath);
    } catch (writeError) {
      console.error('서비스 계정 키 파일 저장 중 오류:', writeError);
    }
  }
} catch (error) {
  console.error('서비스 계정 키 처리 중 오류:', error);
}

// API 라우터 및 기존 라우트 가져오기
const apiRouter = require('./_routes');
let authRoutes;

try {
  authRoutes = require('../routes/auth');
  console.log('인증 라우터 로드 성공');
} catch (error) {
  console.error('인증 라우터 로드 실패, 기본 인증 라우터를 사용합니다:', error.message);
  // 기본 인증 라우터 (오류 시 사용)
  authRoutes = express.Router();
  authRoutes.post('/login', (req, res) => {
    res.status(200).json({ status: 'success', message: '로그인 성공 (기본 핸들러)' });
  });
}

const app = express();

// 미들웨어 설정
app.use(cors({
  credentials: true,
  origin: function(origin, callback) {
    // 로컬 개발 환경 또는 Vercel 도메인 허용
    const allowedOrigins = [
      'http://localhost:3000',
      'https://upload0414.vercel.app',
      'https://upload0414-git-master.vercel.app',
      'https://uplode0508.vercel.app',
      'https://uplode0508-git-main.vercel.app',
      'https://committee-monitoring-system.vercel.app'
    ];
    
    // origin이 undefined인 경우(예: 서버-서버 요청)나 허용된 도메인인 경우 허용
    const originIsAllowed = !origin || allowedOrigins.includes(origin);
    
    console.log(`CORS 요청 origin: ${origin}, 허용여부: ${originIsAllowed}`);
    
    if (originIsAllowed) {
      callback(null, true);
    } else {
      callback(new Error('CORS 정책에 의해 차단됨'));
    }
  }
}));
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'default_secret',
  resave: false,
  saveUninitialized: true
}));

// 라우트 설정
app.use('/api', apiRouter); // 새로운 API 라우터 사용
app.use('/auth', authRoutes);

// 상태 확인 엔드포인트 추가
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    useServiceAccount: process.env.USE_SERVICE_ACCOUNT,
    serviceAccountKeyPath: process.env.SERVICE_ACCOUNT_KEY_PATH,
    spreadsheetIdExists: !!process.env.SPREADSHEET_ID,
    serviceAccountKeyExists: !!process.env.SERVICE_ACCOUNT_KEY,
    env: process.env.NODE_ENV
  });
});

// 디버그 엔드포인트 추가
app.get('/debug-env', (req, res) => {
  res.status(200).json({
    nodeVersion: process.version,
    useServiceAccount: process.env.USE_SERVICE_ACCOUNT,
    serviceAccountKeyPath: process.env.SERVICE_ACCOUNT_KEY_PATH,
    spreadsheetIdExists: !!process.env.SPREADSHEET_ID,
    serviceAccountKeyExists: !!process.env.SERVICE_ACCOUNT_KEY,
    env: process.env.NODE_ENV
  });
});

// 기본 라우트
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// 오류 처리 미들웨어
app.use((err, req, res, next) => {
  console.error('ERROR:', err.message);
  console.error(err.stack);
  
  res.status(500).json({
    status: 'error',
    message: '서버 오류가 발생했습니다. 구글 시트 연결을 확인해주세요.',
    error: err.message,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
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

// Vercel을 위한 서버리스 함수 내보내기
module.exports = app; 
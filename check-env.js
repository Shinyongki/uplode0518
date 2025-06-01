require('dotenv').config();

console.log('\n=== 환경변수 확인 ===\n');

const envVars = {
    // Redis 설정
    'Redis URL': process.env.REDIS_URL,
    'Redis Password': process.env.REDIS_PASSWORD,
    
    // 보안 설정
    'Session Secret': process.env.SESSION_SECRET,
    'JWT Secret': process.env.JWT_SECRET,
    
    // 구글 시트 설정
    'Spreadsheet ID': process.env.SPREADSHEET_ID,
    'Google Credentials Path': process.env.GOOGLE_CREDENTIALS_PATH,
    'USE_SERVICE_ACCOUNT': process.env.USE_SERVICE_ACCOUNT,
    'SERVICE_ACCOUNT_KEY_PATH': process.env.SERVICE_ACCOUNT_KEY_PATH,
    
    // 서버 설정
    'Port': process.env.PORT,
    'Node Environment': process.env.NODE_ENV,
    
    // 구글 OAuth 설정
    'Google API Client ID': process.env.GOOGLE_API_CLIENT_ID,
    'Google API Client Secret': process.env.GOOGLE_API_CLIENT_SECRET,
    'Google API Redirect URI': process.env.GOOGLE_API_REDIRECT_URI
};

// 환경변수 출력
Object.entries(envVars).forEach(([key, value]) => {
    // 민감한 정보인 경우 값 자체는 숨기고 설정 여부만 표시
    const isSensitive = key.includes('Secret') || key.includes('Password');
    const displayValue = isSensitive && value ? '설정됨 (보안상 값 숨김)' : value || '미설정';
    console.log(`${key}: ${displayValue}`);
});

// 중요: 보안상 민감한 값들은 실제 값을 출력하지 않고 설정 여부만 표시합니다.
console.log('\n=== 환경변수 검증 ===\n');

// 필수 환경변수 검증
const requiredVars = [
    'REDIS_URL',
    'REDIS_PASSWORD',
    'SESSION_SECRET',
    'JWT_SECRET',
    'SPREADSHEET_ID',
    'GOOGLE_CREDENTIALS_PATH',
    'GOOGLE_API_CLIENT_ID',
    'GOOGLE_API_CLIENT_SECRET',
    'GOOGLE_API_REDIRECT_URI'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.log('❌ 다음 환경변수들이 설정되지 않았습니다:');
    missingVars.forEach(varName => console.log(`   - ${varName}`));
} else {
    console.log('✅ 모든 필수 환경변수가 설정되어 있습니다.');
}

// Redis 연결 테스트
const Redis = require('ioredis');
try {
    const redis = new Redis(process.env.REDIS_URL);
    redis.on('connect', () => {
        console.log('\n✅ Redis 연결 성공');
        redis.quit();
    });
    redis.on('error', (err) => {
        console.log('\n❌ Redis 연결 실패:', err.message);
        redis.quit();
    });
} catch (error) {
    console.log('\n❌ Redis 연결 실패:', error.message);
} 
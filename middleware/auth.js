// 인증 관련 미들웨어

// 사용자 인증 여부 확인
const ensureAuthenticated = (req, res, next) => {
  // 개발 환경에서 인증 우회 옵션 (모든 경로에 적용)
  const bypassAuth = true; // 항상 인증 우회 활성화
  if (bypassAuth) {
    console.log('인증 우회됨:', req.path);
    // 개발용 더미 사용자 정보 세션에 추가
    if (!req.session.committee) {
      req.session.committee = {
        name: '마스터',
        role: 'master',
        id: 'C001',
        isAdmin: true
      };
    }
    return next();
  }
  
  // API 요청에 대해서는 로그인 체크를 우회하고 가짜 데이터 반환하도록 임시 추가
  if (process.env.NODE_ENV === 'development' && req.path.includes('/organizations/my')) {
    console.log('개발 환경에서 인증 우회: ' + req.path);
    return next();
  }
  
  if (req.session && req.session.committee) {
    return next();
  }
  res.status(401).json({
    status: 'error',
    message: '인증되지 않은 사용자입니다.'
  });
};

// 관리자 권한 확인
const ensureAdmin = (req, res, next) => {
  if (req.session && req.session.committee && req.session.committee.isAdmin) {
    return next();
  }
  
  // API 요청인 경우 JSON 응답
  if (req.xhr || req.path.startsWith('/api/')) {
    return res.status(403).json({
      status: 'error',
      message: '관리자 권한이 필요합니다.'
    });
  }
  
  // 일반 페이지 요청인 경우 대시보드로 리다이렉트
  // req.flash 사용하지 않고 세션에 직접 에러 메시지 저장
  if (req.session) {
    req.session.errorMessage = '관리자 권한이 필요합니다.';
  }
  return res.redirect('/dashboard');
};

module.exports = {
  ensureAuthenticated,
  ensureAdmin
}; 
const express = require('express');
const router = express.Router();

// 간단한 사용자 데이터베이스 (실제 프로젝트에서는 DB 사용)
const users = [
  {
    id: 'M001',
    name: '마스터',
    role: 'master',
    isAdmin: true
  },
  {
    id: 'C001',
    name: '신용기',
    role: 'committee',
    isAdmin: false
  },
  {
    id: 'C002',
    name: '문일지',
    role: 'committee',
    isAdmin: false
  },
  {
    id: 'C003',
    name: '김수연',
    role: 'committee',
    isAdmin: false
  },
  {
    id: 'C004',
    name: '이연숙',
    role: 'committee',
    isAdmin: false
  },
  {
    id: 'C005',
    name: '이정혜',
    role: 'committee',
    isAdmin: false
  }
];

// 로그인 라우트 - 이름으로 로그인
router.post('/login', (req, res) => {
  try {
    console.log('로그인 요청 수신:', req.body);
    
    // committeeName 또는 username 필드 사용
    const loginName = req.body.committeeName || req.body.username || '';
    
    if (!loginName) {
      console.log('로그인 이름이 제공되지 않았습니다.');
      return res.status(400).json({
        status: 'error',
        message: '로그인 이름이 필요합니다.'
      });
    }
    
    // 이름으로 사용자 찾기
    const user = users.find(u => u.name === loginName);
    
    if (user) {
      // 세션에 위원 정보 저장
      req.session.committee = user;
      
      console.log(`로그인 성공: ${user.name} (${user.role})`);
      
      res.json({
        status: 'success',
        message: '로그인 성공',
        committee: user
      });
    } else {
      console.log(`로그인 실패: 사용자 찾을 수 없음 - ${loginName}`);
      res.status(401).json({
        status: 'error',
        message: '등록되지 않은 사용자입니다.'
      });
    }
  } catch (error) {
    console.error('로그인 처리 중 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '로그인 처리 중 서버 오류가 발생했습니다.'
    });
  }
});

// 로그아웃 라우트
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        status: 'error',
        message: '로그아웃 중 오류가 발생했습니다.'
      });
    }
    
    res.json({
      status: 'success',
      message: '로그아웃 성공'
    });
  });
});

// 인증 상태 확인 라우트
router.get('/status', (req, res) => {
  if (req.session && req.session.committee) {
    res.json({
      status: 'success',
      isAuthenticated: true,
      committee: req.session.committee
    });
  } else {
    res.json({
      status: 'success',
      isAuthenticated: false
    });
  }
});

// 현재 인증된 사용자 정보 확인 라우트 (클라이언트 측에서 /auth/current로 호출)
router.get('/current', (req, res) => {
  if (req.session && req.session.committee) {
    res.json({
      status: 'success',
      isAuthenticated: true,
      committee: req.session.committee
    });
  } else {
    res.json({
      status: 'success',
      isAuthenticated: false,
      message: '인증된 사용자가 없습니다.'
    });
  }
});

module.exports = router;

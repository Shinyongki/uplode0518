// 간단한 테스트 서버 만들기
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = 3001; // 기존 서버와 포트를 다르게 설정

// 기본 미들웨어
app.use(cors());
app.use(bodyParser.json());

// 루트 경로 처리
app.get('/', (req, res) => {
  console.log('루트 경로 요청됨');
  return res.status(200).json({
    status: 'success',
    message: '테스트 API 서버가 정상 작동 중입니다',
    endpoints: [
      '/api/test',
      '/api/test-committees',
      '/api/test-organizations', 
      '/api/test-indicators'
    ]
  });
});

// 테스트 API 엔드포인트
app.get('/api/test', (req, res) => {
  console.log('테스트 API 호출됨');
  return res.status(200).json({
    status: 'success',
    message: '테스트 성공',
    timestamp: new Date().toISOString()
  });
});

// 위원 테스트 API
app.get('/api/test-committees', (req, res) => {
  console.log('테스트 위원 목록 API 호출됨');
  return res.status(200).json({
    status: 'success',
    data: { 
      committees: [
        { name: '홍길동', id: 'C001', role: '위원' },
        { name: '김철수', id: 'C002', role: '위원' },
        { name: '이영희', id: 'C003', role: '위원장' }
      ] 
    }
  });
});

// 기관 테스트 API
app.get('/api/test-organizations', (req, res) => {
  console.log('테스트 기관 목록 API 호출됨');
  return res.status(200).json({
    status: 'success',
    data: { 
      organizations: [
        { code: 'A48120002', name: '창원도우누리노인종합재단', type: '복지관', region: '경남', address: '경남 창원시 의창구' },
        { code: 'A48120011', name: '경원사회복지종합', type: '복지관', region: '경남', address: '경남 창원시 성산구' },
        { code: 'A48120013', name: '진해노인종합복지관', type: '복지관', region: '경남', address: '경남 창원시 진해구' }
      ] 
    }
  });
});

// 지표 테스트 API
app.get('/api/test-indicators', (req, res) => {
  console.log('테스트 지표 목록 API 호출됨');
  return res.status(200).json({
    status: 'success',
    data: { 
      indicators: [
        { 
          id: 1, 
          category: '운영관리', 
          name: '1-1. 기관 운영규정',
          description: '기관 운영에 필요한 규정이 마련되어 있고, 규정에 따라 기관을 운영한다.' 
        },
        { 
          id: 2, 
          category: '운영관리', 
          name: '1-2. 운영계획서 및 예산',
          description: '기관의 연간 운영계획서와 예산서가 이사회의 승인을 받아 수립되어 있고, 이에 따라 기관을 운영한다.' 
        }
      ] 
    }
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`테스트 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
}); 
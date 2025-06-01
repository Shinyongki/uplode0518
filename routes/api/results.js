// 지표 결과 API 처리 모듈
const express = require('express');
const router = express.Router();

// 샘플 결과 데이터 (실제로는 DB에서 가져옴)
const sampleResults = {};

/**
 * 기관별 지표 결과 조회
 * @route GET /api/results/organization/:orgCode
 */
router.get('/organization/:orgCode', (req, res) => {
  try {
    const { orgCode } = req.params;
    
    console.log(`기관 코드 ${orgCode}의 지표 결과 조회 요청`);
    
    // 해당 기관의 결과 데이터 가져오기 (없으면 빈 배열)
    const results = sampleResults[orgCode] || [];
    
    res.json({
      status: 'success',
      data: {
        results,
        orgCode,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('기관별 지표 결과 조회 중 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '지표 결과를 가져오는 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 지표 결과 저장
 * @route POST /api/results
 */
router.post('/', (req, res) => {
  try {
    const resultData = req.body;
    
    // 필수 필드 확인
    if (!resultData.orgCode || !resultData.indicatorId) {
      return res.status(400).json({
        status: 'error',
        message: '필수 데이터가 누락되었습니다. (orgCode, indicatorId)'
      });
    }
    
    console.log('지표 결과 저장 요청:', resultData);
    
    // 해당 기관의 결과 데이터 초기화 (없는 경우)
    if (!sampleResults[resultData.orgCode]) {
      sampleResults[resultData.orgCode] = [];
    }
    
    // 기존 결과 찾기
    const existingResultIndex = sampleResults[resultData.orgCode].findIndex(
      r => r.indicatorId === resultData.indicatorId
    );
    
    // 기존 결과 업데이트 또는 새 결과 추가
    if (existingResultIndex >= 0) {
      sampleResults[resultData.orgCode][existingResultIndex] = {
        ...sampleResults[resultData.orgCode][existingResultIndex],
        ...resultData,
        updatedAt: new Date().toISOString()
      };
    } else {
      sampleResults[resultData.orgCode].push({
        ...resultData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    res.json({
      status: 'success',
      message: '지표 결과가 저장되었습니다.',
      data: {
        result: resultData,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('지표 결과 저장 중 오류:', error);
    res.status(500).json({
      status: 'error',
      message: '지표 결과를 저장하는 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;

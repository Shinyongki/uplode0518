// 샘플 데이터 대신 실제 모델 사용
const indicatorModel = require('../models/indicator');

// 모든 모니터링 지표 가져오기
const getAllIndicators = async (req, res) => {
  try {
    // 구글 시트에서 지표 목록 가져오기
    const indicators = await indicatorModel.getAllIndicators();
    
    return res.status(200).json({
      status: 'success',
      data: { indicators }
    });
  } catch (error) {
    console.error('지표 목록 조회 중 오류 발생:', error);
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 주기별 모니터링 지표 가져오기
const getIndicatorsByPeriod = async (req, res) => {
  try {
    const { period } = req.params;
    
    if (!period || !['매월', '반기', '연중', '1~3월'].includes(period)) {
      return res.status(400).json({
        status: 'error',
        message: '유효한 점검 주기를 지정해주세요. (매월, 반기, 연중, 1~3월)'
      });
    }
    
    console.log(`주기별 지표 요청 - 주기: ${period}`);
    
    // 구글 시트에서 주기별 지표 가져오기
    let indicators = await indicatorModel.getIndicatorsByPeriod(period);
    
    // DEBUG: 실제 데이터 로그 출력
    console.log(`가져온 ${period} 카테고리 지표 수: ${indicators.length}`);
    if (indicators.length > 0) {
      console.log('첫 번째 지표 데이터:', JSON.stringify(indicators[0]));
    } else {
      console.log('지표 데이터가 없습니다.');
      
      // 임시 해결책: 샘플 데이터 사용하지 않음
      return res.status(200).json({
        status: 'success',
        data: { 
          indicators: [],
          period,
          message: `${period} 주기 지표를 찾을 수 없습니다. 구글 시트를 확인해주세요.`
        }
      });
    }
    
    // 반기 화면에 표시되는 연중 지표에 태그 추가
    const formattedIndicators = indicators.map(indicator => {
      // 반기 지표 여부 명확히 판별
      const isSemiAnnual = indicator.category === '반기' || 
                          indicator.name.includes('반기') || 
                          (indicator.code && indicator.code.startsWith('H')) ||
                          (indicator.code && indicator.code.match(/H\d{3}/));
                          
      const isYearly = indicator.category === '연중';
      
      // 반기 지표 명확하게 표시
      if (isSemiAnnual) {
        return { 
          ...indicator, 
          isSemiAnnual: true,
          isYearly: false,
          category: '반기'  // 카테고리도 강제로 '반기'로 설정
        };
      }
      
      if (period === '반기' && isYearly) {
        return { 
          ...indicator, 
          isYearly: true,
          isSemiAnnual: false
        };
      }
      
      return { 
        ...indicator, 
        isYearly: false,
        isSemiAnnual: false 
      };
    });
    
    console.log(`반기 태그가 적용된 지표 수: ${formattedIndicators.filter(i => i.isSemiAnnual).length}`);
    console.log(`연중 태그가 적용된 지표 수: ${formattedIndicators.filter(i => i.isYearly).length}`);
    
    return res.status(200).json({
      status: 'success',
      data: { 
        indicators: formattedIndicators,
        period
      }
    });
  } catch (error) {
    console.error(`주기별 지표 조회 중 오류 발생 (주기: ${req.params.period}):`, error);
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 특정 ID의 지표 가져오기
const getIndicatorById = async (req, res) => {
  try {
    const { indicatorId } = req.params;
    
    if (!indicatorId) {
      return res.status(400).json({
        status: 'error',
        message: '지표 ID가 필요합니다.'
      });
    }
    
    // 구글 시트에서 지표 찾기
    const indicator = await indicatorModel.getIndicatorById(indicatorId);
    
    if (!indicator) {
      return res.status(404).json({
        status: 'error',
        message: '해당 ID의 지표를 찾을 수 없습니다.'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      data: { indicator }
    });
  } catch (error) {
    console.error(`지표 조회 중 오류 발생 (ID: ${req.params.indicatorId}):`, error);
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.'
    });
  }
};

module.exports = {
  getAllIndicators,
  getIndicatorsByPeriod,
  getIndicatorById
}; 
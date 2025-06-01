const { readSheetData, writeSheetData } = require('../config/googleSheets');
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// 지표 정보를 위한 시트 범위
const INDICATORS_RANGE = '지표_목록!A:O';

// 모든 모니터링 지표 가져오기
const getAllIndicators = async () => {
  try {
    const values = await readSheetData(SPREADSHEET_ID, INDICATORS_RANGE);
    
    if (!values || values.length === 0) {
      console.log('지표 목록이 비어 있습니다.');
      return [];
    }
    
    // 첫 번째 행은 헤더로 간주
    const headers = values[0];
    console.log('지표 헤더:', headers);
    
    const indicators = values.slice(1).map(row => {
      const indicator = {};
      headers.forEach((header, index) => {
        if (row[index] !== undefined) {
          indicator[header] = row[index];
        } else {
          indicator[header] = '';
        }
      });
      return indicator;
    });
    
    console.log(`총 ${indicators.length}개 지표 로드됨`);
    return indicators;
  } catch (error) {
    console.error('Error fetching indicators:', error);
    throw error;
  }
};

// 주기별 모니터링 지표 가져오기
const getIndicatorsByPeriod = async (period) => {
  try {
    console.log(`주기별 지표 요청: ${period}`);
    const allIndicators = await getAllIndicators();
    console.log(`전체 지표 ${allIndicators.length}개 로드됨`);
    
    if (allIndicators.length === 0) {
      console.log('전체 지표 목록이 비어있습니다.');
      return [];
    }
    
    // 구글 시트와 일치하는 필드명 사용 - 'category'가 주기 정보를 담고 있음
    const categoryField = 'category';
    
    console.log(`주기 필드 사용: ${categoryField}`);
    
    // 주기별 필터링
    let filteredIndicators = [];
    
    if (period === '매월') {
      filteredIndicators = allIndicators.filter(indicator => 
        indicator[categoryField] === '매월'
      );
    } else if (period === '반기') {
      filteredIndicators = allIndicators.filter(indicator => 
        indicator[categoryField] === '반기' || indicator[categoryField] === '연중'
      );
    } else if (period === '연중') {
      filteredIndicators = allIndicators.filter(indicator => 
        indicator[categoryField] === '연중'
      );
    } else if (period === '1~3월') {
      filteredIndicators = allIndicators.filter(indicator => 
        indicator[categoryField] === '1~3월'
      );
    }
    
    console.log(`${period} 지표 ${filteredIndicators.length}개 반환`);
    return filteredIndicators;
  } catch (error) {
    console.error(`Error fetching indicators for period ${period}:`, error);
    throw error;
  }
};

// 특정 ID의 지표 가져오기
const getIndicatorById = async (indicatorId) => {
  try {
    const allIndicators = await getAllIndicators();
    return allIndicators.find(indicator => indicator.id === indicatorId) || null;
  } catch (error) {
    console.error(`Error fetching indicator by ID ${indicatorId}:`, error);
    throw error;
  }
};

module.exports = {
  getAllIndicators,
  getIndicatorsByPeriod,
  getIndicatorById,
}; 
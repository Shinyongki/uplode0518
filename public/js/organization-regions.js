/**
 * 지역 분류 및 필터링을 위한 유틸리티 함수
 */

// 지역명 정규화 함수 - 상세 지역명을 기본 시/군으로 변환
window.normalizeRegionName = function(regionName) {
  if (!regionName) return '기타 지역';
  
  // 시/군 추출 (예: '창원시 의창구' -> '창원시')
  const mainRegion = regionName.split(' ')[0];
  
  // 시/군/구 확인
  if (mainRegion.endsWith('시') || 
      mainRegion.endsWith('군') || 
      mainRegion.endsWith('구')) {
    return mainRegion;
  }
  
  return regionName;
};

// 지역별 기관 그룹화 함수
window.groupOrganizationsByRegion = function(organizations) {
  const groups = {};
  
  organizations.forEach(org => {
    // 지역명 정규화
    const regionName = window.normalizeRegionName(org.region);
    
    if (!groups[regionName]) {
      groups[regionName] = [];
    }
    
    groups[regionName].push(org);
  });
  
  return groups;
};

// 경남 지역 시/군 목록
window.GYEONGNAM_REGIONS = [
  '창원시', '진주시', '통영시', '사천시', '김해시', '밀양시', '거제시', '양산시',
  '의령군', '함안군', '창녕군', '고성군', '남해군', '하동군', '산청군', '함양군', 
  '거창군', '합천군'
];

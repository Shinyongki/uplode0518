/**
 * 샘플 지표 데이터 생성 (개발 및 테스트용)
 * @param {string} period - 주기 (매월, 반기, 1~3월 등)
 * @returns {Array} 샘플 지표 목록
 */
function getSampleIndicators(period) {
  console.log(`신용기 위원의 샘플 지표 데이터 생성: 주기=${period}`);
  
  // 주기별 지표 수
  const countMap = {
    '매월': 12,
    '반기': 6,
    '1~3월': 4,
    '연중': 3
  };
  
  const count = countMap[period] || 5;
  const indicators = [];
  
  // 신용기 위원의 실제 지표 데이터 구조 반영
  const sampleData = [
    // 매월 점검 지표
    { id: 'IND-매월-001', code: 'M001', name: '노인복지시설 점검 지표 1', category: '매월', reviewMaterials: '점검자료 1', commonRequired: 'O', commonOptional: '', evaluationLinked: 'O', onlineCheck: '필수', onsiteCheck: '', description: '매월 주기 점검 지표 1번에 대한 상세설명입니다. 이 지표는 인력 배치 기준 준수 여부를 점검합니다.' },
    { id: 'IND-매월-002', code: 'M002', name: '노인복지시설 점검 지표 2', category: '매월', reviewMaterials: '점검자료 2', commonRequired: '', commonOptional: 'O', evaluationLinked: 'O', onlineCheck: '선택', onsiteCheck: '우선', description: '매월 주기 점검 지표 2번에 대한 상세설명입니다. 이 지표는 프로그램 운영 현황을 점검합니다.' },
    { id: 'IND-매월-003', code: 'M003', name: '노인복지시설 점검 지표 3', category: '매월', reviewMaterials: '점검자료 3', commonRequired: 'O', commonOptional: '', evaluationLinked: '', onlineCheck: '필수', onsiteCheck: '', description: '매월 주기 점검 지표 3번에 대한 상세설명입니다. 이 지표는 안전관리 상태를 점검합니다.' },
    { id: 'IND-매월-004', code: 'M004', name: '노인복지시설 점검 지표 4', category: '매월', reviewMaterials: '점검자료 4', commonRequired: '', commonOptional: 'O', evaluationLinked: '', onlineCheck: '선택', onsiteCheck: '', description: '매월 주기 점검 지표 4번에 대한 상세설명입니다. 이 지표는 급식 관리 상태를 점검합니다.' },
    { id: 'IND-매월-005', code: 'M005', name: '노인복지시설 점검 지표 5', category: '매월', reviewMaterials: '점검자료 5', commonRequired: 'O', commonOptional: '', evaluationLinked: 'O', onlineCheck: '필수', onsiteCheck: '우선', description: '매월 주기 점검 지표 5번에 대한 상세설명입니다. 이 지표는 위생 관리 상태를 점검합니다.' },
    { id: 'IND-매월-006', code: 'M006', name: '노인복지시설 점검 지표 6', category: '매월', reviewMaterials: '점검자료 6', commonRequired: '', commonOptional: 'O', evaluationLinked: '', onlineCheck: '선택', onsiteCheck: '우선', description: '매월 주기 점검 지표 6번에 대한 상세설명입니다. 이 지표는 종사자 근무 상태를 점검합니다.' },
    
    // 반기 점검 지표
    { id: 'IND-반기-001', code: 'H001', name: '반기 점검 지표 1', category: '반기', reviewMaterials: '반기 점검자료 1', commonRequired: 'O', commonOptional: '', evaluationLinked: 'O', onlineCheck: '필수', onsiteCheck: '', description: '반기 주기 점검 지표 1번에 대한 상세설명입니다. 이 지표는 재무회계 관리 상태를 점검합니다.' },
    { id: 'IND-반기-002', code: 'H002', name: '반기 점검 지표 2', category: '반기', reviewMaterials: '반기 점검자료 2', commonRequired: '', commonOptional: 'O', evaluationLinked: 'O', onlineCheck: '선택', onsiteCheck: '우선', description: '반기 주기 점검 지표 2번에 대한 상세설명입니다. 이 지표는 지역사회 자원 활용 현황을 점검합니다.' },
    { id: 'IND-반기-003', code: 'H003', name: '반기 점검 지표 3', category: '반기', reviewMaterials: '반기 점검자료 3', commonRequired: 'O', commonOptional: '', evaluationLinked: '', onlineCheck: '필수', onsiteCheck: '', description: '반기 주기 점검 지표 3번에 대한 상세설명입니다. 이 지표는 종사자 역량강화 현황을 점검합니다.' },
    
    // 1~3월 점검 지표
    { id: 'IND-분기-001', code: 'Q001', name: '1~3월 점검 지표 1', category: '1~3월', reviewMaterials: '1~3월 점검자료 1', commonRequired: 'O', commonOptional: '', evaluationLinked: 'O', onlineCheck: '필수', onsiteCheck: '', description: '1~3월 주기 점검 지표 1번에 대한 상세설명입니다. 이 지표는 시설 안전 관리 상태를 점검합니다.' },
    { id: 'IND-분기-002', code: 'Q002', name: '1~3월 점검 지표 2', category: '1~3월', reviewMaterials: '1~3월 점검자료 2', commonRequired: '', commonOptional: 'O', evaluationLinked: '', onlineCheck: '선택', onsiteCheck: '우선', description: '1~3월 주기 점검 지표 2번에 대한 상세설명입니다. 이 지표는 배상·상해보험 가입 여부를 점검합니다.' },
    
    // 연중 점검 지표
    { id: 'IND-연중-001', code: 'Y001', name: '연간 사업계획 수립 및 이행', category: '연중', reviewMaterials: '연간 사업계획서, 사업운영 현황', commonRequired: 'O', commonOptional: '', evaluationLinked: 'O', onlineCheck: '필수', onsiteCheck: '우선', description: '연간 사업계획이 적절히 수립되고 이행되고 있는지 확인합니다. 이 지표는 기관의 전반적인 사업 계획과 집행 현황을 점검합니다.' }
  ];
  
  // 신용기 위원의 지표 데이터 추가 - 더 많은 지표 추가
  const additionalSampleData = [
    { id: 'IND-매월-007', code: 'M007', name: '노인복지시설 점검 지표 7', category: '매월', reviewMaterials: '점검자료 7', commonRequired: 'O', commonOptional: '', evaluationLinked: 'O', onlineCheck: '필수', onsiteCheck: '', description: '매월 주기 점검 지표 7번에 대한 상세설명입니다. 이 지표는 서비스 제공계획 이행 현황을 점검합니다.' },
    { id: 'IND-매월-008', code: 'M008', name: '노인복지시설 점검 지표 8', category: '매월', reviewMaterials: '점검자료 8', commonRequired: '', commonOptional: 'O', evaluationLinked: 'O', onlineCheck: '선택', onsiteCheck: '우선', description: '매월 주기 점검 지표 8번에 대한 상세설명입니다. 이 지표는 서비스 만족도 조사 결과를 점검합니다.' },
    { id: 'IND-매월-009', code: 'M009', name: '노인복지시설 점검 지표 9', category: '매월', reviewMaterials: '점검자료 9', commonRequired: 'O', commonOptional: '', evaluationLinked: '', onlineCheck: '필수', onsiteCheck: '', description: '매월 주기 점검 지표 9번에 대한 상세설명입니다. 이 지표는 사례관리 회의 실시 현황을 점검합니다.' },
    { id: 'IND-매월-010', code: 'M010', name: '노인복지시설 점검 지표 10', category: '매월', reviewMaterials: '점검자료 10', commonRequired: '', commonOptional: 'O', evaluationLinked: '', onlineCheck: '선택', onsiteCheck: '', description: '매월 주기 점검 지표 10번에 대한 상세설명입니다. 이 지표는 이용자 관리 현황을 점검합니다.' },
    { id: 'IND-반기-004', code: 'H004', name: '반기 점검 지표 4', category: '반기', reviewMaterials: '반기 점검자료 4', commonRequired: '', commonOptional: 'O', evaluationLinked: 'O', onlineCheck: '선택', onsiteCheck: '우선', description: '반기 주기 점검 지표 4번에 대한 상세설명입니다. 이 지표는 특화 서비스 제공 현황을 점검합니다.' },
    { id: 'IND-반기-005', code: 'H005', name: '반기 점검 지표 5', category: '반기', reviewMaterials: '반기 점검자료 5', commonRequired: 'O', commonOptional: '', evaluationLinked: 'O', onlineCheck: '필수', onsiteCheck: '', description: '반기 주기 점검 지표 5번에 대한 상세설명입니다. 이 지표는 기관 연계 현황을 점검합니다.' },
    { id: 'IND-분기-003', code: 'Q003', name: '1~3월 점검 지표 3', category: '1~3월', reviewMaterials: '1~3월 점검자료 3', commonRequired: 'O', commonOptional: '', evaluationLinked: 'O', onlineCheck: '필수', onsiteCheck: '', description: '1~3월 주기 점검 지표 3번에 대한 상세설명입니다. 이 지표는 재무회계 관리 적절성을 점검합니다.' },
    { id: 'IND-연중-002', code: 'Y002', name: '연간 예산 집행 적절성', category: '연중', reviewMaterials: '예산집행 현황, 회계장부', commonRequired: 'O', commonOptional: '', evaluationLinked: 'O', onlineCheck: '필수', onsiteCheck: '우선', description: '연간 예산이 적절히 집행되고 있는지 확인합니다. 이 지표는 기관의 예산 집행 현황과 투명성을 점검합니다.' },
    { id: 'IND-연중-003', code: 'Y003', name: '연간 사업 평가 및 개선', category: '연중', reviewMaterials: '사업 평가 보고서, 개선계획', commonRequired: '', commonOptional: 'O', evaluationLinked: 'O', onlineCheck: '선택', onsiteCheck: '우선', description: '연간 사업 평가가 적절히 이루어지고 개선계획이 수립되었는지 확인합니다. 이 지표는 기관의 사업 평가와 피드백 반영 현황을 점검합니다.' }
  ];
  
  // 기존 샘플 데이터와 추가 데이터 합치기
  const allSampleData = [...sampleData, ...additionalSampleData];
  
  // 주기별 필터링 매핑 정의
  const periodMapping = {
    '매월': ['매월'],
    '반기': ['반기', '연중'],  // 반기 탭에는 연중 카테고리도 포함
    '1~3월': ['1~3월', '분기'],
    '연중': ['연중']
  };
  
  console.log(`전체 샘플 데이터 개수: ${allSampleData.length}`);
  
  // 주기에 맞는 샘플 데이터 필터링
  const filteredData = allSampleData.filter(item => {
    // 해당 주기에 맞는 카테고리인지 확인
    const validCategories = periodMapping[period] || [period];
    return validCategories.includes(item.category);
  });
  
  console.log(`필터링된 샘플 데이터 개수 (${period}): ${filteredData.length}`);
  
  // 지표 수에 맞게 데이터 생성 (count가 필터링된 데이터 개수보다 클 경우 모든 데이터 반환)
  const selectedData = filteredData.length <= count ? filteredData : filteredData.slice(0, count);
  
  // 샘플 데이터를 지표 형식으로 변환
  selectedData.forEach((item, index) => {
    const isPrimary = index % 3 === 0;
    const isSecondary = index % 3 === 1;
    const isTertiary = index % 3 === 2;
    const isRequired = index % 2 === 0;
    
    indicators.push({
      id: item.id,
      code: item.code,
      name: item.name,
      category: item.category,
      reviewMaterials: item.reviewMaterials || '',
      isCommonRequired: item.commonRequired === 'O',
      isCommonOptional: item.commonOptional === 'O',
      isEvaluationLinked: item.evaluationLinked === 'O',
      // 한글 필드명 추가 (클라이언트 호환성 유지)
      '공통필수': item.commonRequired,
      '공통선택': item.commonOptional,
      '평가연계': item.evaluationLinked,
      commonRequired: item.commonRequired,
      commonOptional: item.commonOptional,
      evaluationLinked: item.evaluationLinked,
      onlineCheck: item.onlineCheck || '',
      onsiteCheck: item.onsiteCheck || '',
      checkType: item.onlineCheck ? '온라인' : (item.onsiteCheck ? '현장' : ''),
      priority: (item.onlineCheck === '필수' || item.onsiteCheck === '필수') ? '필수' : 
               (item.onlineCheck === '우선' || item.onsiteCheck === '우선') ? '우선' : '선택',
      description: item.description || `${item.name}에 대한 상세 설명입니다.`,
      period: period
    });
  });
  
  return indicators;
}

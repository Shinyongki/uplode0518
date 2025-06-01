const { readSheetData, appendToSheet, writeToSheet } = require('../config/googleSheets');
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';
const Organization = require('../models/organization');

// 모든 수행기관 목록 가져오기
const getAllOrganizations = async (req, res) => {
  try {
    console.log('모든 기관 목록 요청됨');
    
    // 인증 확인 - 개발 환경에서는 우회 가능
    const bypassAuth = process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true';
    
    // 개발 환경이 아니거나 우회 옵션이 없는 경우에만 인증 검사
    if (!bypassAuth) {
      // 인증 확인 건너뛰기 - 모든 클라이언트에서 기관 목록을 가져올 수 있도록 함
      // 실제 운영 환경에서는 인증 검사 로직 추가 필요
    }
    
    // Organization 모델을 통해 모든 기관 가져오기
    const organizations = await Organization.getAllOrganizations();
    console.log(`총 ${organizations.length}개 기관 데이터 로드됨`);
    
    // 기관 없으면 빈 배열 반환
    if (!organizations || organizations.length === 0) {
      console.log('기관 데이터가 없습니다.');
      return res.status(200).json({
        status: 'success',
        data: { organizations: [] }
      });
    }
    
    // 디버깅: 첫 번째 기관 정보 출력
    if (organizations.length > 0) {
      console.log('첫 번째 기관 정보 샘플:', organizations[0]);
    }
    
    return res.status(200).json({
      status: 'success',
      data: { organizations }
    });
  } catch (error) {
    console.error('모든 기관 조회 오류:', error);
    console.error('[에러 상세 정보]:', JSON.stringify(error) || '상세 정보 없음');
    
    // 에러 객체가 undefined인 경우에도 처리
    const errorObj = error || { message: '알 수 없는 오류' };
    
    // 클라이언트에 전송할 오류 메시지
    let errorMessage = '서버 오류가 발생했습니다.';
    
    // 세부 오류 정보 (개발 환경에서만 제공)
    if (process.env.NODE_ENV === 'development') {
      errorMessage += ` 세부 정보: ${errorObj.message || '정보 없음'}`;
      if (errorObj.stack) {
        console.error('스택 트레이스:', errorObj.stack);
      }
    }
    
    // 로그에 조직 목록 조회 실패 기록
    console.error('[ERROR] 조직 목록 조회 실패:', errorObj.message || '정의되지 않은 에러');
    
    return res.status(500).json({
      status: 'error',
      message: errorMessage
    });
  }
};

// 특정 기관 정보 가져오기
const getOrganizationByCode = async (req, res) => {
  try {
    const { orgCode } = req.params;
    
    if (!orgCode) {
      return res.status(400).json({
        status: 'error',
        message: '기관 코드가 필요합니다.'
      });
    }
    
    const organization = await Organization.getOrganizationByCode(orgCode);
    
    if (!organization) {
      return res.status(404).json({
        status: 'error',
        message: '기관을 찾을 수 없습니다.'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      data: { organization }
    });
  } catch (error) {
    console.error(`기관 조회 오류 (코드: ${req.params.orgCode}):`, error);
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 현재 인증된 위원의 담당 기관 목록 가져오기
const getMyOrganizations = async (req, res) => {
  try {
    console.log('getMyOrganizations 호출됨');
    console.log('세션 정보:', req.session);
    
    // 인증 확인 - 이미 미들웨어에서 확인하므로 여기서는 생략 가능
    if (!req.session || !req.session.committee) {
      console.log('로그인 정보 없음, 인증 필요');
      return res.status(401).json({
        status: 'error',
        message: '로그인이 필요합니다.'
      });
    }
    
    // 위원 정보
    const committee = req.session.committee;
    console.log('위원 정보:', committee);
    
    // 요청에서 점검 유형 파라미터 확인 (기본값은 '전체')
    const checkType = req.query.checkType || '전체';
    console.log('요청된 점검 유형:', checkType);
    
    // 마스터 계정인 경우 모든 기관 정보 반환
    if (committee.role === 'master' || committee.name === '마스터' || committee.name.toLowerCase() === 'master') {
      console.log('마스터 계정 로그인, 모든 기관 정보 반환');
      const allOrganizations = await Organization.getAllOrganizations();
      
      return res.status(200).json({
        status: 'success',
        data: {
          mainOrganizations: allOrganizations,
          subOrganizations: []
        }
      });
    }
    
    // 구글 시트에서 위원-기관 매칭 정보 가져오기
    const sheetRange = '위원별_담당기관!A:H'; // 점검 유형 컬럼 추가
    
    try {
      console.log(`구글 시트에서 위원별 담당기관 정보 읽기 시작 (범위: ${sheetRange})`);
      const data = await readSheetData(SPREADSHEET_ID, sheetRange);
      
      if (!data || data.length < 2) {
        console.log('매칭 데이터를 찾을 수 없음');
        return res.status(200).json({
          status: 'success',
          data: {
            mainOrganizations: [],
            subOrganizations: []
          }
        });
      }
      
      // 헤더 확인
      const headers = data[0];
      console.log('헤더 정보:', headers);
      
      // 헤더를 제외한 실제 데이터
      const rows = data.slice(1);
      console.log(`위원별 담당기관 총 ${rows.length}개 데이터 로드됨`);
      
      // 현재 위원이 담당하는 기관 필터링
      const myMatchings = rows.filter(row => {
        const committeeName = row[1]; // 위원명 (1번째 인덱스)
        console.log(`비교: '${committeeName}' vs '${committee.name}'`);
        return committeeName === committee.name;
      });
      
      console.log(`${committee.name} 위원의 담당 기관 ${myMatchings.length}개 찾음`);
      console.log('매칭 데이터:', myMatchings);
      
      // 점검 유형에 따라 필터링 (전체, 매월, 반기)
      const filteredMatchings = checkType === '전체' 
        ? myMatchings 
        : myMatchings.filter(row => {
            const rowCheckType = row[7] || '전체'; // 점검 유형 (7번째 인덱스)
            return rowCheckType === '전체' || rowCheckType === checkType;
          });
      
      console.log(`점검 유형 '${checkType}'에 따른 필터링 후 ${filteredMatchings.length}개 매칭 데이터 남음`);
      
      // 주담당 기관과 부담당 기관 분리
      const mainOrganizations = [];
      const subOrganizations = [];
      
      // 이정혜 위원에 대한 특별 처리 로직 제거 - 구글 시트에 저장된 실제 역할 사용
      console.log(`${committee.name} 위원의 역할 처리 시작`);
      
      filteredMatchings.forEach(matching => {
        // 구글 시트에 저장된 역할 그대로 사용
        let role = matching[6]; // 기본 역할 (6번째 인덱스)
        
        // 기관 데이터 포맷팅
        const orgData = {
          orgId: matching[2] || '', // 기관 ID
          code: matching[3] || '',  // 기관 코드
          name: matching[4] || '',  // 기관명
          region: matching[5] || '', // 지역
          role: role,   // 역할 (주담당/부담당)
          checkType: matching[7] || '전체' // 점검 유형
        };
        
        // 디버깅 로그
        console.log(`처리 중인 기관 데이터: ${JSON.stringify(orgData)}`);
        
        if (role === '주담당') {
          mainOrganizations.push(orgData);
        } else if (role === '부담당') {
          subOrganizations.push(orgData);
        }
      });
      
      console.log(`변환 완료: 주담당 ${mainOrganizations.length}개, 부담당 ${subOrganizations.length}개`);
      
      return res.status(200).json({
        status: 'success',
        data: {
          mainOrganizations,
          subOrganizations,
          checkType
        }
      });
      
    } catch (error) {
      console.error('구글 시트 데이터 조회 중 오류:', error);
      console.error('오류 상세:', error.stack);
      
      // 세션에 오류 메시지 저장 (req.flash 대신 세션에 직접 저장)
      if (req.session) {
        req.session.errorMessage = '데이터 조회 중 오류가 발생했습니다.';
      }
      
      return res.status(500).json({
        status: 'error',
        message: '구글 시트 데이터 조회 중 오류가 발생했습니다.',
        error: error.message
      });
    }
  } catch (error) {
    console.error('담당 기관 목록 조회 중 오류:', error);
    console.error('오류 상세:', error.stack);
    
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
};

// 기관 목록 가져오기 (일반 함수)
const getOrganizations = async (req, res) => {
  // getMyOrganizations와 동일한 기능을 수행하므로 해당 함수 호출
  return getMyOrganizations(req, res);
};

// 기관 정보 업데이트
const updateOrganization = async (req, res) => {
  try {
    const { orgCode } = req.params;
    const updateData = req.body;
    
    if (!orgCode) {
      return res.status(400).json({
        status: 'error',
        message: '기관 코드가 필요합니다.'
      });
    }
    
    // 업데이트할 데이터가 없는 경우
    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        status: 'error',
        message: '업데이트할 데이터가 없습니다.'
      });
    }
    
    const updatedOrganization = await Organization.updateOrganization(orgCode, updateData);
    
    if (!updatedOrganization) {
      return res.status(404).json({
        status: 'error',
        message: '기관을 찾을 수 없습니다.'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      message: '기관 정보가 성공적으로 업데이트되었습니다.',
      data: { organization: updatedOrganization }
    });
  } catch (error) {
    console.error(`기관 업데이트 오류 (코드: ${req.params.orgCode}):`, error);
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 기관 추가
const addOrganization = async (req, res) => {
  try {
    // 마스터 계정 확인
    if (!req.session || !req.session.committee || req.session.committee.role !== 'master') {
      return res.status(403).json({
        status: 'error',
        message: '마스터 관리자만 접근할 수 있습니다.'
      });
    }
    
    const { code, name, region, note } = req.body;
    
    // 필수 필드 검증
    if (!code || !name || !region) {
      return res.status(400).json({
        status: 'error',
        message: '기관 코드, 이름, 지역 정보는 필수 입력사항입니다.'
      });
    }
    
    // 기관 모델을 통해 기관 추가
    const organizationData = {
      code,
      name,
      region,
      createdAt: new Date().toISOString(),
      note: note || ''
    };
    
    // 모델 함수를 통해 기관 추가
    const newOrganization = await organizationModel.addOrganization(organizationData);
    
    if (!newOrganization) {
      return res.status(400).json({
        status: 'error',
        message: `기관 추가에 실패했습니다. 이미 존재하는 코드일 수 있습니다.`
      });
    }
    
    // 성공 응답
    return res.status(201).json({
      status: 'success',
      message: '기관이 성공적으로 추가되었습니다.',
      data: {
        organization: newOrganization,
        timestamp: Date.now() // 기관 추가 타임스탬프 추가
      }
    });
  } catch (error) {
    console.error('기관 추가 오류:', error);
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 기관 삭제
const deleteOrganization = async (req, res) => {
  try {
    // 마스터 계정 확인
    if (!req.session || !req.session.committee || req.session.committee.role !== 'master') {
      return res.status(403).json({
        status: 'error',
        message: '마스터 관리자만 접근할 수 있습니다.'
      });
    }
    
    const { orgCode } = req.params;
    
    if (!orgCode) {
      return res.status(400).json({
        status: 'error',
        message: '기관 코드가 필요합니다.'
      });
    }
    
    // 기존 데이터 불러오기
    const sheetRange = '기관_목록!A:E';
    const data = await readSheetData(SPREADSHEET_ID, sheetRange);
    
    if (!data || data.length <= 1) { // 헤더만 있는 경우
      return res.status(404).json({
        status: 'error',
        message: '기관 데이터가 없습니다.'
      });
    }
    
    // 헤더와 데이터 분리
    const headers = data[0];
    const rows = data.slice(1);
    
    // 삭제할 기관 찾기
    const orgIndex = rows.findIndex(row => row[1] === orgCode); // 코드 열 인덱스가 1인 경우
    
    if (orgIndex === -1) {
      return res.status(404).json({
        status: 'error',
        message: `기관 코드(${orgCode})에 해당하는 기관을 찾을 수 없습니다.`
      });
    }
    
    // 기관 삭제
    const deletedOrg = rows.splice(orgIndex, 1)[0];
    
    // 시트 전체 데이터 업데이트 (헤더 + 남은 데이터)
    await writeToSheet(SPREADSHEET_ID, '기관_목록!A:E', [headers, ...rows]);
    
    return res.status(200).json({
      status: 'success',
      message: '기관이 성공적으로 삭제되었습니다.',
      data: {
        organization: {
          id: deletedOrg[0],
          code: deletedOrg[1],
          name: deletedOrg[2],
          region: deletedOrg[3]
        }
      }
    });
  } catch (error) {
    console.error(`기관 삭제 오류 (코드: ${req.params.orgCode}):`, error);
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.'
    });
  }
};

module.exports = {
  getAllOrganizations,
  getOrganizationByCode,
  getOrganizations,
  getMyOrganizations,
  updateOrganization,
  addOrganization,
  deleteOrganization
}; 
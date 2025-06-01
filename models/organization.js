const { readSheetData, writeSheetData, appendToSheet } = require('../config/googleSheets');
// 환경 변수에서 스프레드시트 ID 가져오기, 없으면 하드코딩된 값 사용
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '11eWVWRY2cTU5nat3zsTSTjvhvk-LxhistC1LmfBNvPU';

// 기관 목록을 위한 시트 범위
const ORGANIZATIONS_RANGE = '기관_목록!A:F'; // 기관ID, 기관코드, 기관명, 지역, 주소, 연락처

// 모든 기관 목록 가져오기
const getAllOrganizations = async () => {
  try {
    const values = await readSheetData(SPREADSHEET_ID, ORGANIZATIONS_RANGE);
    
    if (!values || values.length === 0) {
      console.log('기관 목록이 비어 있습니다.');
      return [];
    }
    
    // 첫 번째 행은 헤더로 간주
    const headers = values[0];
    console.log('기관 헤더:', headers);
    
    const organizations = values.slice(1).map(row => {
      const organization = {};
      headers.forEach((header, index) => {
        if (row[index] !== undefined) {
          organization[header] = row[index];
        } else {
          organization[header] = '';
        }
      });
      return organization;
    });
    
    console.log(`총 ${organizations.length}개 기관 로드됨`);
    return organizations;
  } catch (error) {
    console.error('Error fetching organizations:', error);
    throw error;
  }
};

// 특정 코드의 기관 가져오기
const getOrganizationByCode = async (orgCode) => {
  try {
    const organizations = await getAllOrganizations();
    return organizations.find(org => org.code === orgCode || org.기관코드 === orgCode) || null;
  } catch (error) {
    console.error(`Error fetching organization by code ${orgCode}:`, error);
    throw error;
  }
};

// 특정 위원이 담당하는 기관 목록 가져오기
const getOrganizationsByCommitteeId = async (committeeId) => {
  try {
    // 실제 구현에서는 매칭 정보를 데이터베이스나 시트에서 가져와야 함
    // 지금은 더미 데이터 사용
    const dummyMatchings = [
      { committeeId: 'C001', orgCode: 'A48120001', role: '주담당' },
      { committeeId: 'C001', orgCode: 'A48120002', role: '주담당' },
      { committeeId: 'C002', orgCode: 'A48120003', role: '주담당' },
      { committeeId: 'C002', orgCode: 'A48120004', role: '부담당' },
      { committeeId: 'C003', orgCode: 'A48120005', role: '주담당' },
      { committeeId: 'C003', orgCode: 'A48120006', role: '부담당' }
    ];
    
    // 위원이 담당하는 기관 코드 추출
    const orgCodes = dummyMatchings
      .filter(matching => matching.committeeId === committeeId)
      .map(matching => matching.orgCode);
    
    if (orgCodes.length === 0) {
      return [];
    }
    
    // 기관 정보 가져오기
    const allOrganizations = await getAllOrganizations();
    const committeeOrganizations = allOrganizations.filter(org => 
      orgCodes.includes(org.code) || orgCodes.includes(org.기관코드)
    );
    
    return committeeOrganizations;
  } catch (error) {
    console.error(`Error fetching organizations by committee ID ${committeeId}:`, error);
    throw error;
  }
};

// 기관 정보 업데이트
const updateOrganization = async (orgCode, updateData) => {
  try {
    // 1단계: 모든 기관 데이터 가져오기
    const values = await readSheetData(SPREADSHEET_ID, ORGANIZATIONS_RANGE);
    
    if (!values || values.length === 0) {
      console.log('기관 목록이 비어 있습니다.');
      return null;
    }
    
    // 2단계: 헤더 및 데이터 처리
    const headers = values[0];
    const organizations = values.slice(1);
    
    // 3단계: 대상 기관 찾기
    const orgIndex = organizations.findIndex(row => {
      // 'code' 또는 '기관코드' 필드 비교
      const codeIndex = headers.indexOf('code') !== -1 ? headers.indexOf('code') : headers.indexOf('기관코드');
      return row[codeIndex] === orgCode;
    });
    
    if (orgIndex === -1) {
      console.log(`기관 코드 ${orgCode}를 찾을 수 없습니다.`);
      return null;
    }
    
    // 4단계: 업데이트 데이터 적용
    const updatedRow = [...organizations[orgIndex]];
    
    Object.keys(updateData).forEach(key => {
      const keyIndex = headers.indexOf(key);
      if (keyIndex !== -1) {
        updatedRow[keyIndex] = updateData[key];
      }
    });
    
    // 5단계: 데이터 업데이트
    organizations[orgIndex] = updatedRow;
    
    // 6단계: 전체 데이터 다시 쓰기
    const updatedValues = [headers, ...organizations];
    const fullRange = `기관_목록!A1:${String.fromCharCode(65 + headers.length - 1)}${updatedValues.length}`;
    await writeSheetData(SPREADSHEET_ID, fullRange, updatedValues);
    
    // 7단계: 업데이트된 기관 객체 반환
    const updatedOrganization = {};
    headers.forEach((header, index) => {
      updatedOrganization[header] = updatedRow[index] || '';
    });
    
    return updatedOrganization;
  } catch (error) {
    console.error(`Error updating organization ${orgCode}:`, error);
    throw error;
  }
};
// 새 기관 추가
const addOrganization = async (organizationData) => {
  try {
    // 기존 데이터 불러오기
    const values = await readSheetData(SPREADSHEET_ID, ORGANIZATIONS_RANGE);
    
    if (!values || values.length === 0) {
      console.log('기관 목록이 비어 있습니다.');
      return null;
    }
    
    // 헤더 확인
    const headers = values[0];
    const rows = values.slice(1);
    
    // 중복 코드 확인
    const isDuplicate = rows.some(row => {
      const codeIndex = headers.indexOf('code') !== -1 ? headers.indexOf('code') : headers.indexOf('기관코드');
      return row[codeIndex] === organizationData.code;
    });
    
    if (isDuplicate) {
      console.log(`이미 존재하는 기관 코드(${organizationData.code})입니다.`);
      return null;
    }
    
    // 새 기관 ID 생성
    const newOrgId = rows.length > 0 ? Number(rows[rows.length - 1][0]) + 1 : 1;
    
    // 새 기관 데이터 포맷팅
    const newOrg = [];
    headers.forEach(header => {
      if (header === 'id' || header === '기관ID') {
        newOrg.push(newOrgId.toString());
      } else if (organizationData[header]) {
        newOrg.push(organizationData[header]);
      } else {
        newOrg.push('');
      }
    });
    
    // 구글 시트에 추가
    await appendToSheet(SPREADSHEET_ID, ORGANIZATIONS_RANGE, [newOrg]);
    
    // 추가된 기관 객체 반환
    const addedOrganization = {};
    headers.forEach((header, index) => {
      addedOrganization[header] = newOrg[index] || '';
    });
    
    return addedOrganization;
  } catch (error) {
    console.error('Error adding organization:', error);
    throw error;
  }
};

module.exports = {
  getAllOrganizations,
  getOrganizationByCode,
  getOrganizationsByCommitteeId,
  updateOrganization,
  addOrganization
}; 
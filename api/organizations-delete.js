// 기관 삭제 API 엔드포인트
const { readSheetData, writeSheetData } = require('./sheets-helper');

module.exports = async (req, res) => {
  try {
    // DELETE 요청 처리
    if (req.method === 'DELETE') {
      const orgCode = req.query.code || '';
      
      if (!orgCode) {
        return res.status(400).json({
          status: 'error',
          message: '기관 코드가 제공되지 않았습니다.'
        });
      }
      
      console.log(`기관 삭제 API 호출: ${orgCode}`);
      
      // 1. 구글 시트에서 기관 데이터 읽기
      const sheetData = await readSheetData(null, '기관리스트!A:G');
      
      if (!sheetData || sheetData.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: '기관 데이터를 찾을 수 없습니다.'
        });
      }
      
      // 2. 헤더 행과 삭제할 행을 제외한 데이터 필터링
      const headerRow = sheetData[0];
      const filteredData = [headerRow];
      
      let foundOrgToDelete = false;
      
      // 첫 번째 열(A)에 기관 코드가 있다고 가정
      for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (row && row[0] === orgCode) {
          foundOrgToDelete = true;
          console.log(`구글 시트에서 삭제할 기관 찾음: ${row[0]} - ${row[1]}`);
          // 이 행은 건너뛰고 추가하지 않음 (삭제 효과)
        } else {
          filteredData.push(row);
        }
      }
      
      if (!foundOrgToDelete) {
        return res.status(404).json({
          status: 'error',
          message: `기관 코드 ${orgCode}에 해당하는 기관을 시트에서 찾을 수 없습니다.`
        });
      }
      
      // 3. 필터링된 데이터로 시트 업데이트
      await writeSheetData('기관리스트!A:G', filteredData);
      
      console.log(`구글 시트에서 기관 삭제 완료: ${orgCode}`);
      
      return res.status(200).json({
        status: 'success',
        message: '기관이 성공적으로 삭제되었습니다.',
        deletedOrgCode: orgCode
      });
    }
    
    // DELETE 외 다른 메서드는 지원하지 않음
    return res.status(405).json({
      status: 'error',
      message: '지원하지 않는 HTTP 메서드입니다.'
    });
  } catch (error) {
    console.error('기관 삭제 API 오류:', error);
    return res.status(500).json({
      status: 'error',
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
};

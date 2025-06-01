// 일정 삭제 API 엔드포인트
const sheetsHelper = require('./sheets-helper');

module.exports = async (req, res) => {
  const scheduleId = req.params.id;
  console.log(`[api/schedules-delete] 일정 삭제 요청: ${scheduleId}`);
  
  if (!scheduleId) {
    return res.status(400).json({
      status: 'error',
      message: '일정 ID가 필요합니다.'
    });
  }

  try {
    // 1. 먼저 현재 모든 일정 데이터를 가져옵니다.
    let schedulesData;
    try {
      console.log('[api/schedules-delete] 구글 시트에서 현재 일정 데이터 가져오기');
      schedulesData = await sheetsHelper.readSheetData('일정_관리!A:H');
    } catch (sheetError1) {
      console.error('[api/schedules-delete] 일정_관리 시트 접근 실패:', sheetError1.message);
      
      // 대체 방법 1: URL 인코딩 시도
      try {
        console.log('[api/schedules-delete] URL 인코딩된 시트 이름으로 시도');
        const encodedSheetName = encodeURIComponent('일정_관리');
        schedulesData = await sheetsHelper.readSheetData(`${encodedSheetName}!A:H`);
      } catch (sheetError2) {
        console.error('[api/schedules-delete] URL 인코딩된 시트 이름 접근 실패:', sheetError2.message);
        
        // 대체 방법 2: 시트 인덱스 사용 시도
        try {
          console.log('[api/schedules-delete] 시트 인덱스로 시도 (Sheet1)');
          schedulesData = await sheetsHelper.readSheetData('Sheet1!A:H');
        } catch (sheetError3) {
          console.error('[api/schedules-delete] 시트 인덱스 접근 실패:', sheetError3.message);
          return res.status(500).json({
            status: 'error',
            message: '일정 데이터 시트에 접근할 수 없습니다.',
            error: '모든 시트 접근 방법 실패'
          });
        }
      }
    }

    // 2. 헤더 추출 및 삭제할 일정 찾기
    if (!schedulesData || schedulesData.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: '일정 데이터가 없습니다.'
      });
    }

    const headers = schedulesData[0];
    const schedules = schedulesData.slice(1);
    
    // 일정 ID가 있는 열 인덱스 찾기 (보통 첫 번째 열)
    const idColumnIndex = headers.findIndex(header => 
      header.toLowerCase() === 'id' || 
      header.toLowerCase() === '아이디' || 
      header.toLowerCase() === '일정id'
    );
    
    if (idColumnIndex === -1) {
      return res.status(500).json({
        status: 'error',
        message: '일정 ID 열을 찾을 수 없습니다.'
      });
    }

    // 3. 일정 ID로 해당 행 찾기
    const rowIndex = schedules.findIndex(row => row[idColumnIndex] === scheduleId);
    
    if (rowIndex === -1) {
      return res.status(404).json({
        status: 'error',
        message: `ID가 '${scheduleId}'인 일정을 찾을 수 없습니다.`
      });
    }

    // 4. 구글 시트에서 해당 행 삭제
    try {
      // 구글 시트 데이터는 1부터 시작하고, 헤더가 있으므로 +2 해줘야 함
      const actualRowIndex = rowIndex + 2;
      
      console.log(`[api/schedules-delete] 구글 시트에서 ${actualRowIndex}번 행 삭제 시도`);
      
      // 해당 행을 빈 값으로 업데이트하거나, 행 삭제 API 사용
      await sheetsHelper.deleteRow('일정_관리', actualRowIndex);
      
      console.log(`[api/schedules-delete] 일정 삭제 성공: ${scheduleId} (행 ${actualRowIndex})`);
      
      return res.status(200).json({
        status: 'success',
        message: '일정이 성공적으로 삭제되었습니다.',
        deletedId: scheduleId
      });
    } catch (deleteError) {
      console.error('[api/schedules-delete] 일정 삭제 실패:', deleteError);
      
      return res.status(500).json({
        status: 'error',
        message: '구글 시트에서 일정을 삭제하는 중 오류가 발생했습니다.',
        error: deleteError.message
      });
    }
  } catch (error) {
    console.error('[api/schedules-delete] 처리 중 오류 발생:', error);
    
    return res.status(500).json({
      status: 'error',
      message: '일정 삭제 처리 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

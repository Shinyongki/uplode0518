const scheduleModel = require('../models/schedule');
const organizationModel = require('../models/organization');
const committeeModel = require('../models/committee');

/**
 * 모든 일정 가져오기
 */
const getAllSchedules = async (req, res) => {
  try {
    const schedules = await scheduleModel.getAllSchedules();
    return res.status(200).json({
      status: 'success',
      data: { schedules }
    });
  } catch (error) {
    console.error('일정 목록 조회 오류:', error);
    return res.status(500).json({
      status: 'error',
      message: '일정 목록을 가져오는 중 오류가 발생했습니다.'
    });
  }
};

/**
 * 현재 로그인한 위원의 일정 가져오기
 */
const getMySchedules = async (req, res) => {
  try {
    // 인증 미들웨어에서 설정한 사용자 정보 사용
    const committee = req.user;
    
    if (!committee || !committee.id) {
      return res.status(401).json({
        status: 'error',
        message: '인증된 사용자 정보를 찾을 수 없습니다.'
      });
    }
    
    const schedules = await scheduleModel.getSchedulesByCommitteeId(committee.id);
    return res.status(200).json({
      status: 'success',
      data: { schedules }
    });
  } catch (error) {
    console.error('내 일정 목록 조회 오류:', error);
    return res.status(500).json({
      status: 'error',
      message: '일정 목록을 가져오는 중 오류가 발생했습니다.'
    });
  }
};

/**
 * 특정 위원의 일정 가져오기
 */
const getSchedulesByCommitteeId = async (req, res) => {
  try {
    const { committeeId } = req.params;
    
    if (!committeeId) {
      return res.status(400).json({
        status: 'error',
        message: '위원 ID가 필요합니다.'
      });
    }
    
    const schedules = await scheduleModel.getSchedulesByCommitteeId(committeeId);
    return res.status(200).json({
      status: 'success',
      data: { schedules }
    });
  } catch (error) {
    console.error(`위원 ID ${req.params.committeeId}의 일정 목록 조회 오류:`, error);
    return res.status(500).json({
      status: 'error',
      message: '일정 목록을 가져오는 중 오류가 발생했습니다.'
    });
  }
};

/**
 * 특정 기관의 일정 가져오기
 */
const getSchedulesByOrgCode = async (req, res) => {
  try {
    const { orgCode } = req.params;
    
    if (!orgCode) {
      return res.status(400).json({
        status: 'error',
        message: '기관 코드가 필요합니다.'
      });
    }
    
    const schedules = await scheduleModel.getSchedulesByOrgCode(orgCode);
    return res.status(200).json({
      status: 'success',
      data: { schedules }
    });
  } catch (error) {
    console.error(`기관 코드 ${req.params.orgCode}의 일정 목록 조회 오류:`, error);
    return res.status(500).json({
      status: 'error',
      message: '일정 목록을 가져오는 중 오류가 발생했습니다.'
    });
  }
};

/**
 * 특정 날짜 범위의 일정 가져오기
 */
const getSchedulesByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'error',
        message: '시작 날짜와 종료 날짜가 필요합니다.'
      });
    }
    
    // 전체 일정 데이터 가져오기
    let schedules = await scheduleModel.getSchedulesByDateRange(startDate, endDate);
    
    // 사용자 정보 가져오기
    const committee = req.user;
    
    // 일반 위원인 경우 본인의 일정만 필터링
    if (committee && committee.role !== 'master' && committee.id) {
      console.log(`위원 ${committee.name}(${committee.id})의 일정만 필터링합니다.`);
      schedules = schedules.filter(schedule => schedule.committeeId === committee.id);
      console.log(`필터링 후 ${schedules.length}개의 일정이 반환됩니다.`);
    }
    
    return res.status(200).json({
      status: 'success',
      data: { schedules }
    });
  } catch (error) {
    console.error('날짜 범위 일정 목록 조회 오류:', error);
    return res.status(500).json({
      status: 'error',
      message: '일정 목록을 가져오는 중 오류가 발생했습니다.'
    });
  }
};

/**
 * 새 일정 추가
 */
const addSchedule = async (req, res) => {
  try {
    const { committeeId, orgCode, visitDate, startTime, endTime, notes } = req.body;
    
    // 필수 필드 확인
    if (!committeeId || !orgCode || !visitDate) {
      return res.status(400).json({
        status: 'error',
        message: '위원 ID, 기관 코드, 방문 날짜는 필수 항목입니다.'
      });
    }
    
    // 현재 로그인한 사용자 정보 확인
    const loggedInUser = req.user;
    
    // 위원 정보 확인
    let committee;
    try {
      committee = await committeeModel.getCommitteeByEmail(committeeId);
      if (!committee) {
        // ID로 조회 실패 시 모든 위원 목록에서 찾기
        const allCommittees = await committeeModel.getAllCommittees();
        committee = allCommittees.find(c => c.id === committeeId);
      }
    } catch (error) {
      console.error('위원 정보 조회 오류:', error);
    }
    
    if (!committee) {
      return res.status(404).json({
        status: 'error',
        message: '해당 위원을 찾을 수 없습니다.'
      });
    }
    
    // 기관 정보 확인
    let organization;
    try {
      organization = await organizationModel.getOrganizationByCode(orgCode);
    } catch (error) {
      console.error('기관 정보 조회 오류:', error);
    }
    
    if (!organization) {
      return res.status(404).json({
        status: 'error',
        message: '해당 기관을 찾을 수 없습니다.'
      });
    }
    
    // 일정 데이터 생성
    const scheduleData = {
      committeeId: committeeId,
      // 마스터로 로그인한 경우 주담당자 이름으로 설정, 그렇지 않은 경우 기존 로직 유지
      committeeName: loggedInUser && (loggedInUser.role === 'master' || committeeId === loggedInUser.id) ? 
        (committeeId === loggedInUser.id ? loggedInUser.name : committee.name) : committee.name,
      orgCode: orgCode,
      orgName: organization.name || organization.기관명,
      visitDate: visitDate,
      startTime: startTime || '09:00',
      endTime: endTime || '18:00',
      notes: notes || ''
    };
    
    // 일정 추가
    const newSchedule = await scheduleModel.addSchedule(scheduleData);
    
    return res.status(201).json({
      status: 'success',
      data: { schedule: newSchedule },
      message: '일정이 성공적으로 추가되었습니다.'
    });
  } catch (error) {
    console.error('일정 추가 오류:', error);
    return res.status(500).json({
      status: 'error',
      message: '일정을 추가하는 중 오류가 발생했습니다.'
    });
  }
};

/**
 * 일정 업데이트
 */
const updateSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const updateData = req.body;
    
    if (!scheduleId) {
      return res.status(400).json({
        status: 'error',
        message: '일정 ID가 필요합니다.'
      });
    }
    
    // 업데이트할 데이터가 없는 경우
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        status: 'error',
        message: '업데이트할 데이터가 없습니다.'
      });
    }
    
    // 현재 로그인한 사용자 정보 확인
    const loggedInUser = req.user;
    
    // committeeName 필드가 있고 로그인한 사용자의 위원 ID와 일치하는 경우
    // 로그인한 사용자의 이름을 사용
    if (updateData.committeeId && loggedInUser && updateData.committeeId === loggedInUser.id) {
      updateData.committeeName = loggedInUser.name;
    }
    
    // 일정 업데이트
    const updatedSchedule = await scheduleModel.updateSchedule(scheduleId, updateData);
    
    if (!updatedSchedule) {
      return res.status(404).json({
        status: 'error',
        message: '해당 일정을 찾을 수 없습니다.'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      data: { schedule: updatedSchedule },
      message: '일정이 성공적으로 업데이트되었습니다.'
    });
  } catch (error) {
    console.error(`일정 ID ${req.params.scheduleId} 업데이트 오류:`, error);
    return res.status(500).json({
      status: 'error',
      message: '일정을 업데이트하는 중 오류가 발생했습니다.'
    });
  }
};

/**
 * 일정 삭제
 */
const deleteSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    
    if (!scheduleId) {
      return res.status(400).json({
        status: 'error',
        message: '일정 ID가 필요합니다.'
      });
    }
    
    // 일정 삭제
    const success = await scheduleModel.deleteSchedule(scheduleId);
    
    if (!success) {
      return res.status(404).json({
        status: 'error',
        message: '해당 일정을 찾을 수 없습니다.'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      message: '일정이 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    console.error(`일정 ID ${req.params.scheduleId} 삭제 오류:`, error);
    return res.status(500).json({
      status: 'error',
      message: '일정을 삭제하는 중 오류가 발생했습니다.'
    });
  }
};

module.exports = {
  getAllSchedules,
  getMySchedules,
  getSchedulesByCommitteeId,
  getSchedulesByOrgCode,
  getSchedulesByDateRange,
  addSchedule,
  updateSchedule,
  deleteSchedule
};

import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  LinearProgress, 
  Badge,
  Modal,
  Button,
  IconButton,
  Divider
} from '@mui/material';
import { styled } from '@mui/material/styles';
import NotificationsIcon from '@mui/icons-material/Notifications';
import TimelineIcon from '@mui/icons-material/Timeline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CloseIcon from '@mui/icons-material/Close';

interface MonitoringStats {
  activeCount: number;
  completedToday: number;
  pendingCount: number;
  urgentCount: number;
  lastUpdate: string;
  status: 'normal' | 'warning' | 'danger';
  contactPerson?: string;
  contactNumber?: string;
  weeklyStats?: {
    date: string;
    completed: number;
  }[];
}

interface OrganizationCardProps {
  name: string;
  code: string;
  location: string;
  monitoringStats: MonitoringStats;
  onClick?: () => void;
}

const StatusBadge = styled(Badge)(({ theme, status }: { theme: any, status: string }) => ({
  '& .MuiBadge-badge': {
    backgroundColor: 
      status === 'normal' ? theme.palette.success.main :
      status === 'warning' ? theme.palette.warning.main :
      theme.palette.error.main,
  },
}));

const ModalContent = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[24],
  padding: theme.spacing(4),
  maxHeight: '80vh',
  overflowY: 'auto',
}));

const OrganizationCard = ({ name, code, location, monitoringStats, onClick }: OrganizationCardProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const progressValue = (monitoringStats.completedToday / (monitoringStats.activeCount || 1)) * 100;

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  return (
    <>
      <Card 
        sx={{ minWidth: 275, position: 'relative', cursor: 'pointer' }}
        onClick={onClick}
      >
        <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
          <StatusBadge
            status={monitoringStats.status}
            badgeContent=""
            variant="dot"
          >
            <NotificationsIcon />
          </StatusBadge>
        </Box>
        
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {name}
          </Typography>
          <Typography color="textSecondary" gutterBottom>
            {code}
          </Typography>
          <Typography color="textSecondary" mb={2}>
            {location}
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              모니터링 현황
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={progressValue}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>

          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
            <Box>
              <Typography variant="body2" color="textSecondary">
                활성 모니터링
              </Typography>
              <Typography variant="h6">
                {monitoringStats.activeCount}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="textSecondary">
                오늘 처리
              </Typography>
              <Typography variant="h6">
                {monitoringStats.completedToday}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="textSecondary">
                대기 중
              </Typography>
              <Typography variant="h6">
                {monitoringStats.pendingCount}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="textSecondary" sx={{ color: 'error.main' }}>
                긴급 대응
              </Typography>
              <Typography variant="h6" sx={{ color: 'error.main' }}>
                {monitoringStats.urgentCount}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimelineIcon fontSize="small" />
            <Typography variant="caption" color="textSecondary">
              마지막 업데이트: {monitoringStats.lastUpdate}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        aria-labelledby="organization-detail-modal"
      >
        <ModalContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" component="h2">
              {name} 상세 정보
            </Typography>
            <IconButton onClick={handleCloseModal}>
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" gutterBottom>
            기본 정보
          </Typography>
          <Box sx={{ mb: 3 }}>
            <Typography><strong>기관 코드:</strong> {code}</Typography>
            <Typography><strong>위치:</strong> {location}</Typography>
            <Typography><strong>담당자:</strong> {monitoringStats.contactPerson || '미지정'}</Typography>
            <Typography><strong>연락처:</strong> {monitoringStats.contactNumber || '미지정'}</Typography>
          </Box>

          <Typography variant="h6" gutterBottom>
            모니터링 현황
          </Typography>
          <Box sx={{ mb: 3 }}>
            <Typography><strong>현재 상태:</strong> {
              monitoringStats.status === 'normal' ? '정상' :
              monitoringStats.status === 'warning' ? '주의' : '위험'
            }</Typography>
            <Typography><strong>활성 모니터링:</strong> {monitoringStats.activeCount}건</Typography>
            <Typography><strong>오늘 처리된 건수:</strong> {monitoringStats.completedToday}건</Typography>
            <Typography><strong>대기 중:</strong> {monitoringStats.pendingCount}건</Typography>
            <Typography sx={{ color: 'error.main' }}>
              <strong>긴급 대응 필요:</strong> {monitoringStats.urgentCount}건
            </Typography>
          </Box>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button variant="outlined" onClick={handleCloseModal}>
              닫기
            </Button>
            <Button variant="contained" color="primary">
              상세 보고서
            </Button>
          </Box>
        </ModalContent>
      </Modal>
    </>
  );
};

export default OrganizationCard; 
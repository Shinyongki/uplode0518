import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Divider,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

interface WeeklyStats {
  date: string;
  completed: number;
  active: number;
  pending: number;
}

interface OrganizationReportProps {
  name: string;
  code: string;
  weeklyStats: WeeklyStats[];
  onExportCSV: () => void;
  onExportPDF: () => void;
}

const OrganizationReport = ({
  name,
  code,
  weeklyStats,
  onExportCSV,
  onExportPDF,
}: OrganizationReportProps) => {
  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          {name} ({code}) 주간 보고서
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={onExportCSV}
          >
            CSV 내보내기
          </Button>
          <Button
            variant="contained"
            startIcon={<FileDownloadIcon />}
            onClick={onExportPDF}
          >
            PDF 내보내기
          </Button>
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle1" gutterBottom>
        주간 모니터링 현황
      </Typography>
      
      <Box sx={{ height: 400, mt: 2 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={weeklyStats}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="completed"
              name="처리 완료"
              stroke="#4caf50"
              activeDot={{ r: 8 }}
            />
            <Line
              type="monotone"
              dataKey="active"
              name="활성"
              stroke="#2196f3"
            />
            <Line
              type="monotone"
              dataKey="pending"
              name="대기"
              stroke="#ff9800"
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>

      <Typography variant="subtitle1" sx={{ mt: 4, mb: 2 }}>
        주요 통계
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4" color="primary">
            {weeklyStats.reduce((sum, stat) => sum + stat.completed, 0)}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            주간 총 처리 건수
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4" color="info.main">
            {Math.round(
              (weeklyStats.reduce((sum, stat) => sum + stat.completed, 0) /
                weeklyStats.reduce((sum, stat) => sum + stat.active, 0)) * 100
            )}%
          </Typography>
          <Typography variant="body2" color="textSecondary">
            주간 처리율
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4" color="warning.main">
            {Math.max(...weeklyStats.map(stat => stat.pending))}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            최대 대기 건수
          </Typography>
        </Paper>
      </Box>
    </Paper>
  );
};

export default OrganizationReport; 
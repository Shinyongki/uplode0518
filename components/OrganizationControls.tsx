import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  SelectChangeEvent,
} from '@mui/material';

interface OrganizationControlsProps {
  statusFilter: string;
  sortBy: string;
  onStatusFilterChange: (value: string) => void;
  onSortChange: (value: string) => void;
}

const OrganizationControls = ({
  statusFilter,
  sortBy,
  onStatusFilterChange,
  onSortChange,
}: OrganizationControlsProps) => {
  const handleStatusChange = (event: SelectChangeEvent) => {
    onStatusFilterChange(event.target.value);
  };

  const handleSortChange = (event: SelectChangeEvent) => {
    onSortChange(event.target.value);
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
      <FormControl sx={{ minWidth: 200 }}>
        <InputLabel>상태 필터</InputLabel>
        <Select
          value={statusFilter}
          label="상태 필터"
          onChange={handleStatusChange}
        >
          <MenuItem value="all">전체</MenuItem>
          <MenuItem value="normal">정상</MenuItem>
          <MenuItem value="warning">주의</MenuItem>
          <MenuItem value="danger">위험</MenuItem>
        </Select>
      </FormControl>

      <FormControl sx={{ minWidth: 200 }}>
        <InputLabel>정렬 기준</InputLabel>
        <Select
          value={sortBy}
          label="정렬 기준"
          onChange={handleSortChange}
        >
          <MenuItem value="urgentCount">긴급도순</MenuItem>
          <MenuItem value="completionRate">처리율순</MenuItem>
          <MenuItem value="activeCount">활성 건수순</MenuItem>
          <MenuItem value="lastUpdate">최신순</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
};

export default OrganizationControls; 
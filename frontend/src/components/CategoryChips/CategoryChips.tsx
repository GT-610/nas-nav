import React from 'react';
import {
  Box,
  Chip,
  Typography,
} from '@mui/material';
import type { Category } from '../../types';

interface CategoryChipsProps {
  categories: Category[];
  selectedCategoryId: number | null;
  onCategoryChange: (categoryId: number | null) => void;
}

const CategoryChips: React.FC<CategoryChipsProps> = ({
  categories,
  selectedCategoryId,
  onCategoryChange,
}) => {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" gutterBottom>
        分类筛选
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {/* 全部分类 */}
        <Chip
          label="全部"
          onClick={() => onCategoryChange(null)}
          color={selectedCategoryId === null ? 'primary' : 'default'}
          variant={selectedCategoryId === null ? 'filled' : 'outlined'}
          sx={{ cursor: 'pointer' }}
        />
        
        {/* 各个分类 */}
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={`${category.name} (${category.service_count || 0})`}
            onClick={() => onCategoryChange(category.id)}
            color={selectedCategoryId === category.id ? 'primary' : 'default'}
            variant={selectedCategoryId === category.id ? 'filled' : 'outlined'}
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Box>
    </Box>
  );
};

export default CategoryChips;

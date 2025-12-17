import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Alert,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
} from '@mui/icons-material';
import { categoryApi } from '../../../services/api';
import type { Category } from '../../../types';

const CategoriesTab: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('添加分类');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
  });
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null);

  // 获取分类数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await categoryApi.getAll();
        setCategories(response);
      } catch (err) {
        setError('获取数据失败，请稍后重试');
        console.error('Error fetching categories:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 打开添加分类对话框
  const handleAddCategory = () => {
    setEditingCategory(null);
    setDialogTitle('添加分类');
    setFormData({
      name: '',
    });
    setDialogOpen(true);
  };

  // 打开编辑分类对话框
  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setDialogTitle('编辑分类');
    setFormData({
      name: category.name,
    });
    setDialogOpen(true);
  };

  // 保存分类
  const handleSaveCategory = async () => {
    if (!formData.name.trim()) {
      setError('分类名称不能为空');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (editingCategory) {
        // 更新分类
        const response = await categoryApi.update(editingCategory.id, formData);
        setCategories(categories.map(category => 
          category.id === editingCategory.id ? response : category
        ));
        setSnackbarMessage('分类更新成功');
      } else {
        // 添加分类
        const response = await categoryApi.create(formData);
        setCategories([...categories, response]);
        setSnackbarMessage('分类添加成功');
      }

      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setDialogOpen(false);
    } catch (err) {
      setError('保存失败，请稍后重试');
      setSnackbarMessage('操作失败');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      console.error('Error saving category:', err);
    } finally {
      setLoading(false);
    }
  };

  // 打开删除确认对话框
  const handleDeleteCategory = (categoryId: number) => {
    setCategoryToDelete(categoryId);
    setDeleteConfirmOpen(true);
  };

  // 确认删除分类
  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;

    try {
      setLoading(true);
      await categoryApi.delete(categoryToDelete);
      setCategories(categories.filter(category => category.id !== categoryToDelete));
      setSnackbarMessage('分类删除成功');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setDeleteConfirmOpen(false);
    } catch (err) {
      setSnackbarMessage('删除失败，请稍后重试');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      console.error('Error deleting category:', err);
    } finally {
      setLoading(false);
      setCategoryToDelete(null);
    }
  };

  return (
    <Box>
      {/* 添加分类按钮 */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAddCategory}
        >
          添加分类
        </Button>
      </Box>

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 分类列表 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 400 }}>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>名称</TableCell>
                <TableCell>服务数量</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categories.map(category => (
                <TableRow key={category.id}>
                  <TableCell>{category.id}</TableCell>
                  <TableCell>{category.name}</TableCell>
                  <TableCell>{category.service_count || 0}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleEditCategory(category)} color="primary">
                      <Edit />
                    </IconButton>
                    <IconButton onClick={() => handleDeleteCategory(category.id)} color="error">
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 分类编辑对话框 */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="分类名称"
            variant="outlined"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSaveCategory} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          确定要删除该分类吗？此操作不可恢复。
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>取消</Button>
          <Button variant="contained" color="error" onClick={confirmDeleteCategory} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : '删除'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 操作结果提示 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CategoriesTab;

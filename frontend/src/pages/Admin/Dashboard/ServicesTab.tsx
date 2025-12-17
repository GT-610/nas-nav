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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
import { serviceApi, categoryApi } from '../../../services/api';
import type { Service, Category } from '../../../types';

const ServicesTab: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('添加服务');
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    icon: '',
    category_id: 0,
    ip: '',
    domain: '',
    description: '',
    sort_order: 999,
  });
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<number | null>(null);

  // 获取服务和分类数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [servicesResponse, categoriesResponse] = await Promise.all([
          serviceApi.getAll(),
          categoryApi.getAll(),
        ]);

        setServices(servicesResponse.data);
        setCategories(categoriesResponse.data);
      } catch (err) {
        setError('获取数据失败，请稍后重试');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 打开添加服务对话框
  const handleAddService = () => {
    setEditingService(null);
    setDialogTitle('添加服务');
    setFormData({
      name: '',
      icon: '',
      category_id: categories[0]?.id || 0,
      ip: '',
      domain: '',
      description: '',
      sort_order: 999,
    });
    setDialogOpen(true);
  };

  // 打开编辑服务对话框
  const handleEditService = (service: Service) => {
    setEditingService(service);
    setDialogTitle('编辑服务');
    setFormData({
      name: service.name,
      icon: service.icon,
      category_id: service.category_id,
      ip: service.ip,
      domain: service.domain,
      description: service.description,
      sort_order: service.sort_order,
    });
    setDialogOpen(true);
  };

  // 保存服务
  const handleSaveService = async () => {
    if (!formData.name.trim() || !formData.domain.trim()) {
      setError('服务名称和域名不能为空');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (editingService) {
        // 更新服务
        const response = await serviceApi.update(editingService.id, formData);
        setServices(services.map(service => 
          service.id === editingService.id ? response.data : service
        ));
        setSnackbarMessage('服务更新成功');
      } else {
        // 添加服务
        const response = await serviceApi.create(formData);
        setServices([...services, response.data]);
        setSnackbarMessage('服务添加成功');
      }

      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setDialogOpen(false);
    } catch (err) {
      setError('保存失败，请稍后重试');
      setSnackbarMessage('操作失败');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      console.error('Error saving service:', err);
    } finally {
      setLoading(false);
    }
  };

  // 打开删除确认对话框
  const handleDeleteService = (serviceId: number) => {
    setServiceToDelete(serviceId);
    setDeleteConfirmOpen(true);
  };

  // 确认删除服务
  const confirmDeleteService = async () => {
    if (!serviceToDelete) return;

    try {
      setLoading(true);
      await serviceApi.delete(serviceToDelete);
      setServices(services.filter(service => service.id !== serviceToDelete));
      setSnackbarMessage('服务删除成功');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setDeleteConfirmOpen(false);
    } catch (err) {
      setSnackbarMessage('删除失败，请稍后重试');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      console.error('Error deleting service:', err);
    } finally {
      setLoading(false);
      setServiceToDelete(null);
    }
  };

  return (
    <Box>
      {/* 添加服务按钮 */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAddService}
        >
          添加服务
        </Button>
      </Box>

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 服务列表 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>名称</TableCell>
                <TableCell>图标</TableCell>
                <TableCell>分类</TableCell>
                <TableCell>IP地址</TableCell>
                <TableCell>域名</TableCell>
                <TableCell>描述</TableCell>
                <TableCell>排序</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {services.map(service => {
                const category = categories.find(cat => cat.id === service.category_id);
                return (
                  <TableRow key={service.id}>
                    <TableCell>{service.id}</TableCell>
                    <TableCell>{service.name}</TableCell>
                    <TableCell>
                      {service.icon && (
                        <img
                          src={service.icon}
                          alt={service.name}
                          style={{ width: 32, height: 32, borderRadius: '50%' }}
                        />
                      )}
                    </TableCell>
                    <TableCell>{category?.name || '未分类'}</TableCell>
                    <TableCell>{service.ip}</TableCell>
                    <TableCell>{service.domain}</TableCell>
                    <TableCell>{service.description}</TableCell>
                    <TableCell>{service.sort_order}</TableCell>
                    <TableCell>
                      <IconButton onClick={() => handleEditService(service)} color="primary">
                        <Edit />
                      </IconButton>
                      <IconButton onClick={() => handleDeleteService(service.id)} color="error">
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 服务编辑对话框 */}
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
            label="服务名称"
            variant="outlined"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="服务图标 URL"
            variant="outlined"
            value={formData.icon}
            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>所属分类</InputLabel>
            <Select
              value={formData.category_id}
              label="所属分类"
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value as number })}
            >
              {categories.map(category => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="IP 地址"
            variant="outlined"
            value={formData.ip}
            onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="域名地址"
            variant="outlined"
            value={formData.domain}
            onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="服务描述"
            variant="outlined"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            multiline
            rows={3}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="排序顺序"
            type="number"
            variant="outlined"
            value={formData.sort_order}
            onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 999 })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSaveService} disabled={loading}>
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
          确定要删除该服务吗？此操作不可恢复。
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>取消</Button>
          <Button variant="contained" color="error" onClick={confirmDeleteService} disabled={loading}>
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

export default ServicesTab;

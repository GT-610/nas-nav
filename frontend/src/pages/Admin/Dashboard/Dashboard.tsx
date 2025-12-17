import React, { useState } from 'react';
import {
  Container,
  Box,
  AppBar,
  Toolbar,
  Typography,
  Tabs,
  Tab,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  ExitToApp,
  Lock,
} from '@mui/icons-material';
import ServicesTab from './ServicesTab';
import CategoriesTab from './CategoriesTab';
import { authApi } from '../../../services/api';
import type { ChangePasswordRequest } from '../../../types';

interface DashboardProps {
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      onLogout();
    }
  };

  const handlePasswordSubmit = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的密码不一致');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('新密码长度不能少于6位');
      return;
    }

    try {
      setPasswordLoading(true);
      setPasswordError(null);

      const passwordData: ChangePasswordRequest = {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      };

      await authApi.changePassword(passwordData);
      setPasswordSuccess(true);

      // 重置表单
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // 2秒后关闭对话框
      setTimeout(() => {
        setPasswordDialogOpen(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (err) {
      setPasswordError('密码修改失败，请检查当前密码是否正确');
      console.error('Change password error:', err);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      {/* 顶部导航栏 */}
      <AppBar position="static">
        <Container maxWidth="xl">
          <Toolbar disableGutters>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              NAS 导航站 - 管理后台
            </Typography>
            
            <IconButton
              color="inherit"
              onClick={() => setPasswordDialogOpen(true)}
              title="修改密码"
            >
              <Lock />
            </IconButton>
            
            <Button
              color="inherit"
              variant="outlined"
              startIcon={<ExitToApp />}
              onClick={handleLogout}
              sx={{ ml: 2, textTransform: 'none' }}
            >
              退出登录
            </Button>
          </Toolbar>
        </Container>
      </AppBar>

      {/* 主内容区 */}
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* 标签页 */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            aria-label="管理标签页"
          >
            <Tab label="服务管理" />
            <Tab label="分类管理" />
          </Tabs>
        </Box>

        {/* 标签页内容 */}
        <Box sx={{ mt: 2 }}>
          {activeTab === 0 && <ServicesTab />}
          {activeTab === 1 && <CategoriesTab />}
        </Box>
      </Container>

      {/* 修改密码对话框 */}
      <Dialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>修改密码</DialogTitle>
        <DialogContent>
          {passwordSuccess ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              密码修改成功！
            </Alert>
          ) : passwordError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {passwordError}
            </Alert>
          ) : null}

          <TextField
            fullWidth
            label="当前密码"
            type="password"
            variant="outlined"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            sx={{ mb: 2 }}
            disabled={passwordLoading}
          />

          <TextField
            fullWidth
            label="新密码"
            type="password"
            variant="outlined"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            sx={{ mb: 2 }}
            disabled={passwordLoading}
          />

          <TextField
            fullWidth
            label="确认新密码"
            type="password"
            variant="outlined"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            sx={{ mb: 2 }}
            disabled={passwordLoading}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setPasswordDialogOpen(false)}
            disabled={passwordLoading}
          >
            取消
          </Button>
          <Button
            variant="contained"
            onClick={handlePasswordSubmit}
            disabled={passwordLoading}
          >
            {passwordLoading ? <CircularProgress size={24} /> : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;

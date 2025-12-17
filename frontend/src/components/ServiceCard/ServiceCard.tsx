import React from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  IconButton,
  Tooltip,
} from '@mui/material';
import { OpenInNew, Info } from '@mui/icons-material';
import type { Service } from '../../types';

interface ServiceCardProps {
  service: Service;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service }) => {
  const handleOpenService = () => {
    // 优先使用域名，其次使用IP
    const url = service.domain || service.ip;
    if (url) {
      window.open(`http://${url}`, '_blank');
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Tooltip title="访问服务">
          <IconButton size="small" onClick={handleOpenService}>
            <OpenInNew />
          </IconButton>
        </Tooltip>
      </Box>
      
      <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
        {service.icon ? (
          <CardMedia
            component="img"
            image={service.icon}
            alt={service.name}
            sx={{ width: 80, height: 80, margin: '0 auto 16px', borderRadius: '50%' }}
          />
        ) : (
          <Box
            sx={{
              width: 80,
              height: 80,
              margin: '0 auto 16px',
              borderRadius: '50%',
              backgroundColor: 'primary.light',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Info sx={{ fontSize: 40, color: 'white' }} />
          </Box>
        )}
        
        <Typography gutterBottom variant="h6" component="h2">
          {service.name}
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {service.category?.name || ''}
        </Typography>
        
        <Typography variant="body2" color="text.secondary">
          {service.description || '暂无描述'}
        </Typography>
        
        <Box sx={{ mt: 2 }}>
          {service.domain && (
            <Typography variant="caption" color="text.secondary">
              {service.domain}
            </Typography>
          )}
          {service.ip && !service.domain && (
            <Typography variant="caption" color="text.secondary">
              {service.ip}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default ServiceCard;

import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Settings } from '@mui/icons-material';
import ServiceCard from '../../components/ServiceCard/ServiceCard';
import CategoryChips from '../../components/CategoryChips/CategoryChips';
import SearchBar from '../../components/SearchBar/SearchBar';
import { serviceApi, categoryApi } from '../../services/api';
import type { Service, Category } from '../../types';

const Home: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 并行请求服务和分类数据
        const [servicesResponse, categoriesResponse] = await Promise.all([
          serviceApi.getAll(),
          categoryApi.getAll(),
        ]);

        // API响应拦截器已经处理过，直接获取数据
        const fetchedServices = servicesResponse;
        const fetchedCategories = categoriesResponse;

        // 为服务添加分类信息
        const servicesWithCategories = fetchedServices.map((service: Service) => {
          const category = fetchedCategories.find(
            (cat: Category) => cat.id === service.category_id
          );
          return {
            ...service,
            category,
          };
        });

        // 为分类添加服务数量
        const categoriesWithCount = fetchedCategories.map((category: Category) => {
          const count = fetchedServices.filter(
            (service: Service) => service.category_id === category.id
          ).length;
          return {
            ...category,
            service_count: count,
          };
        });

        setServices(servicesWithCategories);
        setCategories(categoriesWithCount);
        setFilteredServices(servicesWithCategories);
      } catch (err) {
        setError('获取数据失败，请稍后重试');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 筛选服务
  useEffect(() => {
    let result = [...services];

    // 按分类筛选
    if (selectedCategoryId !== null) {
      result = result.filter((service) => service.category_id === selectedCategoryId);
    }

    // 按搜索词筛选
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (service) =>
          service.name.toLowerCase().includes(term) ||
          service.description.toLowerCase().includes(term) ||
          service.domain.toLowerCase().includes(term) ||
          service.ip.toLowerCase().includes(term) ||
          service.category?.name.toLowerCase().includes(term)
      );
    }

    // 按排序字段排序
    result.sort((a, b) => a.sort_order - b.sort_order);

    setFilteredServices(result);
  }, [services, selectedCategoryId, searchTerm]);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      {/* 顶部导航栏 */}
      <Box sx={{ backgroundColor: 'primary.main', color: 'white', py: 2 }}>
        <Container>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 500 }}>
              NAS 服务导航
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<Settings />}
              href="/admin"
              sx={{ textTransform: 'none' }}
            >
              管理后台
            </Button>
          </Box>
        </Container>
      </Box>

      {/* 主内容区 */}
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* 搜索栏 */}
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        {/* 分类筛选 */}
        <CategoryChips
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onCategoryChange={setSelectedCategoryId}
        />

        {/* 服务列表 */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        ) : filteredServices.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <Typography variant="h6" color="text.secondary">
              未找到匹配的服务
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              请尝试其他搜索关键词或浏览所有分类
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {filteredServices.map((service) => (
              <Box key={service.id} sx={{ flex: '1 1 250px' }}>
                <ServiceCard service={service} />
              </Box>
            ))}
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default Home;

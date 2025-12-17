import axios from 'axios';
import type { Service, Category, LoginRequest, ChangePasswordRequest } from '../types';

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 服务相关API
export const serviceApi = {
  // 获取所有服务（公开API）
  getAll: async (): Promise<Service[]> => {
    const { data } = await api.get('/public/services');
    // 转换后端返回的ip_url和domain_url为前端期望的ip和domain
    return (data as any[]).map(service => ({
      ...service,
      ip: service.ip_url,
      domain: service.domain_url,
    })) as Service[];
  },
  
  // 获取服务详情
  getById: async (id: number): Promise<Service> => {
    const { data } = await api.get(`/services/${id}`);
    // 转换后端返回的ip_url和domain_url为前端期望的ip和domain
    return {
      ...data,
      ip: data.ip_url,
      domain: data.domain_url,
    } as Service;
  },
  
  // 添加服务
  create: async (service: Omit<Service, 'id' | 'created_at' | 'updated_at'>): Promise<Service> => {
    // 转换前端字段名称为后端期望的格式
    const formattedService = {
      name: service.name,
      ip_url: service.ip,
      domain_url: service.domain,
      category_id: service.category_id,
      description: service.description,
      icon: service.icon,
    };
    const { data } = await api.post('/services', formattedService);
    return data as Service;
  },
  
  // 更新服务
  update: async (id: number, service: Omit<Service, 'id' | 'created_at' | 'updated_at'>): Promise<Service> => {
    // 转换前端字段名称为后端期望的格式
    const formattedService = {
      name: service.name,
      ip_url: service.ip,
      domain_url: service.domain,
      category_id: service.category_id,
      description: service.description,
      icon: service.icon,
    };
    const { data } = await api.put(`/services/${id}`, formattedService);
    return data as Service;
  },
  
  // 删除服务
  delete: async (id: number): Promise<void> => {
    await api.delete(`/services/${id}`);
  },
};

// 分类相关API
export const categoryApi = {
  // 获取所有分类（公开API）
  getAll: async (): Promise<Category[]> => {
    const { data } = await api.get('/public/categories');
    return data as Category[];
  },
  
  // 获取分类详情
  getById: async (id: number): Promise<Category> => {
    const { data } = await api.get(`/categories/${id}`);
    return data as Category;
  },
  
  // 添加分类
  create: async (category: Omit<Category, 'id' | 'created_at' | 'updated_at' | 'service_count'>): Promise<Category> => {
    const { data } = await api.post('/categories', category);
    return data as Category;
  },
  
  // 更新分类
  update: async (id: number, category: Omit<Category, 'id' | 'created_at' | 'updated_at' | 'service_count'>): Promise<Category> => {
    const { data } = await api.put(`/categories/${id}`, category);
    return data as Category;
  },
  
  // 删除分类
  delete: async (id: number): Promise<void> => {
    await api.delete(`/categories/${id}`);
  },
};

// 认证相关API
export const authApi = {
  // 登录
  login: async (data: LoginRequest): Promise<void> => {
    await api.post('/auth/login', data);
  },
  
  // 修改密码
  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    await api.post('/auth/change-password', data);
  },
  
  // 退出登录
  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },
};

export default api;

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

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证token
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    // 后端直接返回数据，没有包裹在data字段中，所以直接返回response.data
    return response.data;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 服务相关API
export const serviceApi = {
  // 获取所有服务（公开API）
  getAll: async () => {
    const response = await api.get<Service[]>('/public/services');
    return response as unknown as Service[];
  },
  
  // 获取服务详情
  getById: async (id: number) => {
    const response = await api.get<Service>(`/services/${id}`);
    return response as unknown as Service;
  },
  
  // 添加服务
  create: async (service: Omit<Service, 'id' | 'created_at' | 'updated_at'>) => {
    const response = await api.post<Service>('/services', service);
    return response as unknown as Service;
  },
  
  // 更新服务
  update: async (id: number, service: Omit<Service, 'id' | 'created_at' | 'updated_at'>) => {
    const response = await api.put<Service>(`/services/${id}`, service);
    return response as unknown as Service;
  },
  
  // 删除服务
  delete: async (id: number) => {
    const response = await api.delete<void>(`/services/${id}`);
    return response as unknown as void;
  },
};

// 分类相关API
export const categoryApi = {
  // 获取所有分类（公开API）
  getAll: async () => {
    const response = await api.get<Category[]>('/public/categories');
    return response as unknown as Category[];
  },
  
  // 获取分类详情
  getById: async (id: number) => {
    const response = await api.get<Category>(`/categories/${id}`);
    return response as unknown as Category;
  },
  
  // 添加分类
  create: async (category: Omit<Category, 'id' | 'created_at' | 'updated_at' | 'service_count'>) => {
    const response = await api.post<Category>('/categories', category);
    return response as unknown as Category;
  },
  
  // 更新分类
  update: async (id: number, category: Omit<Category, 'id' | 'created_at' | 'updated_at' | 'service_count'>) => {
    const response = await api.put<Category>(`/categories/${id}`, category);
    return response as unknown as Category;
  },
  
  // 删除分类
  delete: async (id: number) => {
    const response = await api.delete<void>(`/categories/${id}`);
    return response as unknown as void;
  },
};

// 认证相关API
export const authApi = {
  // 登录
  login: async (data: LoginRequest) => {
    const response = await api.post<void>('/auth/login', data);
    return response as unknown as void;
  },
  
  // 修改密码
  changePassword: async (data: ChangePasswordRequest) => {
    const response = await api.post<void>('/auth/change-password', data);
    return response as unknown as void;
  },
  
  // 退出登录
  logout: async () => {
    const response = await api.post<void>('/auth/logout');
    return response as unknown as void;
  },
};

export default api;

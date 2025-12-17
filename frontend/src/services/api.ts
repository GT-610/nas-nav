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
    // 如果响应是ApiResponse<T>类型，则返回内部的data属性
    return response.data.data;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 服务相关API
export const serviceApi = {
  // 获取所有服务
  getAll: () => api.get<Service[]>('/services'),
  
  // 获取服务详情
  getById: (id: number) => api.get<Service>(`/services/${id}`),
  
  // 添加服务
  create: (service: Omit<Service, 'id' | 'created_at' | 'updated_at'>) => 
    api.post<Service>('/services', service),
  
  // 更新服务
  update: (id: number, service: Omit<Service, 'id' | 'created_at' | 'updated_at'>) => 
    api.put<Service>(`/services/${id}`, service),
  
  // 删除服务
  delete: (id: number) => api.delete<void>(`/services/${id}`),
};

// 分类相关API
export const categoryApi = {
  // 获取所有分类
  getAll: () => api.get<Category[]>('/categories'),
  
  // 获取分类详情
  getById: (id: number) => api.get<Category>(`/categories/${id}`),
  
  // 添加分类
  create: (category: Omit<Category, 'id' | 'created_at' | 'updated_at' | 'service_count'>) => 
    api.post<Category>('/categories', category),
  
  // 更新分类
  update: (id: number, category: Omit<Category, 'id' | 'created_at' | 'updated_at' | 'service_count'>) => 
    api.put<Category>(`/categories/${id}`, category),
  
  // 删除分类
  delete: (id: number) => api.delete<void>(`/categories/${id}`),
};

// 认证相关API
export const authApi = {
  // 登录
  login: (data: LoginRequest) => api.post<void>('/auth/login', data),
  
  // 修改密码
  changePassword: (data: ChangePasswordRequest) => api.post<void>('/auth/change-password', data),
  
  // 退出登录
  logout: () => api.post<void>('/auth/logout'),
};

export default api;

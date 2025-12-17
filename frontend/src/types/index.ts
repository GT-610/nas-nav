// 服务类型
export interface Service {
  id: number;
  name: string;
  icon: string;
  category_id: number;
  ip: string;
  domain: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  category?: Category; // 关联的分类信息
}

// 分类类型
export interface Category {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  service_count?: number; // 该分类下的服务数量
}

// API响应类型
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 登录请求类型
export interface LoginRequest {
  password: string;
}

// 密码修改请求类型
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

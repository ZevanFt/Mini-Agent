import request from '@/utils/request';

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  status: number;
  createdAt: string;
}

export interface LoginParams {
  username: string;
  password: string;
}

export const login = (data: LoginParams) => {
  return request.post('/auth/login', data);
};

export const getUserList = (params: { page: number; pageSize: number; keyword?: string }) => {
  return request.get('/users', { params });
};

export const createUser = (data: Partial<User>) => {
  return request.post('/users', data);
};

export const updateUser = (id: number, data: Partial<User>) => {
  return request.put(`/users/${id}`, data);
};

export const deleteUser = (id: number) => {
  return request.delete(`/users/${id}`);
};

export const getRoleList = () => {
  return request.get('/roles');
};

export const getMenuList = () => {
  return request.get('/menus');
};

export const getLogList = (params: { page: number; pageSize: number }) => {
  return request.get('/logs', { params });
};
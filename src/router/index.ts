import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login.vue')
  },
  {
    path: '/',
    component: () => import('@/layouts/default.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard.vue'),
        meta: { title: '仪表板' }
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/users.vue'),
        meta: { title: '用户管理' }
      },
      {
        path: 'roles',
        name: 'Roles',
        component: () => import('@/views/roles.vue'),
        meta: { title: '角色管理' }
      },
      {
        path: 'menus',
        name: 'Menus',
        component: () => import('@/views/menus.vue'),
        meta: { title: '菜单管理' }
      },
      {
        path: 'logs',
        name: 'Logs',
        component: () => import('@/views/logs.vue'),
        meta: { title: '系统日志' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/settings.vue'),
        meta: { title: '个人设置' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/404.vue')
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
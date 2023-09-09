import { createRouter, createWebHistory } from 'vue-router'
import Index from "@/components/views/Index.vue"
import Characters from '@/components/views/Characters.vue'
import L2D from '@/components/views/L2D.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Index
    },
    {
      path: '/c',
      name: 'Characters',
      component: Characters
    },
    {
      path: '/v',
      name: 'Live2D',
      component: L2D
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'any',
      component: Index
    },
    // {
      // path: '/about',
      // name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      // component: () => import('../views/AboutView.vue')
    // }
  ]
})

export default router

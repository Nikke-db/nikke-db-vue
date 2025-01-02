import { createRouter, createWebHistory } from 'vue-router'
import Index from '@/components/views/Index.vue'
import L2D from '@/components/views/L2D.vue'
import Credits from '@/components/views/Credits.vue'
import Tools from '@/components/views/Tools.vue'
import Chibi from '@/components/views/Chibi.vue'
import Gallery from '@/components/views/Gallery.vue'
import TierListMaker from '@/components/views/Tierlistmaker.vue'
import HighAndLowQualityAssets from '@/components/views/notices/HighAndLowQualityAssets.vue'
import AttachmentEditor from '@/components/views/notices/AttachmentEditor.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Index
    },
    {
      path: '/v',
      redirect: {
        path: '/visualiser'
      }
    },
    {
      path: '/v_m',
      redirect: {
        path: '/visualiser'
      }
    },
    {
      path: '/visualiser',
      name: 'visualiser',
      component: L2D
    },
    {
      path: '/credits',
      name: 'credits',
      component: Credits
    },
    {
      path: '/t',
      redirect: {
        path: '/tools'
      }
    },
    {
      path: '/tools',
      name: 'tools',
      component: Tools
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'any',
      component: Index
    },
    {
      path: '/chibi',
      name: 'chibi',
      component: Chibi
    },
    {
      path: '/gallery',
      name: 'gallery',
      component: Gallery
    },
    {
      path: '/tierlistmaker',
      name: 'tierlistmaker',
      component: TierListMaker
    },
    {
      path: '/notice/HQvqLQAssets',
      name: 'HQvqLQAssets',
      component: HighAndLowQualityAssets
    },
    {
      path: '/notice/layerEditor',
      name: 'layerEditor',
      component: AttachmentEditor
    }
    // {
    // path: '/about',
    // name: 'about',
    // route level code-splitting
    // this generates a separate chunk (About.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    // component: () => import('../views/AboutView.vue')
    // }
  ],
  scrollBehavior() {
    return { top: 0 }
  }
})

export default router

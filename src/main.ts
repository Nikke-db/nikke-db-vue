import { createApp } from 'vue'
import { createPinia } from 'pinia'
import naive from 'naive-ui'

import Wrapper from './Wrapper.vue'
import router from './router'

const pinia = createPinia()

const app = createApp(Wrapper)

app.use(pinia)
app.use(router)
app.use(naive)

app.mount('#app')

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider'


export const useMessageStore = defineStore('message', () => {
  const message: MessageApiInjection | any = ref('')
  const long_message = { duration: 10000 }

  const setMessage = (messageInjection: MessageApiInjection) => {
    message.value = messageInjection
  }

  const getMessage = () : MessageApiInjection =>  {
    return message.value
  }

  return { message, setMessage, getMessage, long_message }
})

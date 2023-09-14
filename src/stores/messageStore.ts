import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider'


export const useMessageStore = defineStore('message', () => {
  const message: MessageApiInjection | any = ref('')
  const short_message = { duration: 1000 }
  const long_message = { duration: 10000 }

  const setMessage = (messageInjection: MessageApiInjection) => {
    message.value = messageInjection
  }

  const getMessage = () : MessageApiInjection =>  {
    return message.value
  }

  return { message, setMessage, getMessage, long_message, short_message }
})

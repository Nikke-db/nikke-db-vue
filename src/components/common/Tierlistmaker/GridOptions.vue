<template>
  <span>
    <n-button  primary type="info" round @click="openModal()">
      open grid options
    </n-button>

    <n-modal
        v-model:show="isModalOpen"
        id="tierListGridOptions"
        class="wideModalDialogWidth"
        :mask-closable="false"
        preset="dialog"
        title="&nbsp;&nbsp;Tier List Grid Options"
        positive-text="Confirm"
        negative-text="Cancel"
        @positive-click="confirmModal()"
        @negative-click="closeModal()"
        :closable="false"
    >
      <n-card title="" :bordered="false" size="huge" id="bgcModalContent">
        <n-h3 type="info" prefix="bar">Tier List name</n-h3>
        <n-input v-model:value="modelCopy.name" />

        <n-h3 type="info" prefix="bar">Author</n-h3>
        <n-input v-model:value="modelCopy.author" />

        <n-divider />

        <n-h3 type="info" prefix="bar">Reorder rows</n-h3>

        <draggable  v-model="modelCopy.tiers"
                    item-key="tiers"
                    :enabled="true"
                    tag="div"
                    group="tiers"
        >
          <template #item="{element, index}">
            <div class="row" style="border-top: 1px solid black">

              <div class="editBtn" @click="editRow(element, index)">
                <div class="rowBtnInner">
                  <div>
                    <n-icon color="white">
                      <Edit />
                    </n-icon>
                    <span>
                      Edit
                    </span>
                  </div>
                </div>
              </div>

              <div class="rowInner" :style="{color: element.color_name, backgroundColor: element.color_bg}">
                {{ element.name }}
              </div>

              <div class="deleteBtn" @click="deleteRow(index)">
                <div class="rowBtnInner">
                  <div>
                    <n-icon color="white">
                      <TrashAlt />
                    </n-icon>
                    <span>
                      Delete
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </template>

          <template #footer>
            <div id="rowsfooter">
              <n-button type="info" @click="addRow()">
                Add a row
              </n-button>
            </div>
          </template>
        </draggable>
      </n-card>
    </n-modal>

    <n-modal v-model:show="isModalRowOptionsOpen"
             id="tierListGridOptions"
             class="wideModalDialogWidth"
             :mask-closable="false"
             preset="dialog"
             title="&nbsp;&nbsp;Tier List Grid Options"
             positive-text="Confirm"
             negative-text="Cancel"
             @positive-click="confirmRowOptionsModal()"
             @negative-click="closeOptionsModal()"
             :closable="false"
    >
      <n-card :bordered="false" size="huge">

        <n-h3 type="info" prefix="bar">Row Title</n-h3>
        <n-input v-model:value="modalRowBeingEdited.name" />

        <n-h3 type="info" prefix="bar">Row Background Color</n-h3>
        <n-color-picker :modes="['hex']" v-model:value="modalRowBeingEdited.color_bg"/>

        <n-h3 type="info" prefix="bar">Row Text Color</n-h3>
        <n-color-picker :modes="['hex']" v-model:value="modalRowBeingEdited.color_name"/>

        <n-h3 type="info" prefix="bar">Preview</n-h3>
        <div id="rowDataPreview" :style="{backgroundColor: modalRowBeingEdited.color_bg}">
          <div id="rowDataPreviewInnerFlex" :style="{color: modalRowBeingEdited.color_name}">
            {{ modalRowBeingEdited.name}}
          </div>
        </div>
      </n-card>
    </n-modal>
  </span>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import type { PropType, Ref } from 'vue'
import type { tierlist } from '@/utils/interfaces/tierlist/tierlist'
import draggable from 'vuedraggable'
import { checkForMissingCharactersAndAddToBench, randomNewTier } from '@/utils/tierlistUtils'
import { TrashAlt, Edit } from '@vicons/fa'
import { useMarket } from '@/stores/market'
import { messagesEnum } from '@/utils/enum/globalParams'
import type { tier } from '@/utils/interfaces/tierlist/tier'

const model = defineModel({
  type: Object as PropType<tierlist>,
  required: true
})

const market = useMarket()
const modelCopy = ref() as Ref<tierlist>
const isModalOpen = ref(false)
const isModalRowOptionsOpen = ref(false)
const modalRowBeingEdited: Ref<tier> = ref({ items:[], color_name:'', color_bg:'', name:'', subtext:'' })
const indexRowBeingEdited = ref(0)

const openModal = () => {
  if (model.value) {
    modelCopy.value = JSON.parse(JSON.stringify(model.value))
  }
  isModalOpen.value = true
  setTimeout(() => {
    (document.activeElement as HTMLElement).blur()
  }, 50)
}
const closeModal = () => {
  isModalOpen.value = false
  market.message.getMessage().warning(messagesEnum.MESSAGE_CANCELLED)
}
const closeOptionsModal = () => {
  isModalRowOptionsOpen.value = false
  market.message.getMessage().warning(messagesEnum.MESSAGE_CANCELLED)
}

const confirmModal = () => {
  model.value = JSON.parse(JSON.stringify(modelCopy.value))
}

const confirmRowOptionsModal = () => {
  market.message.getMessage().success(messagesEnum.MESSAGE_TIERLIST_UPDATED_ROW)
  modelCopy.value.tiers[indexRowBeingEdited.value] = JSON.parse(JSON.stringify(modalRowBeingEdited.value))
}

const addRow = () => {
  modelCopy.value.tiers.push(randomNewTier())
}

const deleteRow = (index: number) => {
  market.message.getMessage().success(messagesEnum.MESSAGE_TIERLIST_DELETE_ROW)
  modelCopy.value.tiers.splice(index, 1)
  modelCopy.value = checkForMissingCharactersAndAddToBench(modelCopy.value)
}

const editRow = (row: tier, index: number) => {
  modalRowBeingEdited.value = JSON.parse(JSON.stringify(row))
  indexRowBeingEdited.value = index
  isModalRowOptionsOpen.value = true
  setTimeout(() => {
    (document.activeElement as HTMLElement).blur()
  }, 50)
}
</script>

<style lang="less" scoped>
@import '@/utils/style/global_variables.less';
.row {
  cursor: pointer;
  background-color: #ff69b4;
  height: 75px;
  font-size: 40px;
  text-align: center;
  display:flex;

  div.rowInner{
    flex:1;
  }

  div.editBtn,
  div.deleteBtn{
    font-size: 16px;
    width: 100px;
    display:flex;
    justify-content: center;

    .rowBtnInner {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
  }

  div.editBtn {
    background-color: #18b3c4;
  }

  div.deleteBtn {
    background-color: #eb3449;
  }
}

#rowsfooter {
  margin-top: 15px;
}

#rowDataPreview {
  width: 100%;
  min-height: 128px;
  font-size: 40px;
  text-align: center;
  display: flex;
  justify-content: center;

  #rowDataPreviewInnerFlex {
    display: flex;
    justify-content: center;
    flex-direction: column;
  }
}
</style>
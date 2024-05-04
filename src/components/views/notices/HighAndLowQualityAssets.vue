<template>
  <n-card>
    <n-p>I will use this space to explain what exactly is the purpose of the High quality vs Low quality asset tool. </n-p>
    <n-p>I am not sure how to begin this type of explanations so let's get straight to showing the differences: </n-p>

    <n-divider/>

    <n-alert type="info">High Quality Asset</n-alert><br/>
    <n-image :src="hq" :width="'100%'"/>

    <n-divider/>

    <n-alert type="info">Low Quality Asset</n-alert><br/>
    <n-image :src="lq" :width="'100%'"/>

    <n-divider/>

    <n-p>As you can see the high quality image offers a much clearer picture when you are zooming a lot, and this was the way it used to be when the website released around septembre 2023.</n-p>
    <n-p>However this method breaks the website for certain monitors that have resolutions of 2k or more, where the asset will start being cropped out.</n-p>
    <n-p>Because this issue became more and more recurrent in my feedback pipeline, I decided to go toward a permanent low quality mode that'd fix the issue for everyone.</n-p>
    <n-p>I though people that wanted high quality zoomed frames would use the screenshot feature, but I often saw cropped screenshots for memes quite pixelated which makes me think they did it raw through the website.</n-p>
    <n-p>I hope this toggle will be able to handle every cases, offer a high quality resolution for 1080p or lower monitors, and people that have their asset cropped would use the low quality asset.</n-p>
    <n-p>See below for an example of a cropped asset on 2k+ monitors.</n-p>

    <n-divider/>

    <n-alert type="info">4k monitor with a cropped asset in "High Quality Mode". The issue is fixed in "Low Quality Mode"</n-alert><br/>
    <n-image :src="fourk" :width="'100%'"/>
  </n-card>
</template>

<script lang="ts" setup>
import hq from '@/assets/notice_imgs/HQ.png'
import lq from '@/assets/notice_imgs/LQ.png'
import fourk from '@/assets/notice_imgs/fourk.png'

</script>

<style scoped lang="less">
.n-card {
  margin: 50px auto;
  width: 90%;
}
</style>
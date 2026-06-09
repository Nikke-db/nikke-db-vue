<template>
  <n-card>
    <n-p>Here will be a quick guide to demonstrate what can be done with the layer/attachment editor</n-p>

    <n-p>This notice will show the 2 main features of the editor :</n-p>
    <n-ol>
      <n-li>Removing Layers</n-li>
      <n-li>Coloring Layers</n-li>
    </n-ol>

    <n-divider/>

    <n-alert type="info">How it works ( nerd emoji )</n-alert><br/>

    FYI, this is my understanding of how Spine works. Do not quote me on any of this. <br/> <br/>

    A spine asset is composed of 3 parts: an .atlas file, a .skel file, and a set of PNG files ( minimum 1, no maximum ). <br />
    The Atlas file will map coordinates of the PNG file(s) to objects called Bones. <br/>
    The PNGs will have different parts drawn without any logical sense that makes up a really weird looking file. <br/>
    The Skel will map every Bones created by the Atlas to every defined Skins and Animations, and will tell the animating software ( my website, unity for nikke, etc.. ) where should a Bone be placed at any given time. <br/>
    However, not every Bone must be used in a Skin. As such a Bone used in a skin is called an Attachment.
    These attachment have a truck load of data I don't understand, but they also have their RGBA values easily updatable. <br/> <br/>

    And this is pretty much how this feature works: you will be selecting the Attachment you want to update and will be brute forcing new RGBA values. However, beware : <br/>

    <n-ul>
      <n-li>Currently this only works for the default skin attachments ( for example if you select Anchor, select all the attachments, nullify their alpha channel, the new attachments from the "bg" skin will not be removed ).</n-li>
      <n-li>A RGB value of (255, 255, 255) does not mean the asset will be pure white. In fact, that value is the default and dictates the intensity of the color channel. (0, 0, 0) will be pure black, but (255, 255, 255) will be the original and default color of the asset.</n-li>
    </n-ul>

    <n-divider/>

    <n-alert type="info">Removing Layers</n-alert><br/>

    Let's introduce the layer removal with the newest hot as fuck NPC : D.E.E.P <br/>
    Personally I do not like the 3 "Orbs" floating around her. Let's remove them. <br/><br/>

    We can easily deduce with the attachment list that the "ob_", "ob2_" and "object3" refers to the three orbs we're talking about.<br/>
    So let's filter by these keywords and click on the "Select results" button. <br/>

    <div class="center-image">
      <n-image :src="layerEditor1" width="100%"/> <br/>
    </div>

    Clearing the search box will <b> NOT </b> remove the check box on ANY attachment. <br/> <br/>

    Repeat the process in the screenshot for the keyword "ob_" <br/>
    Always double check what the website is finding and selecting : Have you realised that two attachments called "boob_" have been found ? I don't know about you but I sure don't want them to disappear, so let's manually uncheck them.<br/>

    <div class="center-image">
      <n-image :src="layerEditor2" width="100%"/> <br/><br/>
    </div>

    Let's also manually check "object3" as this references the last orb. <br/>

    Now that we have checked what we want to see gone, let's mess with the Alpha channel of these stains. <br/>
    Hopefully I made the interface logical enough, but the Alpha slider is the 4th one from the top : <br/>
    As you can guess, we want them gone, so the new value for the channel must be 0, then apply the modifications.<br/>

    <div class="center-image">
      <n-image :src="layerEditor3" width="100%"/> <br/><br/>
    </div>

    Good ! The orbs are gone ! But as you can see, the lighting they emit is still there; litteraly no problem, let's remove them too.<br/>

    <div class="center-image">
      <n-image :src="layerEditor4" width="100%"/> <br/><br/>
    </div>

    And you are done ! you can now close the tool and use every other features of Nikke-DB : adding a background, listen to the girl yap, take a screenshot, without the attachments that have been hidden.

    <n-divider/>

    <n-alert type="info">Coloring Layers</n-alert> <br/>

    As you can guess, coloring a layer is literally the same thing as removing one, however instead of changing the Alpha channel, you change the red, green and blue hues of the attachment.<br/>
    Following the example of D.E.E.P, let's color the chest area to a yellow color similar to the rest of her clothing. <br/>

    For my example I used the values (190, 190, 100) for RGB to have the result bellow, do not forget to put 255 for the alpha channel or else she'll have a hole instead of the honkers. <br/>

    <div class="center-image">
      <n-image :src="layerEditor5" width="100%"/> <br/><br/>
    </div>

    Getting the color you want will be extremely hard as you are changing the intensity of the 3 colors instead of giving them a brute value, some colors might just be impossible to produce too (white/grey being an easy example). So have fun with what's possible

    <n-divider/>

    <n-alert type="info">Multi layer selection using the mouse</n-alert> <br/>

    Let's get straight to the point with removing the skirt of an all time favorite : Emma Tactical Upgrade in the aiming position:<br/>

    <div class="center-image">
      <n-image :src="layerEditor6" width="100%"/> <br/><br/>
    </div>

    To begin the multi layer selection with the mouse, toggle on the button that says pretty much this exact thing.<br/><br/>

    <div class="center-image">
      <n-image :src="layerEditor7" width="100%"/> <br/><br/>
    </div>

    Once the toggle is activated, you can move your cursor toward the clothes of the Nikke, and I mean the actual animated sprite, not the list of layers. <br/>
    Once the cursor hovers an actual layer, it will start blinking similar to the preview mode when hovering the Eye Icon. This will tell you which layer is currently detected by the program <br/>
    What comes next? A simple left clic, and the layer will be selected automatically! Move your cursor out of the Nikke to see it continue blinking without the mouse being on top of the layer. <br/>
    Continue selecting every layers you want gone by just left clicking everything, you will end up with something similar to this : <br/>

    <div class="center-image">
      <n-image :src="layerEditor8" width="100%"/> <br/><br/>
    </div>

    The next step is doing what you know best. Remove those damn layers. You have two ways of doing this :
    <n-ul>
      <n-li>The usual way with the alpha slider to 0. This will cause the layers to become invisible, but the previewing will stay on. You will need to manually remove the preview using "Deselect results" or un toggle the button.</n-li>
      <n-li>Use the new "Hide selected" button, which will also move the alpha to 0 but automatically unselect the layers.</n-li>
    </n-ul> <br/>

    <div class="center-image">
      <n-image :src="layerEditor9" width="100%"/> <br/><br/>
    </div>

    We can see there are now small layers still on the butt. They are very small layers hidden underneath the ones we just removed, so they didn't get selected by the feature because the upper layer were prioritized. <br/>
    This is no problem, let's just use our mouse & clics and remove layers in bulk easily a second time! The upper layers are now considered "non-existent" and the program will manage to go select the ones underneath now.

    <div class="center-image">
      <n-image :src="layerEditor10" width="100%"/> <br/><br/>
    </div>

    <div class="center-image">
      <n-image :src="layerEditor11" width="100%"/> <br/><br/>
      <i>slap dem cheeks</i>
    </div>

    <n-divider/>

    That's it ! Time for you to see how weird as hell spine is made behind your eyes, and how these juicy nikkes are really made. <br/>
    Have fun coloring or removing clothes, hair, body parts. But don't be too disapointed when you realise that not a lot of nikkes have full bodies drawn underneath their coats. This tool is a quirk "because I can" and nothing more. <br/>
  </n-card>
</template>

<script lang="ts" setup>
import layerEditor1 from '@/assets/notice_imgs/layerEditor1.png'
import layerEditor2 from '@/assets/notice_imgs/layerEditor2.png'
import layerEditor3 from '@/assets/notice_imgs/layerEditor3.png'
import layerEditor4 from '@/assets/notice_imgs/layerEditor4.png'
import layerEditor5 from '@/assets/notice_imgs/layerEditor5.png'
import layerEditor6 from '@/assets/notice_imgs/layerEditor6.png'
import layerEditor7 from '@/assets/notice_imgs/layerEditor7.png'
import layerEditor8 from '@/assets/notice_imgs/layerEditor8.png'
import layerEditor9 from '@/assets/notice_imgs/layerEditor9.png'
import layerEditor10 from '@/assets/notice_imgs/layerEditor10.png'
import layerEditor11 from '@/assets/notice_imgs/layerEditor11.png'
</script>

<style scoped lang="less">
.n-card {
  margin: 50px auto;
  width: 90%;

  .center-image{
    text-align: center;
  }
}
</style>
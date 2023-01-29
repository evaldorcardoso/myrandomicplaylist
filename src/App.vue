<script setup>
  document.title = 'My Randomic Playlist'
</script>
<template>
  <div id="main">
    <router-view/>
  </div>
</template>

<style>
#main{
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  /*background gradiente*/
  font-family: sans-serif;
  /*background: linear-gradient(to bottom, #1db954 0%, #0c8d39 100%);*/
  background-color: #1c1c1c;
  height: 100vh;
  font-size: 14px;
}
.page{
  background-color: #1c1c1c;
  height: 90%;
  padding-bottom: 65px;
  overflow-y: scroll;   
  padding: 5px;
}
</style>
<script setup>
  import Navbar from '@/components/Navbar.vue'
</script>
<template>
  <div id="nav">
    <Navbar />
    <router-view/>
  </div>
</template>

<style>
#nav{
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  padding: 20px;
  /*background gradiente*/
  font-family: sans-serif;
  background: linear-gradient(to bottom, #1db954 0%, #0c8d39 100%);
  height: 100vh;
}
</style>
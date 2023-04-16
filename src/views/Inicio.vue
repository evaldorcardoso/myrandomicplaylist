<script setup>
  import { onMounted, ref } from 'vue'
  import VueBasicAlert from 'vue-basic-alert'


  const alert = ref(null)

  const openLink = (url) => {
    window.open(url, '_blank')
  }

  onMounted(async () => {})

</script>

<template>
  <div class="page">
    <vue-basic-alert :duration="300" :closeIn="3000" ref="alert" />
    <link href="https://fonts.googleapis.com/css?family=Lato" rel="stylesheet">

    <div class="content">
      <div class="content__container">
        <p class="content__container__text">
          Play
        </p>
        
        <ul class="content__container__list">
          <li class="content__container__list__item">random!</li>
          <li class="content__container__list__item">top!</li>
          <li class="content__container__list__item">library!</li>
          <li class="content__container__list__item">spotify !</li>
        </ul>
      </div>
      <router-link to="/randomic" props="stepData" style="text-decoration:none;margin-top: 75px;display: block;">
        <button class="btn-generate">
          Start now !
        </button>
      </router-link>
    </div>

    <div class="footer">
      <img class="center" alt="evaldorc" src="https://www.evaldorc.com.br/assets/images/marca_w.png" @click="openLink('https://evaldorc.com.br')"/>
    </div>    
  </div>
</template>

<style lang="scss" scoped>
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: auto;
}
.btn-generate {
  margin: 25px auto auto auto;
  background-image: linear-gradient(60deg, #e0eb98, #62faf5);
  color: black;
  border: none;
  padding: 10px 20px;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  border-radius: 20px;
  border: none;
}
.footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  bottom: 85px;
  position: fixed;
  width: 100%;
  opacity: 0.3;
}
/*NEW CODE */
.content {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  height: 160px;
  overflow:hidden;
  
  font-family: 'Lato', sans-serif;
  font-size: 27px;
  line-height: 40px;
  color: #ecf0f1;
  
  &__container {
    font-weight: 600;
    overflow: hidden;
    height: 40px;
    padding: 0 40px;

    &:before {
      content: '[';
      left: 0;
    }

    &:after {
      content: ']';
      position: absolute;
      right: 0;
    }

    &:after, &:before {
      position: absolute;
      top: 0;
      
      color: rgb(30, 215, 96);
      font-size: 34px;
      line-height: 40px;
      
      -webkit-animation-name: opacity;
      -webkit-animation-duration: 2s;
      -webkit-animation-iteration-count: infinite;
      animation-name: opacity;
      animation-duration: 2s;
      animation-iteration-count: infinite;
    }

    &__text {
      display: inline;
      float: left;
      margin: 0;
    }

    &__list {
      margin-top: 0;
      padding-left: 70px;
      text-align: left;
      list-style: none;
      width: 180px;
      
      -webkit-animation-name: change;
      -webkit-animation-duration: 10s;
      -webkit-animation-iteration-count: infinite;
      animation-name: change;
      animation-duration: 10s;
      animation-iteration-count: infinite;

      &__item {
        line-height:40px;
        margin:0;
      }
    }
  }
}

@-webkit-keyframes opacity {
  0%, 100% {opacity:0;}
  50% {opacity:1;}
}

@-webkit-keyframes change {
  0%, 12.66%, 100% {transform:translate3d(0,0,0);}
  16.66%, 29.32% {transform:translate3d(0,-25%,0);}
  33.32%,45.98% {transform:translate3d(0,-50%,0);}
  49.98%,62.64% {transform:translate3d(0,-75%,0);}
  66.64%,79.3% {transform:translate3d(0,-50%,0);}
  83.3%,95.96% {transform:translate3d(0,-25%,0);}
}

@-o-keyframes opacity {
  0%, 100% {opacity:0;}
  50% {opacity:1;}
}

@-o-keyframes change {
  0%, 12.66%, 100% {transform:translate3d(0,0,0);}
  16.66%, 29.32% {transform:translate3d(0,-25%,0);}
  33.32%,45.98% {transform:translate3d(0,-50%,0);}
  49.98%,62.64% {transform:translate3d(0,-75%,0);}
  66.64%,79.3% {transform:translate3d(0,-50%,0);}
  83.3%,95.96% {transform:translate3d(0,-25%,0);}
}

@-moz-keyframes opacity {
  0%, 100% {opacity:0;}
  50% {opacity:1;}
}

@-moz-keyframes change {
  0%, 12.66%, 100% {transform:translate3d(0,0,0);}
  16.66%, 29.32% {transform:translate3d(0,-25%,0);}
  33.32%,45.98% {transform:translate3d(0,-50%,0);}
  49.98%,62.64% {transform:translate3d(0,-75%,0);}
  66.64%,79.3% {transform:translate3d(0,-50%,0);}
  83.3%,95.96% {transform:translate3d(0,-25%,0);}
}

@keyframes opacity {
  0%, 100% {opacity:0;}
  50% {opacity:1;}
}

@keyframes change {
  0%, 12.66%, 100% {transform:translate3d(0,0,0);}
  16.66%, 29.32% {transform:translate3d(0,-25%,0);}
  33.32%,45.98% {transform:translate3d(0,-50%,0);}
  49.98%,62.64% {transform:translate3d(0,-75%,0);}
  66.64%,79.3% {transform:translate3d(0,-50%,0);}
  83.3%,95.96% {transform:translate3d(0,-25%,0);}
}
</style>

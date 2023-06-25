<script setup>
import { onMounted, computed } from "vue";

const emit = defineEmits([
    'notification-action',    
])

const props = defineProps({
    open: {
        type: Boolean,
        default: false
    },
    data: {
        type: Object,
        default: () => { }
    },
    userData: {
        type: Object,
        default: () => { }
    },
});

const opened = computed(() => {    
    return props.open;
});

const data = computed(() => {
    if (props.data?.auto) {
        setTimeout(() => emit('notification-action', false), 4000);
    }
    return props.data
})

const action = (value) => {
    emit('notification-action', value)
}

onMounted(() => {    

})

</script>

<template>
    <transition name="slide-fade" mode="out-in">
        <div class="notification" :class="data?.type" v-if="opened">
            <div class="content">
                <h3 class="title">{{ data?.title }}</h3>
                <p class="message">{{ data?.message }}</p>
            </div>
            <div class="actions">
                <div class="icon" @click="action(true)" v-if="data?.action">
                    <font-awesome-icon icon="fa-solid fa-check" />
                </div>
                <div class="icon" @click="action(false)">
                    <font-awesome-icon icon="fa-times"/>
                </div>
            </div>
        </div>
    </transition>
</template>

<style lang="scss" scoped>
   .notification {        
        padding-top: 5px;
        min-height: 50px;
        width: 100%;
        text-align: start;
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: #fff;
        position: absolute;
   }
   .actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
   }
   .icon {
        font-size: 23px;
        margin-right: 10px;
        width: 30px;
        text-align: center;
        cursor: pointer;
   }
   .content {
        margin-left: 10px;
   }
   .title {
        margin: 5px;
   }
   .message {
        margin: 5px;
        font-weight: 500;
   }
   .danger {
        background-color: #e74c3c;        
   }
   .success {
        background-color: #2ecc71;
   }
   .warning {
        background-color: #f1c40f;
    }
    .info {
        background-color: #3498db;
    }
    .slide-fade-enter-active {
        transition: all .8s ease;
    }
    .slide-fade-leave-active {
        transition: all .8s cubic-bezier(1.0, 0.5, 0.8, 1.0);
    }
    .slide-fade-enter, .slide-fade-leave-to
    /* .slide-fade-leave-active below version 2.1.8 */ {
        transform: translateX(100px);
        opacity: 0;
    }
</style>

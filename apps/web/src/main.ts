import "element-plus/dist/index.css";
import "./styles/theme.css";

import ElementPlus from "element-plus";
import { createPinia } from "pinia";
import { createApp } from "vue";

import App from "./App.vue";
import { router } from "./router/index.js";

const 应用 = createApp(App);

应用.use(createPinia());
应用.use(router);
应用.use(ElementPlus);

应用.mount("#app");

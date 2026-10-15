import "element-plus/dist/index.css";
import "./styles/theme.css";
import "./styles/war-typography.css";
import "./styles/visual-ui.css";
import "./styles/war-artboard.css";
import "./styles/war-form.css";
import "./styles/war-demo.css";
import "./styles/war-typography-lock.css";

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

import Vue from "vue";
import Viewport from "@/Viewport.vue";
import store from "@/store";
import Api from "../api.js";
import Ext from "#ext"; // ExtJS
import( "@fortawesome/fontawesome-free/css/all.min.css" ); // FontAwesome

Vue.config.productionTip = false;
Vue.config.ignoredElements = [/^ext-/];

const api = new Api( {
    "url": process.env.VUE_APP_API_URL,
} );

Vue.prototype.$api = api;
Ext.data.proxy.Softvisio.setApi( api );

// // TODO why I shoild do this manually?
Vue.prototype.$store = store;

store.dispatch( "session/init", {
    "theme": {
        "darkMode": false,
        "accent": "red",
        "base": "teal",
    },
} );

const App = new Vue( {
    store,
    "render": ( h ) => h( Viewport ),
} ).$mount( "#app" );

export default App;

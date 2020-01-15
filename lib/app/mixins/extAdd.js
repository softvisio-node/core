import Vue from "vue";

const mixin = {
    "methods": {
        extAddVueComponent ( cmp, target ) {
            const component = Vue.extend( cmp ),
                instance = new component(),
                wrapper = target.add( {
                    "xtype": "component",
                } );

            instance.$mount();

            wrapper.setHtml( instance.$el );

            instance.$once( "hook:beforeDestroy", () => {
                wrapper.destroy();
            } );

            return instance;
        },
    },
};

export default mixin;

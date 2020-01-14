import Vue from "vue";

const mixin = {
    "methods": {
        extAdd ( cmp, target ) {
            var wrapper = target.add( {
                "xtype": "component",
            } );

            var ComponentClass = Vue.extend( cmp ),
                instance = new ComponentClass();

            instance.$mount();

            wrapper.setContentEl( instance.$el );

            return wrapper;

            // Ext.Viewport.el.dom.appendChild( this.$el );
            // this.$refs.dialog.ext.showBy( Ext.Viewport, "c-c" );
        },
    },
};

export default mixin;

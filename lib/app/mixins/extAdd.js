import Vue from "vue";

const mixin = {
    // TODO how to mount without wrapper?
    "methods": {
        extAddDialog ( cmp, target ) {
            if ( !target ) target = Ext.Viewport;

            const component = Vue.extend( cmp ),
                instance = new component( {
                    // "el": target.el.dom,
                } );

            instance.$mount();

            // console.log( instance.$el );

            // wrapper.setHtml( instance.$el );
            // wrapper.setContentEl( instance.$el );
            target.el.dom.appendChild( instance.$el );

            return instance;
        },

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

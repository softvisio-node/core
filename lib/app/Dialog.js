// <ext-dialog @ready="ready" closeAction="destroy">

module.exports = {
    data () {
        return {
            "dialog": null,
        };
    },

    created () {
        this.$mount();

        Ext.Viewport.el.dom.appendChild( this.$el );

        // set Vue component destroy hook
        this.$once( "hook:beforeDestroy", () => {
            if ( this.dialog ) {
                this.dialog.destroy();

                this.dialog = null;
            }
        } );
    },

    "methods": {
        ready ( e ) {
            this.dialog = e.detail.cmp;

            // set Ext.Dialog destroy listener
            this.dialog.on( "destroy",
                function () {
                    this.$destroy();
                }.bind( this ) );
        },

        show () {
            this.dialog.show();
        },

        hide () {
            this.dialog.hide();
        },
    },
};

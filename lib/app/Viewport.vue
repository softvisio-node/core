<template>
    <ext-panel viewport="true" layout="card" scrollable="y" @ready="viewportReady"/>
</template>

<script>
import( "#ewc/ext-panel.component" );

import Vue from "vue";

export default {
    "data": () => {
        return {
            "viewport": null,
            "view": null,

            "defaultMask": null,
            "privateView": null,
            "publicView": null,
        };
    },

    "computed": {
        sessionIsAuthenticated () {
            return this.$store.getters["session/isAuthenticated"];
        },
    },

    mounted () {
        this.$watch( "sessionIsAuthenticated", function ( isAuthenticated ) {
            // authentication status is unknown
            if ( isAuthenticated === null ) return;

            var view;

            if ( isAuthenticated ) {
                view = this.privateView;
            }
            else {
                view = this.publicView;
            }

            var viewport = this.viewport,
                wrapper = Ext.create( {
                    "xtype": "component",
                } );

            if ( this.view ) this.view.destroy();

            this.view = viewport.add( wrapper );

            var ComponentClass = Vue.extend( view ),
                instance = new ComponentClass();

            instance.$mount();

            wrapper.setContentEl( instance.$el );
        } );
    },

    "methods": {
        async viewportReady ( e ) {
            var me = this,
                viewport = ( this.viewport = e.detail.cmp ),
                initApp = async function () {
                    viewport.mask( me.defaultMask );

                    var res = await me.$store.dispatch( "session/signin" );

                    viewport.unmask();

                    if ( !res.isSuccess() ) {
                        const dialog = Ext.create( "Ext.Dialog", {
                            "title": "Server Connection Error",
                            "draggable": false,
                            "html": `Unable to connect to the API server.`,
                            "buttons": {
                                "ok": {
                                    "text": "try again",
                                    "handler": function () {
                                        dialog.destroy();

                                        initApp();
                                    },
                                },
                            },
                        } );

                        dialog.show();
                    }
                };

            initApp();
        },
    },
};
</script>

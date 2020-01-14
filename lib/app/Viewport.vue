<template>
    <ext-panel viewport="true" layout="card" scrollable="y" @ready="viewportReady"/>
</template>

<script>
import( "#ewc/ext-panel.component" );

import extAdd from "./mixins/extAdd";

export default {
    "mixins": [extAdd],

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

            if ( this.view ) this.view.destroy();

            this.view = this.extAdd( view, this.viewport );
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

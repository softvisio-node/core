export default Super =>
    class extends Super {

        // public
        checkPermissions ( ctx ) {
            return !ctx.permissions.has( "telegram/bot:read" );
        }

        run ( ctx, req ) {
            return ctx.sendMessage( {
                "text": "Start chat",
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": this.l10nt( `Open PRIVATE JOIN` ),
                                "url": ctx.user.url,
                            },
                        ],
                    ],
                },
            } );
        }
    };

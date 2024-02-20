export default Super =>
    class extends Super {

        // public
        isEnabled ( ctx ) {
            return !ctx.permissions.has( "telegram/bot:read" );
        }

        run ( ctx, requestMessage ) {
            return ctx.sendMessage( {
                "text": "Start chat",
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": l10nt( `Open PRIVATE JOIN` ),
                                "url": ctx.user.url,
                            },
                        ],
                    ],
                },
            } );
        }
    };

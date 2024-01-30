export default Super =>
    class extends Super {

        // public
        run ( ctx, req ) {
            if ( ctx.permissions.has( "members" ) ) {
                return this.#messageFromUser( ctx, req );
            }
            else {
                return this.#messageFromCustomer( ctx, req );
            }
        }

        // private
        // XXX
        async #messageFromUser ( ctx, req ) {
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

        // XXX
        async #messageFromCustomer ( ctx, req ) {
            return ctx.sendMessage( {
                "text": "Start chat",
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": this.l10nt( `Open PRIVATE JOIN` ),
                                "url": `https://t.me/zdm002`,
                            },
                        ],
                    ],
                },
            } );
        }
    };

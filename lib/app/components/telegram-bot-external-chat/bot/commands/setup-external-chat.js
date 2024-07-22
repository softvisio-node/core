const UPDATE_NAME = "_externalChatUpdate";

export default Super =>
    class extends Super {

        // public
        async run ( ctx, message ) {
            if ( ctx.state?.[ UPDATE_NAME ] ) {
                if ( message?.text ) {
                    const res = await this.bot.externalChat.setChatUrl( message.text );

                    if ( res.ok ) {
                        await this.#clear( ctx );

                        return ctx.run( this );
                    }
                    else {
                        await ctx.sendText( res + "" );
                    }
                }

                return ctx.sendMessage( {
                    "text": l10nt( `Send me new link to the chat.` ),
                    "reply_markup": {
                        "inline_keyboard": [
                            [
                                {
                                    "text": l10nt( `Cancel` ),
                                    "callback_data": this.createCallbackData( "cancel" ),
                                },
                            ],
                        ],
                    },
                } );
            }

            return ctx.sendMessage( {
                "text": l10nt( locale => locale.l10n( `Current chat link` ) + ": " + ( this.bot.externalChat.chatUrl || "--" ) ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": l10nt( `Change link` ),
                                "callback_data": this.createCallbackData( "update" ),
                            },
                        ],
                    ],
                },
            } );
        }

        async beforeExit ( ctx ) {
            return this.#clear( ctx );
        }

        isEnabled ( ctx ) {
            return ctx.permissions.has( "telegram/bot:update" );
        }

        async API_update ( ctx ) {
            await ctx.updateState( {
                [ UPDATE_NAME ]: true,
            } );

            return ctx.run( this );
        }

        async API_cancel ( ctx ) {
            await this.#clear( ctx );

            return ctx.run( this );
        }

        // private
        async #clear ( ctx ) {
            return ctx.updateState( {
                [ UPDATE_NAME ]: undefined,
            } );
        }
    };

export default Super =>
    class extends Super {

        // public
        getDescription ( ctx ) {
            return l10nt( `edit start your contacts` );
        }

        // isEnabled ( ctx ) {
        //     return ctx.permissions.has( "telegram/bot:update" );
        // }

        async beforeExit ( ctx ) {
            await super.beforeExit( ctx );

            return this.#clearState( ctx );
        }

        // XXX
        async run ( ctx, requestMessage ) {
            var res;

            const contact = await this._getContact( ctx );

            if ( ctx.state?.edit === "pgone" ) {
                if ( requestMessage?.text ) {
                    await contact.setPhone( requestMessage.text );

                    await this.#clearState( ctx );

                    return ctx.run( this );
                }
                else {
                    return this._sendEditPhonePrompt( ctx );
                }
            }

            if ( this.bot.config.contact.phoneEnabled ) {
                if ( contact.phone ) {
                    res = await ctx.sendMessage( {
                        "text": l10nt( msgid`Phone: ${ contact.phone }` ),
                        "reply_markup": {
                            "inline_keyboard": [
                                [
                                    {
                                        "text": l10nt( "Change phone" ),
                                        "callback_data": this.encodeCallbackData( "editPhone" ),
                                    },
                                    {
                                        "text": l10nt( "Delete phone" ),
                                        "callback_data": this.encodeCallbackData( "deletePhone" ),
                                    },
                                ],
                            ],
                        },
                    } );
                }
                else {
                    res = await ctx.sendMessage( {
                        "text": l10nt( msgid`Phone: ${ l10nt( `not set` ) }` ),
                        "reply_markup": {
                            "inline_keyboard": [
                                [
                                    {
                                        "text": l10nt( "Sett phone" ),
                                        "callback_data": this.encodeCallbackData( "editPhone" ),
                                    },
                                ],
                            ],
                        },
                    } );
                }
            }

            // await ctx.sendMessage( {
            //     "text": l10nt( msgid`Email: ${ contacts.phone }` ),
            //     "reply_markup": {
            //         "inline_keyboard": [
            //             [
            //                 {
            //                     "text": l10nt( "Edit email" ),
            //                     "callback_data": this.encodeCallbackData( "editPhone" ),
            //                 },
            //                 {
            //                     "text": l10nt( "Delete email" ),
            //                     "callback_data": this.encodeCallbackData( "deletePhone" ),
            //                 },
            //             ],
            //         ],
            //     },
            // } );

            return res;
        }

        async API_editPhone ( ctx ) {
            await ctx.updateState( { "edit": "pgone" } );

            return ctx.run( this );
        }

        async API_deletePhone ( ctx ) {
            const contact = await this._getContact( ctx );

            await contact.setPhone();

            return ctx.tun( this );
        }

        // protected
        async _getContact ( ctx ) {
            return this.bot.getContact();
        }

        async _sendEditPhonePrompt ( ctx ) {
            return ctx.sendText( l10nt( `Send me a phone number in the international format: +XXX XX XXXXXXX` ) );
        }

        // private
        async #clearState ( ctx ) {
            return ctx.updateState( {
                "edit": undefined,
            } );
        }
    };

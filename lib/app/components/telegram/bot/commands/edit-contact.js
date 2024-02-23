export default Super =>
    class extends Super {

        // public
        getDescription ( ctx ) {
            return l10nt( `edit your contacts` );
        }

        async beforeExit ( ctx ) {
            await super.beforeExit( ctx );

            return this.#clearState( ctx );
        }

        // XXX
        async run ( ctx, requestMessage ) {
            const contact = await this._getContact( ctx ),
                config = await this._getConfig( ctx );

            if ( ctx.state?.edit ) {

                // phone
                if ( ctx.state.edit === "pgone" ) {
                    if ( config.phoneEnabled ) {
                        if ( requestMessage?.text ) {
                            await contact.setPhone( requestMessage.text );

                            await this.#clearState( ctx );
                        }
                        else {
                            return this._sendEditPhonePrompt( ctx );
                        }
                    }
                }
            }

            return this._sendContacts( ctx );
        }

        async API_editPhone ( ctx ) {
            const config = await this._getConfig( ctx );

            await this.#setEditState( ctx, config.pgoneEnabled ? "phone" : null );

            return ctx.run( this );
        }

        async API_deletePhone ( ctx ) {
            const contact = await this._getContact( ctx );

            await contact.setPhone();

            return ctx.tun( this );
        }

        // protected
        async _getContact ( ctx ) {}

        async _getConfig ( ctx ) {
            return {
                "phoneEnabled": true,
                "emailEnabled": true,
                "addressEnabled": true,
                "notesEnabled": true,
            };
        }

        // XXX
        async _sendContacts ( ctx ) {
            var res;

            const contact = await this._getContact( ctx ),
                config = await this._getConfig( ctx );

            if ( config.phoneEnabled ) {
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

            return res;
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

        async #setEditState ( ctx, state ) {
            return ctx.updateState( { "edit": state || undefined } );
        }
    };

export default Super =>
    class extends Super {

        // properties
        get notesTitle () {
            return l10nt( `Send me your emaul address` );
        }

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
                if ( ctx.state.edit === "phone" ) {
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

                // email
                else if ( ctx.state.edit === "email" ) {
                    if ( config.emailEnabled ) {
                        if ( requestMessage?.text ) {
                            await contact.setEmail( requestMessage.text );

                            await this.#clearState( ctx );
                        }
                        else {
                            return this._sendEditEmailPrompt( ctx );
                        }
                    }
                }

                // notes
                else if ( ctx.state.edit === "notes" ) {
                    if ( config.notesEnabled ) {
                        if ( requestMessage?.text ) {
                            await contact.setNotes( requestMessage.text );

                            await this.#clearState( ctx );
                        }
                        else {
                            return this._sendEditNotesPrompt( ctx );
                        }
                    }
                }
            }

            return this._sendContacts( ctx );
        }

        async API_editPhone ( ctx ) {
            const config = await this._getConfig( ctx );

            await this.#setEditState( ctx, config.phoneEnabled ? "phone" : null );

            return ctx.run( this );
        }

        async API_deletePhone ( ctx ) {
            const contact = await this._getContact( ctx );

            await contact.setPhone();

            return ctx.run( this );
        }

        async API_editEmail ( ctx ) {
            const config = await this._getConfig( ctx );

            await this.#setEditState( ctx, config.emailEnabled ? "email" : null );

            return ctx.run( this );
        }

        async API_deleteEmail ( ctx ) {
            const contact = await this._getContact( ctx );

            await contact.setEmail();

            return ctx.run( this );
        }

        async API_editNotes ( ctx ) {
            const config = await this._getConfig( ctx );

            await this.#setEditState( ctx, config.notesEnabled ? "notes" : null );

            return ctx.run( this );
        }

        async API_deleteNotes ( ctx ) {
            const contact = await this._getContact( ctx );

            await contact.setNotes();

            return ctx.run( this );
        }

        async API_cancel ( ctx ) {
            await this.#clearState( ctx );

            return ctx.run( this );
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

            // phone
            if ( config.phoneEnabled ) {
                if ( contact.phone ) {
                    res = await ctx.sendMessage( {
                        "text": l10nt( msgid`Phone: ${ contact.phone }` ),
                        "parse_node": "HTML",
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
                        "parse_node": "HTML",
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

            // email
            if ( config.emailEnabled ) {
                if ( contact.email ) {
                    res = await ctx.sendMessage( {
                        "text": l10nt( msgid`Email: ${ contact.email }` ),
                        "parse_node": "HTML",
                        "reply_markup": {
                            "inline_keyboard": [
                                [
                                    {
                                        "text": l10nt( "Change email" ),
                                        "callback_data": this.encodeCallbackData( "editEmail" ),
                                    },
                                    {
                                        "text": l10nt( "Delete email" ),
                                        "callback_data": this.encodeCallbackData( "deleteEmail" ),
                                    },
                                ],
                            ],
                        },
                    } );
                }
                else {
                    res = await ctx.sendMessage( {
                        "text": l10nt( msgid`Email: ${ l10nt( `not set` ) }` ),
                        "parse_node": "HTML",
                        "reply_markup": {
                            "inline_keyboard": [
                                [
                                    {
                                        "text": l10nt( "Sett email" ),
                                        "callback_data": this.encodeCallbackData( "editEmail" ),
                                    },
                                ],
                            ],
                        },
                    } );
                }
            }

            // notes
            if ( config.notesEnabled ) {
                if ( contact.notes ) {
                    res = await ctx.sendMessage( {
                        "text": l10nt( msgid`Notes:\n${ contact.notes }` ),
                        "parse_node": "HTML",
                        "reply_markup": {
                            "inline_keyboard": [
                                [
                                    {
                                        "text": l10nt( "Change notes" ),
                                        "callback_data": this.encodeCallbackData( "editNotes" ),
                                    },
                                    {
                                        "text": l10nt( "Delete notes" ),
                                        "callback_data": this.encodeCallbackData( "deleteNotes" ),
                                    },
                                ],
                            ],
                        },
                    } );
                }
                else {
                    res = await ctx.sendMessage( {
                        "text": l10nt( msgid`Notes: ${ l10nt( `not set` ) }` ),
                        "parse_node": "HTML",
                        "reply_markup": {
                            "inline_keyboard": [
                                [
                                    {
                                        "text": l10nt( "Add notes" ),
                                        "callback_data": this.encodeCallbackData( "editNotes" ),
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
            return ctx.sendMessage( {
                "text": l10nt( `Send me a phone number in the international format: +XXX XX XXXXXXX` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": l10nt( `Cancel` ),
                                "callback_data": this.encodeCallbackData( "cancel" ),
                            },
                        ],
                    ],
                },
            } );
        }

        async _sendEditEmailPrompt ( ctx ) {
            return ctx.sendMessage( {
                "text": l10nt( `Send me your emaul address` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": l10nt( `Cancel` ),
                                "callback_data": this.encodeCallbackData( "cancel" ),
                            },
                        ],
                    ],
                },
            } );
        }

        async _sendEditNotesPrompt ( ctx ) {
            return ctx.sendMessage( {
                "text": this.notesTitle,
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": l10nt( `Cancel` ),
                                "callback_data": this.encodeCallbackData( "cancel" ),
                            },
                        ],
                    ],
                },
            } );
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

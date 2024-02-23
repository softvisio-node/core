const EDIT_FIELD_PROPERTY_NAME = "editField",
    defaultFields = {
        "phoneEnabled": true,
        "emailEnabled": true,
        "addressEnabled": true,
        "notesEnabled": true,
    };

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

        async run ( ctx, requestMessage ) {
            const contact = await this._getContact( ctx ),
                fields = await this._getFields( ctx );

            if ( ctx.state?.[ EDIT_FIELD_PROPERTY_NAME ] ) {

                // phone
                if ( ctx.state[ EDIT_FIELD_PROPERTY_NAME ] === "phone" ) {
                    if ( fields.phoneEnabled !== false ) {
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
                else if ( ctx.state[ EDIT_FIELD_PROPERTY_NAME ] === "email" ) {
                    if ( fields.emailEnabled !== false ) {
                        if ( requestMessage?.text ) {
                            await contact.setEmail( requestMessage.text );

                            await this.#clearState( ctx );
                        }
                        else {
                            return this._sendEditEmailPrompt( ctx );
                        }
                    }
                }

                // address
                else if ( ctx.state[ EDIT_FIELD_PROPERTY_NAME ] === "address" ) {
                    if ( fields.addressEnabled !== false ) {
                        if ( requestMessage?.text ) {
                            await contact.setAddress( requestMessage.text );

                            await this.#clearState( ctx );
                        }
                        else {
                            return this._sendEditAddressPrompt( ctx );
                        }
                    }
                }

                // notes
                else if ( ctx.state[ EDIT_FIELD_PROPERTY_NAME ] === "notes" ) {
                    if ( fields.notesEnabled !== false ) {
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
            const fields = await this._getFields( ctx );

            await this.#setEditState( ctx, fields.phoneEnabled !== false ? "phone" : null );

            return ctx.run( this );
        }

        async API_deletePhone ( ctx ) {
            const contact = await this._getContact( ctx );

            await contact.setPhone();

            return ctx.run( this );
        }

        async API_editEmail ( ctx ) {
            const fields = await this._getFields( ctx );

            await this.#setEditState( ctx, fields.emailEnabled !== false ? "email" : null );

            return ctx.run( this );
        }

        async API_deleteEmail ( ctx ) {
            const contact = await this._getContact( ctx );

            await contact.setEmail();

            return ctx.run( this );
        }

        async API_editNotes ( ctx ) {
            const fields = await this._getFields( ctx );

            await this.#setEditState( ctx, fields.notesEnabled !== false ? "notes" : null );

            return ctx.run( this );
        }

        async API_deleteNotes ( ctx ) {
            const contact = await this._getContact( ctx );

            await contact.setNotes();

            return ctx.run( this );
        }

        async API_editAddress ( ctx ) {
            const fields = await this._getFields( ctx );

            await this.#setEditState( ctx, fields.addressEnabled !== false ? "address" : null );

            return ctx.run( this );
        }

        async API_deleteAddress ( ctx ) {
            const contact = await this._getContact( ctx );

            await contact.setAddress();

            return ctx.run( this );
        }

        async API_cancel ( ctx ) {
            await this.#clearState( ctx );

            return ctx.run( this );
        }

        // protected
        async _getContact ( ctx ) {}

        async _getFields ( ctx ) {
            return defaultFields;
        }

        async _sendContacts ( ctx ) {
            var res;

            const contact = await this._getContact( ctx ),
                fields = await this._getFields( ctx );

            // phone
            if ( fields.phoneEnabled !== false ) {
                if ( contact.phone ) {
                    res = await ctx.sendMessage( {
                        "text": l10nt( locale => "<b><u>" + locale.l10n( `Phone` ) + ":</u></b> " + contact.phone ),
                        "parse_mode": "HTML",
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
                        "text": l10nt( locale => "<b><u>" + locale.l10n( `Phone` ) + "</u>:</b> " + locale.l10n( `not specified` ) ),
                        "parse_mode": "HTML",
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
            if ( fields.emailEnabled !== false ) {
                if ( contact.email ) {
                    res = await ctx.sendMessage( {
                        "text": l10nt( locale => "<b><u>" + locale.l10n( `Email` ) + ":</u></b> " + contact.email ),
                        "parse_mode": "HTML",
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
                        "text": l10nt( locale => "<b><u>" + locale.l10n( `Email` ) + ":</u></b> " + locale.l10n( `not specified` ) ),
                        "parse_mode": "HTML",
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

            // address
            if ( fields.addressEnabled !== false ) {
                if ( contact.address ) {
                    res = await ctx.sendMessage( {
                        "text": l10nt( locale => "<b><u>" + locale.l10n( `Address` ) + ":</u></b>\n" + contact.address ),
                        "parse_mode": "HTML",
                        "reply_markup": {
                            "inline_keyboard": [
                                [
                                    {
                                        "text": l10nt( "Change address" ),
                                        "callback_data": this.encodeCallbackData( "editAddress" ),
                                    },
                                    {
                                        "text": l10nt( "Delete address" ),
                                        "callback_data": this.encodeCallbackData( "deleteAddress" ),
                                    },
                                ],
                            ],
                        },
                    } );
                }
                else {
                    res = await ctx.sendMessage( {
                        "text": l10nt( locale => "<b><u>" + locale.l10n( `Address` ) + ":</u></b> " + locale.l10n( `not specified` ) ),
                        "parse_mode": "HTML",
                        "reply_markup": {
                            "inline_keyboard": [
                                [
                                    {
                                        "text": l10nt( "Add address" ),
                                        "callback_data": this.encodeCallbackData( "editAddress" ),
                                    },
                                ],
                            ],
                        },
                    } );
                }
            }

            // notes
            if ( fields.notesEnabled !== false ) {
                if ( contact.notes ) {
                    res = await ctx.sendMessage( {
                        "text": l10nt( locale => "<b><u>" + locale.l10n( `Notes` ) + ":</u></b>\n" + contact.notes ),
                        "parse_mode": "HTML",
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
                        "text": l10nt( locale => "<b><u>" + locale.l10n( `Notes` ) + ":</u></b> " + locale.l10n( `not specified` ) ),
                        "parse_mode": "HTML",
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

        async _sendEditAddressPrompt ( ctx ) {
            return ctx.sendMessage( {
                "text": l10nt( `Send me your address` ),
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
                [ EDIT_FIELD_PROPERTY_NAME ]: undefined,
            } );
        }

        async #setEditState ( ctx, state ) {
            return ctx.updateState( { [ EDIT_FIELD_PROPERTY_NAME ]: state || undefined } );
        }
    };

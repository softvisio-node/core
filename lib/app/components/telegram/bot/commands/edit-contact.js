const EDIT_FIELD_PROPERTY_NAME = "editField";

export default Super =>
    class extends Super {

        // properties
        get notesTitle () {
            return l10nt( `Send me your emaul address` );
        }

        // public
        async run ( ctx, message ) {
            const contact = await this._getContact( ctx ),
                fields = await this._getFields( ctx );

            if ( ctx.state?.[ EDIT_FIELD_PROPERTY_NAME ] ) {

                // phone
                if ( ctx.state[ EDIT_FIELD_PROPERTY_NAME ] === "phone" ) {
                    if ( fields.phoneEnabled !== false ) {
                        if ( message?.text ) {
                            await contact.setPhone( message.text );

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
                        if ( message?.text ) {
                            await contact.setEmail( message.text );

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
                        if ( message?.text ) {
                            await contact.setAddress( message.text );

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
                        if ( message?.text ) {
                            await contact.setNotes( message.text );

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

        async beforeExit ( ctx ) {
            await super.beforeExit( ctx );

            return this.#clearState( ctx );
        }

        getDescription ( ctx ) {
            return l10nt( `edit your contacts` );
        }

        async [ "API_edit_phone" ] ( ctx ) {
            const fields = await this._getFields( ctx );

            await this.#setEditState( ctx, fields.phoneEnabled !== false
                ? "phone"
                : null );

            return ctx.run( this );
        }

        async [ "API_delete_phone" ] ( ctx ) {
            const contact = await this._getContact( ctx );

            await contact.setPhone();

            return ctx.run( this );
        }

        async [ "API_edit_email" ] ( ctx ) {
            const fields = await this._getFields( ctx );

            await this.#setEditState( ctx, fields.emailEnabled !== false
                ? "email"
                : null );

            return ctx.run( this );
        }

        async [ "API_delete_email" ] ( ctx ) {
            const contact = await this._getContact( ctx );

            await contact.setEmail();

            return ctx.run( this );
        }

        async [ "API_edit_notes" ] ( ctx ) {
            const fields = await this._getFields( ctx );

            await this.#setEditState( ctx, fields.notesEnabled !== false
                ? "notes"
                : null );

            return ctx.run( this );
        }

        async [ "API_delete_notes" ] ( ctx ) {
            const contact = await this._getContact( ctx );

            await contact.setNotes();

            return ctx.run( this );
        }

        async [ "API_edit_address" ] ( ctx ) {
            const fields = await this._getFields( ctx );

            await this.#setEditState( ctx, fields.addressEnabled !== false
                ? "address"
                : null );

            return ctx.run( this );
        }

        async [ "API_delete_address" ] ( ctx ) {
            const contact = await this._getContact( ctx );

            await contact.setAddress();

            return ctx.run( this );
        }

        async [ "API_cancel" ] ( ctx ) {
            await this.#clearState( ctx );

            return ctx.run( this );
        }

        // protected
        async _getContact ( ctx ) {}

        async _getFields ( ctx ) {}

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
                                        "callback_data": this.createCallbackData( "edit_phone" ),
                                    },
                                    {
                                        "text": l10nt( "Delete phone" ),
                                        "callback_data": this.createCallbackData( "delete_phone" ),
                                    },
                                ],
                            ],
                        },
                    } );
                }
                else {
                    res = await ctx.sendMessage( {
                        "text": l10nt( locale => "<b><u>" + locale.l10n( `Phone` ) + "</u>:</b> " + locale.l10n( `field not specified` ) ),
                        "parse_mode": "HTML",
                        "reply_markup": {
                            "inline_keyboard": [
                                [
                                    {
                                        "text": l10nt( "Set phone" ),
                                        "callback_data": this.createCallbackData( "edit_phone" ),
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
                                        "callback_data": this.createCallbackData( "edit_email" ),
                                    },
                                    {
                                        "text": l10nt( "Delete email" ),
                                        "callback_data": this.createCallbackData( "delete_email" ),
                                    },
                                ],
                            ],
                        },
                    } );
                }
                else {
                    res = await ctx.sendMessage( {
                        "text": l10nt( locale => "<b><u>" + locale.l10n( `Email` ) + ":</u></b> " + locale.l10n( `field not specified` ) ),
                        "parse_mode": "HTML",
                        "reply_markup": {
                            "inline_keyboard": [
                                [
                                    {
                                        "text": l10nt( "Set email" ),
                                        "callback_data": this.createCallbackData( "edit_email" ),
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
                                        "callback_data": this.createCallbackData( "edit_address" ),
                                    },
                                    {
                                        "text": l10nt( "Delete address" ),
                                        "callback_data": this.createCallbackData( "delete_address" ),
                                    },
                                ],
                            ],
                        },
                    } );
                }
                else {
                    res = await ctx.sendMessage( {
                        "text": l10nt( locale => "<b><u>" + locale.l10n( `Address` ) + ":</u></b> " + locale.l10n( `field not specified` ) ),
                        "parse_mode": "HTML",
                        "reply_markup": {
                            "inline_keyboard": [
                                [
                                    {
                                        "text": l10nt( "Add address" ),
                                        "callback_data": this.createCallbackData( "edit_address" ),
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
                                        "callback_data": this.createCallbackData( "edit_notes" ),
                                    },
                                    {
                                        "text": l10nt( "Delete notes" ),
                                        "callback_data": this.createCallbackData( "delete_notes" ),
                                    },
                                ],
                            ],
                        },
                    } );
                }
                else {
                    res = await ctx.sendMessage( {
                        "text": l10nt( locale => "<b><u>" + locale.l10n( `Notes` ) + ":</u></b> " + locale.l10n( `field not specified` ) ),
                        "parse_mode": "HTML",
                        "reply_markup": {
                            "inline_keyboard": [
                                [
                                    {
                                        "text": l10nt( "Add notes" ),
                                        "callback_data": this.createCallbackData( "edit_notes" ),
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
                "text": l10nt( `Send me a phone number in the international format` ),
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

        async _sendEditEmailPrompt ( ctx ) {
            return ctx.sendMessage( {
                "text": l10nt( `Send me your emaul address` ),
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

        async _sendEditAddressPrompt ( ctx ) {
            return ctx.sendMessage( {
                "text": l10nt( `Send me your address` ),
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

        async _sendEditNotesPrompt ( ctx ) {
            return ctx.sendMessage( {
                "text": this.notesTitle,
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

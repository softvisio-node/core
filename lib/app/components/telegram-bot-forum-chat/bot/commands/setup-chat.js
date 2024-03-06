const SET_GROUP_MODE = "setGroup";

export default Super =>
    class extends Super {

        // public
        async run ( ctx, message ) {
            if ( ctx.state?.[ SET_GROUP_MODE ] ) {
                if ( message.text ) {
                    const res = await this.bot.forumChat.setGroup( message.text );

                    if ( res.ok ) {
                        await ctx.updateState( {
                            [ SET_GROUP_MODE ]: undefined,
                        } );
                    }
                    else {
                        await ctx.sendText( l10nt( `Some error occured. Please, try again.` ) );
                    }

                    return ctx.run( this );
                }
                else {
                    return this._showSetGroupPrompt( ctx );
                }
            }
            else {
                const group = await this.bot.forumChat.getGroup();

                if ( group ) {
                    return this._showGroupInfo( ctx, group );
                }
                else {
                    return this._showNoGroupText( ctx );
                }
            }
        }

        async beforeExit ( ctx ) {
            return this.#clearState( ctx );
        }

        getDescription ( ctx ) {
            return l10nt( `Setup chat` );
        }

        isEnabled ( ctx ) {
            return ctx.permissions.has( "telegram/bot:update" );
        }

        async API_setGroup ( ctx ) {
            await ctx.updateState( {
                [ SET_GROUP_MODE ]: true,
            } );

            return ctx.run( this );
        }

        async API_rrenewInviteLink ( ctx ) {
            await this.bot.forumChat.createInviteLink();

            return ctx.run( this );
        }

        async API_cancel ( ctx ) {
            await ctx.updateState( {
                [ SET_GROUP_MODE ]: undefined,
            } );

            return ctx.run( this );
        }

        // protexted
        async _showNoGroupText ( ctx ) {
            return ctx.sendMessage( {
                "text": l10nt( `In otder to communicate with your customers you nees to create Telegram forum.` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": l10nt( `Set group` ),
                                "callback_data": this.encodeCallbackData( "setGroup" ),
                            },
                        ],
                    ],
                },
            } );
        }

        async _showGroupInfo ( ctx, group ) {
            return ctx.sendMessage( {
                "text": l10nt( `Char group is set.` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": l10nt( `Change group` ),
                                "callback_data": this.encodeCallbackData( "setGroup" ),
                            },
                        ],
                        [
                            {
                                "text": l10nt( `Renew invite link` ),
                                "callback_data": this.encodeCallbackData( "rrenewInviteLink" ),
                            },
                        ],
                    ],
                },
            } );
        }

        async _showSetGroupPrompt ( ctx ) {
            return ctx.sendMessage( {
                "text": l10nt( `Send me group link or ID` ),
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
            return ctx.clearState();
        }
    };

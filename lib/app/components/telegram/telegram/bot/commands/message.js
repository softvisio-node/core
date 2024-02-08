import Message from "../message.js";

export default Super =>
    class extends Super {

        // public
        async run ( ctx, message ) {
            const post = await this._getMessage( ctx );

            // add text
            if ( ctx.state.mode === "addText" ) {
                if ( message?.isText ) {
                    post.text = message.text;

                    await post.save();

                    await this._cancel( ctx );
                }
                else {
                    await this._showAddTextPrompt( ctx );
                }
            }

            // add media
            else if ( ctx.state.mode === "addMedia" ) {
                if ( message?.isMedia ) {
                    post.addMedia( message );

                    await post.save();

                    await this._showMessage( ctx, post, { "showButtons": false } );

                    await this._showAddMediaPrompt( ctx );
                }
                else {
                    await this._showAddTextPrompt( ctx );
                }
            }

            // edit media
            else if ( ctx.state.mode === "editMedia" ) {
                return this._showEditMediaPrompt( ctx, post );
            }
            else {
                await this._showMessage( ctx, post );
            }
        }

        async beforeExit ( ctx ) {
            await ctx.updateState( { "mode": undefined } );

            return super.beforeExit( ctx );
        }

        async API_addText ( ctx ) {
            await ctx.updateState( { "mode": "addText" } );

            return this._showAddTextPrompt( ctx );
        }

        async API_deleteText ( ctx ) {
            const message = await this._getMessage( ctx );

            if ( !message ) return;

            message.text = undefined;

            await message.save();

            return this._cancel( ctx );
        }

        async API_addMedia ( ctx ) {
            await ctx.updateState( { "mode": "addMedia" } );

            return this._showAddMediaPrompt( ctx );
        }

        async API_editMedia ( ctx ) {
            await ctx.updateState( { "mode": "editMedia" } );

            const message = await this._getMessage( ctx );

            return this._showEditMediaPrompt( ctx, message );
        }

        // XXX
        async API_moveMediaUp ( ctx, index ) {
            if ( ctx.state.mode !== "editMedia" ) return;

            const message = await this._getMessage( ctx );

            if ( !message ) return;

            message.deleteMedia( index );

            await message.save();

            return this._showEditMediaPrompt( ctx, message );
        }

        // XXX
        async API_moveMediaDown ( ctx, index ) {
            if ( ctx.state.mode !== "editMedia" ) return;

            const message = await this._getMessage( ctx );

            if ( !message ) return;

            message.deleteMedia( index );

            await message.save();

            return this._showEditMediaPrompt( ctx, message );
        }

        async API_deleteMedia ( ctx, index ) {
            if ( ctx.state.mode !== "editMedia" ) return;

            const message = await this._getMessage( ctx );

            if ( !message ) return;

            message.deleteMedia( index );

            await message.save();

            return this._showEditMediaPrompt( ctx, message );
        }

        async API_cancel ( ctx ) {
            await this._cancel( ctx );
        }

        // protected
        // XXX - buttons layout for mobile
        async _showMessage ( ctx, message, { showButtons = true } = {} ) {
            var res;

            if ( !message || message.isEmpty ) {
                res = await this._showEmptyMessage( ctx );
            }
            else {
                res = await ctx.send( message.sendMethod, message.toMessage() );
            }

            if ( !res.ok ) return;

            if ( !showButtons ) return res;

            const buttons = [];

            if ( !message?.text ) {
                buttons.push( {
                    "text": this.l10nt( `Add text` ),
                    "callback_data": this.encodeCallbackData( "addText" ),
                } );
            }
            else {
                buttons.push(
                    {
                        "text": this.l10nt( `Change text` ),
                        "callback_data": this.encodeCallbackData( "addText" ),
                    },
                    {
                        "text": this.l10nt( `Delete text` ),
                        "callback_data": this.encodeCallbackData( "deleteText" ),
                    }
                );
            }

            buttons.push( {
                "text": this.l10nt( `Add medua` ),
                "callback_data": this.encodeCallbackData( "addMedia" ),
            } );

            if ( message?.isMedia ) {
                buttons.push( {
                    "text": this.l10nt( `Delete / sort media` ),
                    "callback_data": this.encodeCallbackData( "editMedia" ),
                } );
            }

            await ctx.send( "sendMessage", {
                "text": this.l10nt( `Please, choose what you want to dp` ),
                "reply_markup": {
                    "inline_keyboard": [ buttons ],
                },
            } );

            return res;
        }

        async _showEmptyMessage ( ctx ) {
            return ctx.sendText( this.l10nt( `Ypir message has no content. You need to add text and media.` ) );
        }

        // XXX help - markup
        async _showAddTextPrompt ( ctx ) {
            return ctx.send( "sendMessage", {
                "text": this.l10nt( `Send me a message text.` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": this.createBackButtonText( this.l10nt( `Back` ) ),
                                "callback_data": this.encodeCallbackData( "cancel" ),
                            },
                        ],
                    ],
                },
            } );
        }

        // XXX - prompt text
        async _showAddMediaPrompt ( ctx ) {
            return ctx.send( "sendMessage", {
                "text": this.l10nt( `Send me a photo or video.` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": this.createBackButtonText( this.l10nt( `Back` ) ),
                                "callback_data": this.encodeCallbackData( "cancel" ),
                            },
                        ],
                    ],
                },
            } );
        }

        // XXX
        async _showEditMediaPrompt ( ctx, message ) {
            if ( !message || !message.isMedia ) return this._cancel( ctx );

            var index = -1;

            for ( const media of message ) {
                index++;

                await ctx.send( media.sendMethod, {
                    [ media.mediaType ]: media.fileId,
                    "heignt": 100,
                    "reply_markup": {
                        "inline_keyboard": [
                            [
                                {
                                    "text": this.l10nt( `↑ Move up` ),
                                    "callback_data": this.encodeCallbackData( "moveMediaUp", index ),
                                },
                                {
                                    "text": this.l10nt( `↓ Move down` ),
                                    "callback_data": this.encodeCallbackData( "moveMediaDown", index ),
                                },
                                {
                                    "text": this.l10nt( `x Delete` ),
                                    "callback_data": this.encodeCallbackData( "deleteMedia", index ),
                                },
                            ],
                        ],
                    },
                } );
            }

            return ctx.send( "sendMessage", {
                "text": this.l10nt( `Press button when you will finish edit media:` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": this.createBackButtonText( this.l10nt( `Back` ) ),
                                "callback_data": this.encodeCallbackData( "cancel" ),
                            },
                        ],
                    ],
                },
            } );
        }

        _createMessage () {
            return new Message( this.bot );
        }

        async _getMessage ( id ) {
            return this.bot.messages.getMessageById( id );
        }

        async _cancel ( ctx ) {
            await ctx.updateState( { "mode": undefined } );

            return ctx.run( this );
        }
    };

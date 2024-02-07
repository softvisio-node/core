import Message from "../message.js";

export default Super =>
    class extends Super {

        // public
        async run ( ctx, message ) {
            const post = await this._getMessage( ctx );

            if ( ctx.state.mode === "addText" ) {
                if ( message?.isText ) {
                    post.text = message.text;

                    await post.save();
                }
                else {
                    await this._showAddTextPrompt( ctx );
                }
            }
            else {
                await this._showMessage( ctx, post );
            }
        }

        async beforeExit ( ctx ) {
            await super.beforeExit( ctx );
        }

        async API_addText ( ctx ) {
            await ctx.updateState( { "mode": "addText" } );

            await this._showAddTextPrompt( ctx );
        }

        async API_addMedia ( ctx ) {
            await ctx.updateState( { "mode": "addMedia" } );

            await ctx.send( "sendMessage", {
                "text": this.l10nt( `Send me a images or videos.` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": this.l10nt( `Cancel` ),
                                "callback_data": this.encodeCallbackData( "cancel" ),
                            },
                        ],
                    ],
                },
            } );
        }

        async API_editMedia ( ctx ) {}

        async API_cancel ( ctx ) {
            await ctx.updateState( { "mode": undefined } );

            return this.run( ctx );
        }

        // protected
        // XXX
        async _showMessage ( ctx, message ) {
            var res = await ctx.send( message.sendMethod, message.toMessage() );

            if ( !res.ok ) return;

            const buttons = [
                {
                    "text": message?.text ? this.l10nt( `Edit text` ) : this.l10nt( `Add text` ),
                    "callback_data": this.encodeCallbackData( "addText" ),
                },
                {
                    "text": this.l10nt( `Add medua` ),
                    "callback_data": this.encodeCallbackData( "addMedia" ),
                },
            ];

            if ( message?.isMedia ) {
                buttons.push( {
                    "text": this.l10nt( `Delete / sort media` ),
                    "callback_data": this.encodeCallbackData( "editMedia" ),
                } );
            }

            await ctx.send( "sendMessage", {
                "text": "-------------------------------------",
                "reply_markup": {
                    "inline_keyboard": [ buttons ],
                },
            } );

            return res;
        }

        async _showAddTextPrompt ( ctx ) {
            return ctx.send( "sendMessage", {
                "text": this.l10nt( `Send me a message text.` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": this.l10nt( `Cancel` ),
                                "callback_data": this.encodeCallbackData( "cancel" ),
                            },
                        ],
                    ],
                },
            } );
        }

        async _editMedia ( ctx, messsage ) {}

        _createMessage () {
            return new Message( this.bot );
        }

        async _getMessage ( id ) {
            return this.bot.messages.getMessageById( id );
        }

        // private
    };

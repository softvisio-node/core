import Message from "../message.js";

export default Super =>
    class extends Super {

        // public
        async run ( ctx, message ) {}

        async beforeExit ( ctx ) {
            await super.beforeExit( ctx );
        }

        async API_addText ( ctx ) {
            await ctx.updateState( { "mode": "addText" } );

            await ctx.send( "sendMessage", {
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

            this.tun( ctx );
        }

        // protected
        async _showMessage ( ctx, message ) {
            var res = await ctx.send( message.sendMethod, message.toMessage() );

            if ( !res.ok ) return;

            const buttons = [
                {
                    "text": message?.text ? this.l10nt( `Edit text` ) : this.l10nt( `Add text` ),
                    "callback_data": this.encodeCallbackData( "editText" ),
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
                "text": this.l10nt( `Senf me more images.` ),
                "reply_markup": {
                    "inline_keyboard": [ buttons ],
                },
            } );

            return res;
        }

        async _editText ( ctx, messsage ) {}

        async _editMedia ( ctx, messsage ) {}

        _createMessage () {
            return new Message( this.bot );
        }

        async _getMessage ( id ) {
            return this.bot.messages.getMessageById( id );
        }

        // private
    };

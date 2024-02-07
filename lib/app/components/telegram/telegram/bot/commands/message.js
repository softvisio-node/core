import Message from "../message.js";

export default Super =>
    class extends Super {

        // public
        async beforeExit ( ctx ) {
            await super.beforeExit( ctx );
        }

        // protected
        async _showMessage ( ctx, message ) {
            const res = await ctx.send( message.sendMethod, message.toMessage() );

            if ( !res.ok ) return;

            console.log( res.data );

            await ctx.send( "sendMessage", {
                "text": this.l10nt( `Senf me more images.` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": this.l10nt( `Delete / sort images` ),
                                "callback_data": this.encodeCallbackData( "editAttachments", "start" ),
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

        // private
    };

// hideGeneralForumTopic( { chat_id } );

const MESSAGE_ID_NAME = "_externalChatMessageId";

export default Super =>
    class extends Super {

        // public
        async run ( ctx, message ) {
            if ( ctx.state?.[ MESSAGE_ID_NAME ] ) {
                await ctx.send( "deleteMessage", {
                    "message_id": ctx.state?.[ MESSAGE_ID_NAME ],
                } );
            }

            const res = await this._sendChatPrompt( ctx );

            await ctx.updateState( {
                [ MESSAGE_ID_NAME ]: res.data?.message_id,
            } );

            return res;
        }

        isEnabled ( ctx ) {
            return this.bot.externalChat.isEnabled && !ctx.permissions.has( "telegram/bot:read" );
        }

        // protected
        async _sendChatPrompt ( ctx ) {
            return ctx.sendMessage( {
                "text": l10nt( `To write me a message, please, go to the chat.` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": l10nt( `Open the chat` ),
                                "url": this.bot.externalChat.chatUrl,
                            },
                        ],
                    ],
                },
            } );
        }
    };

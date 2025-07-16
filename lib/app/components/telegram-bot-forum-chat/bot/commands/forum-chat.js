// hideGeneralForumTopic( { chat_id } );

export default Super =>
    class extends Super {

        // public
        async run ( ctx, message ) {
            if ( ctx.permissions.has( "telegram/bot:read" ) ) {
                return this._runUserRequest( ctx, message );
            }
            else {
                return this._runCustomerRequest( ctx, message );
            }
        }

        async beforeExit ( ctx ) {
            return this.#clearState( ctx );
        }

        // protected
        async _init () {
            const res = this.bot.forumChat.setCommand( this );
            if ( !res.ok ) return res;

            return super._init();
        }

        async _runUserRequest ( ctx, message ) {
            return ctx.sendMessage( {
                "text": l10nt( "Open chats with customers" ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": l10nt( "Open chats" ),
                                "url": this.bot.forumChat.inviteLink,
                            },
                        ],
                    ],
                },
            } );
        }

        async _runCustomerRequest ( ctx, message ) {
            const group = await this.bot.forumChat.getGroup();

            if ( !message ) {
                await this.bot.forumChat.deleteNotInChatMessage( ctx.user );

                return ctx.sendMessage( {
                    "text": l10nt( `Write me a message.
To exit chat use "Menu" button.` ),
                    "reply_markup": {
                        "input_field_placeholder": l10nt( `Write me a message.
To exit chat use "Menu" button.` ),
                        "resize_keyboard": true,
                        "is_persistent": true,
                        "one_time_keyboard": true,
                        "keyboard": [
                            [
                                {
                                    "text": l10nt( "/start - Exit from the chat" ),
                                },
                            ],
                        ],
                    },
                } );
            }
            else {
                const topicId = await this.bot.forumChat.getUserTopic( ctx.user );

                return group.send( "forwardMessage", {
                    "message_thread_id": topicId,
                    "from_chat_id": message.chat.id,
                    "message_id": message.id,
                } );
            }
        }

        // private
        async #clearState ( ctx ) {
            await ctx.sendMessage( {
                "text": l10nt( "Chat closed" ),
                "reply_markup": {
                    "remove_keyboard": true,
                },
            } );
        }
    };

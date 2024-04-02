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
        // XXX
        // XXX setChatPhoto
        async _runUserRequest ( ctx, message ) {
            const group = await this.bot.forumChat.getGroup();

            var res;

            // check user is chat member
            res = await group.send( "getChatMember", { "user_id": ctx.user.id } );

            if ( !res.ok ) return res;

            // user is not a group member
            if ( res.data?.status === "left" || res.data?.status === "kicked" ) {

                // unban user
                if ( res.data?.status === "kicked" ) {
                    await group.unbanChatMember( ctx.user.id );
                }

                return ctx.sendMessage( {
                    "text": l10nt( "Join chats with customers" ),
                    "reply_markup": {
                        "inline_keyboard": [
                            [
                                {
                                    "text": l10nt( `Join chats with customers` ),
                                    "url": this.bot.forumChat.inviteLink,
                                },
                            ],
                        ],
                    },
                } );
            }

            // user is group member
            else {
                return ctx.sendMessage( {
                    "text": l10nt( "Open chats with customers" ),
                    "reply_markup": {
                        "inline_keyboard": [
                            [
                                {
                                    "text": l10nt( `Open chats with customers` ),
                                    "url": group.url,
                                },
                            ],
                        ],
                    },
                } );
            }
        }

        async _runCustomerRequest ( ctx, message ) {
            const group = await this.bot.forumChat.getGroup();

            if ( !message ) {
                return ctx.sendMessage( {
                    "text": l10nt( `Write me a message.
To exit chat use "Start" menu.` ),
                    "reply_markup": {
                        "input_field_placeholder": l10nt( `Write me a message.
To exit chat use "Start" menu.` ),
                        "resize_keyboard": true,
                        "is_persistent": true,
                        "one_time_keyboard": true,
                        "keyboard": [
                            [
                                {
                                    "text": l10nt( `/start - Exit from the chat` ),
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
                "text": l10nt( `Chat closed` ),
                "reply_markup": {
                    "remove_keyboard": true,
                },
            } );

            return ctx.clearState();
        }
    };

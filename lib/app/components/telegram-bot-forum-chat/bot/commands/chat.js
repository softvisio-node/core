import Group from "#core/app/components/telegram/bot/group";

const GROUP_ID = -1002129204405;

// hideGeneralForumTopic( { chat_id } );

export default Super =>
    class extends Super {
        #group;

        // public
        // XXX
        async run ( ctx, requestMessage ) {
            await this.#init();

            var res;

            if ( ctx.permissions.has( "telegram/bot:read" ) ) {

                // XXX
                // check user is chat member
                res = await this.#group.getChatMember( ctx.user.telegramUserId );

                // user is not a group member
                if ( res.data?.status === "left" || res.data?.status === "kicked" ) {

                    // unban user
                    if ( res.data?.status === "kicked" ) {
                        await this.#group.unbanChatMember( ctx.user.telegramUserId );
                    }

                    // create invite link
                    // res = await this.#group.createChatInviteLink();
                    // const inviteLink = res.data.invite_link;

                    // get invite link
                    res = await this.#group.exportChatInviteLink();
                    const inviteLink = res.data;

                    return ctx.sendMessage( {
                        "text": "Opem group chats",
                        "reply_markup": {
                            "inline_keyboard": [
                                [
                                    {
                                        "text": `Join chats with customers`,
                                        "url": inviteLink,
                                    },
                                ],
                            ],
                        },
                    } );
                }

                // user is group member
                else {
                    return ctx.sendMessage( {
                        "text": "Opem group chats",
                        "reply_markup": {
                            "inline_keyboard": [
                                [
                                    {
                                        "text": `Opem chats with customers`,
                                        "url": this.#group.getTopicUrl(),
                                    },
                                ],
                            ],
                        },
                    } );
                }
            }

            // customer
            else {
                if ( !ctx.state?.entered ) {
                    await ctx.updateState( { "entered": true } );

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
                else if ( requestMessage ) {

                    // XXX
                    // res = await this.#group.createForumTopic( ctx.user.username );
                    // const topicId = res.data.message_thread_id;

                    const topicId = 13;

                    // XXX copy message to topic
                    await this.#group.send( "forwardMessage", {
                        "message_thread_id": topicId,
                        "from_chat_id": requestMessage.chat.id,
                        "message_id": requestMessage.id,
                    } );
                }
            }
        }

        async beforeExit ( ctx ) {
            return this.#clearState( ctx );
        }

        // XXX
        async runSupergroupRequest ( ctx, req ) {
            await this.#init();

            // XXX resolve user id by req.data.message_thread_id
            const userId = 5877067384;

            await this.bot.telegramBotApi.copyMessage( {
                "chat_id": userId,
                "from_chat_id": req.chat.id, // this.#group.id,
                "message_id": req.data.message_id,
            } );
        }

        // private
        async #init () {
            if ( !this.#group ) {
                this.#group ??= new Group( this.bot, GROUP_ID );

                await this.#group.hideGeneralForumTopic();
            }
        }

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

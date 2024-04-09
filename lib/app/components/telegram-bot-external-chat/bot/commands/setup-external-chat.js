// hideGeneralForumTopic( { chat_id } );

export default Super =>
    class extends Super {

        // public
        // XXX
        async run ( ctx, message ) {
            if ( message?.text ) {
                const res = await this.bot.externalChat.setChatUrl( message.text );

                if ( !res.ok ) {

                    // XXX
                }
            }
        }

        isEnabled ( ctx ) {
            return ctx.permissions.has( "telegram/bot:update" );
        }
    };

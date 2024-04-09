// hideGeneralForumTopic( { chat_id } );

export default Super =>
    class extends Super {

        // public
        async run ( ctx, message ) {
            if ( message?.text ) {
                const res = await this.bot.ecternalCjat.setChatUrl( message.text );

                if ( !res.ok ) {

                    // XXX
                }
            }
        }

        isEnabled ( ctx ) {
            return ctx.permissions.has( "telegram/bot:update" );
        }
    };

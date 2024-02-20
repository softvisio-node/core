import sql from "#lib/sql";

const SQL = {
    "getStats": sql`SELECT last_user_created, total_users, total_subscribed_users, total_unsubscribed_users FROM telegram_bot WHERE id = ?`.prepare(),
};

export default Super =>
    class extends Super {

        // public
        //
        getDescription ( ctx ) {
            return l10nt( `bot statistics` );
        }

        checkPermissions ( ctx ) {
            return ctx.permissions.has( "telegram/bot:update" );
        }

        async run ( ctx, requestMessage ) {
            const res = await this.dbh.selectRow( SQL.getStats, [ this.bot.id ] );

            await ctx.sendMessage( {
                "text": l10nt( msgid`Bot statistics:

Total users: **${ res.data.total_users }**
Subsctibed users: **${ res.data.total_subscribed_users }**
Unsubsctibed users: **${ res.data.total_unsubscribed_users }**
` ),
            } );
        }
    };

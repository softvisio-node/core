import sql from "#lib/sql";

const SQL = {
    "getStats": sql`SELECT last_user_created, total_users, total_subscribed_users, total_unsubscribed_users FROM telegram_bot WHERE id = ?`.prepare(),
};

export default Super =>
    class extends Super {

        // public
        //
        getDescription ( ctx ) {
            return l10nt( `bot's statistics` );
        }

        checkPermissions ( ctx ) {
            return ctx.permissions.has( "telegram/bot:update" );
        }

        async run ( ctx, requestMessage ) {
            const res = await this.dbh.selectRow( SQL.getStats, [ this.bot.id ] );

            await ctx.sendMessage( {
                "text": l10nt( msgid`Bot's statistics:

Total users: <b>${ res.data.total_users }</b>
Subsctibed users: <b>${ res.data.total_subscribed_users }</b>
Unsubsctibed users: <b>${ res.data.total_unsubscribed_users }</b>
` ),
                "parse_mode": "HTML",
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": l10nt( `View charts` ),
                                "web_app": {
                                    "url": await ctx.createWebAooUrl( {
                                        "type": "bot-statistics",
                                    } ),
                                },
                            },
                        ],
                    ],
                },
            } );
        }
    };

import sql from "#lib/sql";

const SQL = {
    "getStats": sql`SELECT last_user_created, total_users, total_subscribed_users, total_unsubscribed_users FROM telegram_bot WHERE id = ?`.prepare(),
};

export default Super =>
    class extends Super {

        // public
        //
        async run ( ctx, message ) {
            await ctx.sendMessage( await this.#getReportMessage( ctx ) );
        }

        isEnabled ( ctx ) {
            return ctx.permissions.has( "telegram/bot:update" );
        }

        getDescription ( ctx ) {
            return l10nt( `bot's statistics` );
        }

        async API_refresh ( ctx ) {
            const msg = await this.#getReportMessage( ctx );

            msg.message_id = ctx.request.message.id;

            return ctx.send( "editMessageText", msg );
        }

        // private
        async #getReportMessage ( ctx ) {
            const res = await this.dbh.selectRow( SQL.getStats, [ this.bot.id ] );

            return {
                "text": l10nt( locale =>
                    locale.l10n( msgid`Bot's statistics (${ locale.formatDate( new Date(), "dateStyle:short,timeStyle:short" ) }):

Total users: <b>${ res.data.total_users }</b>
Subsctibed users: <b>${ res.data.total_subscribed_users }</b>
Unsubsctibed users: <b>${ res.data.total_unsubscribed_users }</b>
` ) ),
                "parse_mode": "HTML",
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": l10nt( `Refresh` ),
                                "callback_data": this.createCallbackData( "refresh" ),
                            },
                        ],
                        [
                            {
                                "text": l10nt( `View charts` ),
                                "web_app": {
                                    "url": ctx.createWebAppUrl( "bot-statistics" ),
                                },
                            },
                        ],
                    ],
                },
            };
        }
    };

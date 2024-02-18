import sql from "#lib/sql";

const SQL = {
    "insertLink": sql`
INSERT INTO
    telegram_bot_user_link
(
    telegram_bot_user_id,
    telegram_bot_link_id,
    new_user
)
VALUES (
    ?,
    ( SELECT id FROM telegram_bot_link WHERE token = ? AND telegram_bot_id = ? ),
    ?
)
ON CONFLICT ( telegram_bot_user_id, telegram_bot_link_id ) DO NOTHING
`.prepare(),
};

export default Super =>
    class extends Super {

        // public
        getDescription ( ctx ) {
            return global.l10nt( `back to the start` );
        }

        getMenuButton ( ctx ) {
            return "default";
        }

        async runPrivateRequest ( ctx, req ) {

            // callback query
            if ( req.isCallbackQuery ) {
                const callbackData = this.telegram.decodeCallbackData( req.data.data );

                // unable to parse callback data
                if ( !callbackData ) return;

                return ctx.runCallback( ...callbackData );
            }

            // message
            else if ( req.isMessage ) {

                // command
                if ( req.command ) {

                    // start command
                    if ( req.command === "start" && req.decodedCommandData ) {
                        const [ linkToken, method, ...args ] = req.decodedCommandData;

                        if ( linkToken ) await this.#addLink( ctx, linkToken );

                        if ( method ) {
                            return ctx.runCallback( method, ...args );
                        }
                        else {
                            return ctx.run( "start" );
                        }
                    }

                    // command is valid
                    else if ( this.bot.commands.has( req.command ) ) {
                        return ctx.run( req.command );
                    }

                    // command is not valie
                    else {
                        await ctx.sendText( global.l10nt( `Command is unknown. Please, use commands from "Menu".` ) );

                        return ctx.run();
                    }
                }

                // message
                else {
                    return ctx.run( null, req.message );
                }
            }

            // service request
            else {
                return this._runPrivateServiceRequest( ctx, req );
            }
        }

        async runSupergroupRequest ( ctx, req ) {}

        async runChannelRequest ( ctx, req ) {}

        async runInlineQueryRequest ( ctx, req ) {}

        async redirectCall ( ctx ) {
            if ( this.#checkLocale( ctx ) ) return "locale";

            if ( this.#checkSignin( ctx ) ) return "sign_in";
        }

        // protected
        async _runPrivateServiceRequest ( ctx, req ) {}

        // private
        #checkLocale ( ctx ) {
            if ( !this.bot.commands.has( "locale" ) ) return;

            if ( ctx.user.localeIsSet ) return;

            if ( !this.bot.locales.canChangeLocale( ctx.user.locale ) ) return;

            return true;
        }

        #checkSignin ( ctx ) {
            if ( !this.bot.config.telegram.signinRequired ) return;

            if ( !this.bot.commands.has( "sign_in" ) ) return;

            if ( ctx.user.apiUserId ) return;

            return true;
        }

        async #addLink ( ctx, linkToken ) {
            await this.dbh.do( SQL.insertLink, [

                //
                ctx.user.id,
                linkToken.readBigInt64BE(),
                this.bot.id,
                ctx.isNewUser,
            ] );
        }
    };

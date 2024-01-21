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

        // properties
        get menuButton () {
            return "default";
        }

        get commands () {
            return false;
        }

        // public
        async startRequest ( ctx, req ) {

            // command
            if ( req.command ) {

                // start command
                if ( req.command === "start" && req.decodedCommandData ) {
                    const [linkToken, method, ...args] = req.decodedCommandData;

                    if ( linkToken ) await this.#addLink( ctx, linkToken );

                    if ( method ) {
                        return ctx.runCallback( [method, ...args] );
                    }
                    else {
                        return ctx.run( "start" );
                    }
                }

                // command is valid
                else if ( this.bot.modules.has( req.command ) ) {
                    return ctx.run( req.command, req );
                }

                // command is not valie
                else {
                    await ctx.sendText( this.l10nt( `Command is unknown. Please, use commands from "Menu".` ) );

                    return ctx.run( null );
                }
            }

            // run module
            else {
                return ctx.run( null, req );
            }
        }

        async redirectCall ( ctx ) {
            if ( this.#checkLocale( ctx ) ) return "locale";

            if ( this.#checkSignin( ctx ) ) return "sign_in";
        }

        // private
        #checkLocale ( ctx ) {
            if ( !this.bot.modules.has( "locale" ) ) return;

            if ( ctx.user.localeIsSet ) return;

            if ( !this.bot.locales.canChangeLocale( ctx.user.locale ) ) return;

            return true;
        }

        #checkSignin ( ctx ) {
            if ( !this.bot.config.telegram.signinRequired ) return;

            if ( !this.bot.modules.has( "sign_in" ) ) return;

            if ( ctx.isAuthenticated ) return;

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

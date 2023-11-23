import { uuidFromBuffer } from "#lib/uuid";
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
    ( SELECT id FROM telegram_bot_link WHERE guid = ? AND telegram_bot_id = ? ),
    ?
)
ON CONFLICT ( telegram_bot_user_id, telegram_bot_link_id ) DO NOTHING
`.prepare(),
};

export default Super =>
    class extends Super {

        // properties
        get commands () {
            return false;
        }

        // public
        async startRequest ( ctx, req ) {

            // command
            if ( req.command ) {

                // start command
                if ( req.command === "start" && req.decodedCommandData ) {
                    if ( req.decodedCommandData.method === "link" ) {
                        const linkGuid = uuidFromBuffer( req.decodedCommandData.args[0] );

                        await this.dbh.do( SQL.insertLink, [

                            //
                            ctx.user.id,
                            linkGuid,
                            this.bot.id,
                            ctx.isNewUser,
                        ] );

                        return ctx.call( "start" );
                    }
                    else {
                        return ctx.runCallback( req.decodedCommandData );
                    }
                }

                // command is valid
                else if ( this.bot.modules.has( req.command ) ) {
                    return ctx.call( req.command, req );
                }

                // command is not valie
                else {

                    // set commads
                    await this._setCommands( ctx );

                    await ctx.user.sendText( this.l10nt( `Command is unknown. Please, use commands from "Menu".` ) );

                    return;
                }
            }

            // run module
            else {
                return ctx.call( null, req );
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
            if ( !this.bot.modules.has( "sign_in" ) ) return;

            if ( ctx.user.apiUserId ) return;

            return true;
        }
    };

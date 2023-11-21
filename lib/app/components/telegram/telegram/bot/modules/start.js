import { uuidFromBuffer } from "#lib/uuid";
import sql from "#lib/sql";

export default Super =>
    class extends Super {

        // properties
        get commands () {
            return false;
        }

        // public
        async processRequest ( ctx, req ) {

            // command
            if ( req.command ) {

                // start command
                if ( req.command === "start" && req.decodedCommandData ) {
                    if ( req.decodedCommandData.method === "link" ) {
                        if ( ctx.isNewUser ) {
                            const linkGuid = uuidFromBuffer( req.decodedCommandData.args[0] );

                            await this.dbh.do( sql`UPDATE telegram_bot_user SET telegram_bot_link_id = ( SELECT id FROM telegram_bot_link WHERE guid = ? AND telegram_bot_id = ? ) WHERE id = ?`, [

                                //
                                linkGuid,
                                this.bot.id,
                                ctx.user.id,
                            ] );
                        }

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

                    return this._onInvalidCommand( ctx, req );
                }
            }

            // run module
            else {
                return ctx.call( ctx.userModule, req );
            }
        }

        async beforeRun ( ctx ) {

            // check locale
            if ( await this.#checkLocale( ctx ) ) return true;

            return await super.beforeRun( ctx );
        }

        // protected
        async _onInvalidCommand ( ctx, req ) {
            await ctx.user.sendText( this.l10nt( `Command is unknown. Please, use commands from "Menu".` ) );
        }

        // private
        async #checkLocale ( ctx ) {
            if ( !this.bot.modules.has( "locale" ) ) return;

            if ( !this.bot.locales.canChangeLocale( ctx.user.locale ) ) return;

            if ( ctx.user.localeIsSet ) return;

            await ctx.call( "locale" );

            return true;
        }
    };

import crypto from "node:crypto";

export default Super =>
    class extends Super {
        #commandsHash;

        // properties
        get commands () {
            return null;
        }

        // public
        async processRequest ( ctx, req ) {
            if ( await this._beforeProcessRequest( ctx, req ) ) return;

            // command
            if ( req.command ) {
                if ( req.command === "/start" ) {

                    // sign-in
                    if ( req.decodedCommandData?.method === "sign-in" && this.bot.modules.has( "sign-in" ) ) {
                        return ctx.call( "sign-in", req );
                    }
                }

                // command is valid
                else if ( this.bot.modules.has( req.command ) ) {
                    return ctx.call( req.command );
                }

                // command is not valie
                else {

                    // set commads
                    await this.#setCommands( ctx );

                    return this._onInvalidCommand( ctx, req );
                }
            }

            // run module
            else {
                return ctx.call( ctx.userModule, req );
            }
        }

        async beforeRun ( ctx ) {

            // set commads
            await this.#setCommands( ctx );
        }

        // protected
        async _beforeProcessRequest ( ctx, req ) {

            // check locale
            if ( await this.#checkLocale( ctx ) ) return true;

            // set commads
            await this.#setCommands( ctx );
        }

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

        async #setCommands ( ctx ) {
            if ( !this.#commandsHash ) {
                const commands = JSON.stringify( this.commands );

                this.#commandsHash = crypto.createHash( "MD5" ).update( commands ).digest( "base64url" );
            }

            if ( this.#commandsHash !== ctx.state.commandsHash || ctx.user.locale !== ctx.state.commandsLocale ) {
                await ctx.user.setChatCommands( this.commands );

                await ctx.updateState( {
                    "commandsHash": this.#commandsHash,
                    "commandsLocale": ctx.user.locale,
                } );
            }
        }
    };

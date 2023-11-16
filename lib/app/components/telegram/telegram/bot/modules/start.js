import crypto from "node:crypto";

export default Super =>
    class extends Super {
        #commandsHash;

        // properties
        get commands () {
            return null;
        }

        // public
        async onRequest ( ctx, req ) {

            // check locale
            if ( await this._checkLocale( ctx ) ) return;

            // set commads
            await this.#setCommands( ctx );

            // command
            if ( req.command ) {

                // command is valid
                if ( this.bot.getModuleInstance( req.command ) ) {
                    return ctx.call( req.command );
                }

                // command is not valie
                else {
                    return this._onInvalidCommand( ctx, req );
                }
            }

            // run module
            else {
                return ctx.call( ctx.userModule, req );
            }
        }

        // protected
        async _onInvalidCommand ( ctx, req ) {
            await ctx.user.sendText( this.l10nt( `Command is unknown. Please, use commands from "Menu".` ) );
        }

        async _checkLocale ( ctx ) {
            if ( this.bot.locales.canChangeLocale( ctx.user.locale ) && !ctx.user.localeIsSet ) {
                await ctx.call( "/locale" );

                return true;
            }
        }

        // private
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

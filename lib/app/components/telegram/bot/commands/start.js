import constants from "#lib/app/constants";

export default Super =>
    class extends Super {

        // public
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
                    if ( req.command === "start" && req.commandData ) {
                        const [ id, ...args ] = req.commandData.split( "-" );

                        const method = this.bot.commands.getStartCallback( id );

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
                        await ctx.sendText( l10nt( `Command is unknown. Please, use commands from "Menu".` ) );

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

        getDescription ( ctx ) {
            return l10nt( `back to the start` );
        }

        getMenuButton ( ctx ) {
            return "default";
        }

        async redirectCall ( ctx ) {
            if ( this.#checkLocale( ctx ) ) return "locale";

            if ( await this.#checkSignin( ctx ) ) return "account";
        }

        async API_registerBotLink ( ctx, linkId ) {
            if ( linkId ) await this.bot.links.registerUser( linkId, ctx.user.id, ctx.isNewUser );
        }

        // protected
        async _init () {
            const res = this._registerStartCallback( this.app.telegram.config.linkStartParameterName, "registerBotLink" );
            if ( !res.ok ) return res;

            return super._init();
        }

        async _runPrivateServiceRequest ( ctx, req ) {}

        // private
        #checkLocale ( ctx ) {
            if ( ctx.user.localeIsSet ) return;

            if ( !this.bot.commands.get( "locale" )?.isEnabled( ctx ) ) return;

            return true;
        }

        async #checkSignin ( ctx ) {
            if ( ctx.user.apiUserId ) return;

            if ( this.bot.config.telegram.signinRequired ) {
                if ( this.bot.config.telegram.signinRequired === "auto" ) {
                    await this.#signUpAutomatically( ctx );
                }
                else if ( this.bot.commands.has( "account" ) ) {
                    return true;
                }
                else {
                    throw `"account" command is required if signin required`;
                }
            }
        }

        async #signUpAutomatically ( ctx ) {
            const res = await this.dbh.begin( async dbh => {
                var apiUserId;

                const email = ctx.user.id + "@telegram" + constants.localEmailTld;

                const apiUser = await this.app.users.getUserByEmail( email, { dbh } );

                // api user exists
                if ( apiUser ) {
                    apiUserId = apiUser.id;
                }

                // api user not exists
                else {

                    // create api user
                    const res = await this.app.users.createUser( email, {
                        "locale": ctx.user.locale,
                        "emailConfirmed": false,
                        dbh,
                    } );

                    if ( !res.ok ) throw res;

                    apiUserId = res.data.id;
                }

                // set api user
                const res = await await ctx.user.setApiUserId( apiUserId, { dbh } );

                if ( res.ok ) {
                    await ctx.updatePermissions();
                }
                else {
                    throw res;
                }
            } );

            if ( !res.ok ) {
                console.error( `Error sign up telegram user:`, res + "" );
            }

            return ctx.run( "start" );
        }
    };

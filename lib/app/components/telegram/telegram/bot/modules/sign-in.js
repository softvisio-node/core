import { validateEmail } from "#lib/validate";
import constants from "#lib/app/comstanns";

export default Super =>
    class extends Super {

        // public
        async run ( ctx, req ) {

            // already signed-in
            if ( ctx.user.apiUserId ) {
                const apiUser = await this.api.users.get( ctx.user.apiUserId );

                return ctx.user.sentText( apiUser.email );
            }
            else if ( ctx.state.email ) {
                return this._waitForToken( ctx );
            }
            else {
                return this._requestEmail( ctx, req );
            }
        }

        async API_resendConfirmatioEmail ( ctx ) {
            return this.#sendConfirmationEmail( ctx );
        }

        async API_changeEmailAddress ( ctx ) {
            await ctx.updateState( {
                "email": null,
            } );

            return this.run( ctx );
        }

        // protected
        async _requestEmail ( ctx, req ) {
            if ( req.message.text ) {
                const email = req.message.text;

                if ( !validateEmail( email ).ok ) {
                    await ctx.user.sendText( this.l10nt( `Email address is not valid` ) );
                }
                else {
                    await ctx.updateState( {
                        email,
                    } );

                    await this.#sendConfirmationEmail( ctx );

                    return this._waitForToken( ctx );
                }
            }

            return ctx.user.sendMessage( {
                "text": this.l10nt( `To sign in, please, enter yoour email address` ),
            } );
        }

        async _waitForToken ( ctx ) {
            return ctx.user.sendMessage( {
                "text": this.l10nt( msgid`Your email address: ${ctx.state.email}.
We sent confirmation email.
` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": this.l10nt( `Send confirmation email again` ),
                                "callback_data": this.encodeCallbackData( "resendConfirmatioEmail" ),
                            },
                        ],
                        [
                            {
                                "text": this.l10nt( `Change email address` ),
                                "callback_data": this.encodeCallbackData( "changeEmailAddress" ),
                            },
                        ],
                    ],
                },
            } );
        }

        // private
        // XXX
        async #sendConfirmationEmail ( ctx ) {
            const res = await this.app.actionTokens.createActionToken( null, constants.telegramSignInToken.id, {
                "length": constants.telegramSignInToken.length,
                "maxAge": constants.telegramSignInToken.maxAge,
            } );

            if ( !res.ok ) return res;

            const start = this.encodeCallbackData( "sign-in", res.data.token );

            const linkTelegramBotUrl = new URL( "https://t.me/" + this.app.notifications.telegramBotUsername );
            linkTelegramBotUrl.searchParams.set( "start", start );

            return result( 200, { linkTelegramBotUrl } );
        }

        // XXX
        async setApiUserId ( apiUserId, { dbh } = {} ) {
            apiUserId ||= null;

            if ( this.apiUserId === apiUserId ) return result( 200 );

            dbh ||= this.dbh;

            const res = await dbh.begin( async dbh => {
                let res;

                // unlink
                if ( !apiUserId ) {
                    const oldApiUser = await this.app.users.getUserById( this.apiUserId, { dbh } );
                    if ( !oldApiUser ) throw result( [404, `API user not founs`] );

                    res = await super.setApiUserId( null, { dbh } );
                    if ( !res.ok ) throw res;

                    dbh.doAfterCommit( async () => {
                        this.updateUserFields( { "api_user_id": null } );

                        // notify old api user
                        await this.app.publishToApi( "/notifications/telegram/update/", oldApiUser.id );

                        const body = this.app.templates.get( "telegram/unlink-account/body" ).clone( {
                            "data": {
                                "telegramUsername": this.username,
                                "email": oldApiUser.email,
                            },
                        } );

                        await this.sendNotification( this.app.templates.get( "telegram/unlink-account/subject" ), body );

                        this.app.notifications.sendNotification( "security", oldApiUser.id, this.app.templates.get( "telegram/unlink-account/subject" ), body );
                    } );
                }

                // link
                else {
                    const newApiUser = await this.app.users.getUserById( apiUserId, { dbh } );
                    if ( !newApiUser ) throw result( [404, `API user not founs`] );

                    if ( this.apiUserId ) {
                        var oldApiUser = await this.app.users.getUserById( this.apiUserId, { dbh } );
                        if ( !oldApiUser ) throw result( [404, `API user not founs`] );
                    }

                    const oldTelegramBotUser = await this.bot.users.getByApiUserId( apiUserId, { dbh } );

                    // api user is linked to some other telegram user
                    if ( oldTelegramBotUser ) {

                        // unlink api user
                        res = await oldTelegramBotUser.setApiUserId();
                        if ( !res.ok ) throw res;
                    }

                    // set api user id
                    res = await super.setApiUserId( apiUserId, { dbh } );
                    if ( !res.ok ) throw res;

                    dbh.doAfterCommit( async () => {
                        this.updateUserFields( { "api_user_id": apiUserId } );

                        this.app.publishToApi( "/notifications/telegram/update/", newApiUser.id, this );

                        // notify new api user
                        await this.app.notifications.sendNotification(
                            "security",
                            newApiUser.id,
                            this.app.templates.get( "telegram/link-account/subject" ),
                            this.app.templates.get( "telegram/link-account/body" ).clone( {
                                "data": {
                                    "telegramUsername": this.username,
                                    "email": newApiUser.email,
                                },
                            } )
                        );

                        // notify old api user
                        if ( oldApiUser.id ) {
                            this.app.publishToApi( "/notifications/telegram/update/", oldApiUser.id );

                            await this.app.notifications.sendNotification(
                                "security",
                                oldApiUser.id,
                                this.app.templates.get( "telegram/unlink-account/subject" ),
                                this.app.templates.get( "telegram/unlink-account/body" ).clone( {
                                    "data": {
                                        "telegramUsername": this.username,
                                        "email": oldApiUser.email,
                                    },
                                } )
                            );
                        }
                    } );
                }

                return result( 200 );
            } );

            return res;
        }
    };

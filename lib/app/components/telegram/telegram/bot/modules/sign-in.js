import { validateEmail } from "#lib/validate";
import crypto from "node:crypto";
import Translation from "#lib/locale/translation";

export default Super =>
    class extends Super {

        // public
        async run ( ctx, req ) {

            // already signed-in
            if ( ctx.user.apiUserId ) {
                const apiUser = await this.api.users.get( ctx.user.apiUserId );

                return ctx.user.sentText( apiUser.email );
            }

            // complete sign-in
            else if ( req?.command === "start" ) {
                return this._completeSidnIn( ctx, req );
            }
            else if ( ctx.state.email ) {
                return this._waitForToken( ctx );
            }
            else {
                return this._requestEmail( ctx, req );
            }
        }

        async API_resendConfirmatioEmail ( ctx ) {
            await this.#sendConfirmationEmail( ctx );

            return this._waitForToken( ctx );
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
            return this.#waitConfirmation(
                ctx,
                this.l10nt( `To complete sign in, please, click on link which I just sent to your email address.
If you didn't received emaul in several minutes you can send it again.` )
            );
        }

        // XXX
        async _completeSidnIn ( ctx, req ) {
            if ( ctx.state.email ) {
                const token = crypto
                    .createHmac( "md5", this.bot.telegramBotApi.apiToken )
                    .update( ctx.user.telegramId + "/" )
                    .update( ctx.state.email )
                    .digest( "hex" );

                if ( req.decodedCommandData?.args[0].toString( "hex" ) === token ) {

                    // XXX
                }
            }

            return this.#waitConfirmation( ctx, this.l10nt( `Token is not valid. Please, try again.` ) );
        }

        // private
        // XXX
        async #sendConfirmationEmail ( ctx ) {
            const token = crypto
                .createHmac( "md5", this.bot.telegramBotApi.apiToken )
                .update( ctx.user.telegramId + "/" )
                .update( ctx.state.email )
                .digest();

            const url = new URL( "https://t.me/" + this.bot.telegramUsername );
            url.searchParams.set( "start", this.encodeCallbackData( "sign-in", token ) );

            await this.app.notifications.sendEmail(
                ctx.state.email,
                this.app.templates.get( "telegram/sign-in-email/subject" ).toString( {
                    "localeDomain": ctx.user.id,
                    "data": {
                        "telegramBotName": this.bot.name,
                    },
                } ),
                this.app.templates.get( "telegram/sign-in-email/body" ).toString( {
                    "localeDomain": ctx.user.id,
                    "data": {
                        url,
                        "telegramBotName": this.bot.name,
                    },
                } )
            );

            return this.#waitConfirmation(
                ctx,
                this.l10nt( msgid`I just sent link to sign inl to your emaul address ${ctx.state.email}.
Please, use this link to comlete sign in.` )
            );
        }

        async #waitConfirmation ( ctx, message ) {
            await this.#deleteConfirmationMessage( ctx );

            const res = await ctx.user.sendMessage( {
                "text": this.l10nt( locale =>
                    locale.l10n( msgid`${Translation.toString( message, { locale } )}

Yout email address: ${ctx.state.email}
` ) ),
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

            if ( res.ok ) {
                await ctx.updateState( {
                    "confirmationMessageId": res.data.message_id,
                } );
            }
        }

        async #deleteConfirmationMessage ( ctx ) {
            if ( !ctx.state.confirmationMessageId ) return;

            await ctx.user.deleteMessage( ctx.state.confirmationMessageId );

            await ctx.updateState( {
                "confirmationMessageId": null,
            } );
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

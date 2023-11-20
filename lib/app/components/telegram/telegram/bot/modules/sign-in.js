import { validateEmail } from "#lib/validate";
import crypto from "node:crypto";
import Translation from "#lib/locale/translation";
import sql from "#lib/sql";

export default Super =>
    class extends Super {

        // public
        async run ( ctx, req ) {

            // already signed-in
            if ( ctx.user.apiUserId ) {
                return this._onComplete( ctx );
            }

            // complete sign-in
            else if ( req?.command === "start" ) {
                return this._onConfirmationReceived( ctx, req );
            }
            else if ( ctx.state.email ) {
                return this._onWaitForConfirmation( ctx );
            }
            else {
                return this._onWaitForEmail( ctx, req );
            }
        }

        async API_resendConfirmatioEmail ( ctx ) {
            await this.#sendConfirmationEmail( ctx );

            return this._onWaitForConfirmation( ctx );
        }

        async API_changeEmailAddress ( ctx ) {
            await ctx.updateState( {
                "email": null,
            } );

            return this.run( ctx );
        }

        // protected
        async _onWaitForEmail ( ctx, req ) {
            if ( req?.message.text ) {
                const email = req.message.text;

                if ( !validateEmail( email ).ok ) {
                    await ctx.user.sendText( this.l10nt( `Email address is not valid` ) );
                }
                else {
                    await ctx.updateState( {
                        email,
                    } );

                    return this.#sendConfirmationEmail( ctx );
                }
            }

            return ctx.user.sendMessage( {
                "text": this.l10nt( `To sign in, please, enter yoour email address` ),
            } );
        }

        async _onWaitForConfirmation ( ctx ) {
            return this.#sendWaitForConfirmationMessage(
                ctx,
                this.l10nt( `To complete sign in, please, click on link which I just sent to your email address.
If you didn't received emaul in several minutes you can send it again.` )
            );
        }

        // XXX
        async _onConfirmationReceived ( ctx, req ) {
            CONFIRM: if ( ctx.state.email ) {
                const token = crypto
                    .createHmac( "md5", this.bot.telegramBotApi.apiToken )
                    .update( ctx.user.telegramId + "/" )
                    .update( ctx.state.email )
                    .digest( "hex" );

                if ( req.decodedCommandData?.args[0].toString( "hex" ) === token ) {
                    const res = await this.dbh.begin( async dbh => {
                        let user = await this.app.users.getByEmail( ctx.state.email );

                        // create user
                        if ( !user ) {
                            const res = await this.app.users.createUser( ctx.state.email, {
                                "locale": ctx.user.locale,
                                "emailConfirmed": true,
                            } );

                            if ( !res.ok ) throw res;

                            user = await this.app.users.get( res.data.id );
                        }

                        const res = await this.dbh.do( sql`UPDATE telegram_user SET api_user_id = ? WHERE telegram_id = ?`, [

                            //
                            user.id,
                            ctx.user.telegramId,
                        ] );

                        if ( !res.ok ) throw res;
                    } );

                    if ( !res.ok ) break CONFIRM;

                    // XXX
                    // this.app.publishToApi( "/notifications/telegram/update/", newApiUser.id, this );

                    return this._onComplete( ctx );
                }
            }

            return this.#sendWaitForConfirmationMessage( ctx, this.l10nt( `Confirmation link is not valid. Please, try again.` ) );
        }

        async _onComplete ( ctx ) {
            const apiUser = await this.api.users.get( ctx.user.apiUserId );

            await this.#deleteConfirmationMessage( ctx );

            return ctx.user.sendMessage( {
                "text": this.l10nt( msgid`You are signed in as: ${apiUser.email}` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": this.l10nt( `Return to start` ),
                                "callback_data": this.encodeCallbackData( "call", "start" ),
                            },
                        ],
                    ],
                },
            } );
        }

        // private
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

            return this._onWaitForConfirmation( ctx );
        }

        async #sendWaitForConfirmationMessage ( ctx, message ) {
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
    };

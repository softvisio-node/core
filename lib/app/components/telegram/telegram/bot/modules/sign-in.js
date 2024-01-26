import { validateEmail } from "#lib/validate";
import crypto from "node:crypto";
import Translation from "#lib/locale/translation";
import sql from "#lib/sql";
import constants from "#lib/app/constants";

const SQL = {
    "getTelegramUserByEmail": sql`
SELECT
    telegram_user.id
FROM
    "user",
    telegram_user
WHERE
    "user".email = ?
    AND "user".id = telegram_user.api_user_id
`.prepare(),

    "setApiUserId": sql`UPDATE telegram_user SET api_user_id = ? WHERE id = ? AND ( api_user_id IS NULL OR api_user_id = ? )`.prepare(),
};

export default Super =>
    class extends Super {

        // public
        async run ( ctx, req ) {

            // already signed-in
            if ( ctx.user.apiUserId ) {
                return this._onComplete( ctx );
            }
            else if ( this.bot.config.telegram.signupEnabled ) {
                return this.#signUp( ctx );
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
            await this.#deleteConfirmationMessage( ctx );

            await ctx.updateState( {
                "email": null,
            } );

            return this.run( ctx );
        }

        async API_signIn ( ctx, token ) {
            CONFIRM: if ( ctx.state.email ) {
                const validToken = crypto
                    .createHmac( "md5", this.bot.telegramBotApi.apiToken )
                    .update( ctx.user.telegramUserId + "/" )
                    .update( ctx.state.email )
                    .digest( "hex" );

                if ( token.toString( "hex" ) === validToken ) {
                    const res = await this.dbh.begin( async dbh => {
                        let userId;

                        const user = await this.app.users.getUserByEmail( ctx.state.email );

                        if ( user ) {
                            userId = user.id;
                        }

                        // create user
                        else {
                            const res = await this.app.users.createUser( ctx.state.email, {
                                "locale": ctx.user.locale,
                                "emailConfirmed": true,
                            } );

                            if ( !res.ok ) throw res;

                            userId = res.data.id;
                        }

                        const res = await this.dbh.do( SQL.setApiUserId, [

                            //
                            userId,
                            ctx.user.telegramUserId,
                            userId,
                        ] );

                        if ( !res.ok ) throw res;

                        if ( !res.meta.rows ) throw `Unable to set user id`;

                        return result( 200, userId );
                    } );

                    if ( !res.ok ) break CONFIRM;

                    // send event
                    const telegramUser = await this.app.notifications?.getTelegramBotUserByApiUserId( res.data );

                    if ( telegramUser ) {
                        this.app.publishToApi( "/notifications/telegram/update/", res.data, telegramUser );
                    }

                    return this._onComplete( ctx );
                }
            }

            await ctx.sendText( this.l10nt( `Confirmation link is not valid. Please, try again.` ) );

            return this.run( ctx );
        }

        // protected
        async _onWaitForEmail ( ctx, req ) {
            EMAIL: if ( req?.message.text && !req.command ) {
                const email = req.message.text.toLowerCase();

                if ( !validateEmail( email ).ok ) {
                    await ctx.sendText( this.l10nt( `Email address is not valid` ) );
                }
                else {
                    if ( !this.bot.config.telegram.signupEnabled ) {
                        const user = await this.app.users.getUserByEmail( email );

                        if ( !user ) {
                            await ctx.sendText( this.l10nt( `This email address is not registered` ) );

                            break EMAIL;
                        }
                    }

                    const res = await this.dbh.selectRow( SQL.getTelegramUserByEmail, [ email ] );

                    // error
                    if ( !res.ok ) {
                        return this.run( ctx );
                    }

                    // email is used
                    if ( res.data?.id ) {
                        await ctx.sendText( this.l10nt( `This email address is already used by the other user` ) );
                    }
                    else {
                        await ctx.updateState( {
                            email,
                        } );

                        return this.#sendConfirmationEmail( ctx );
                    }
                }
            }

            return ctx.sendMessage( {
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

        async _onComplete ( ctx ) {
            const apiUser = await ctx.user.getApiUser();

            await this.#deleteConfirmationMessage( ctx );

            return ctx.sendMessage( {
                "text": this.l10nt( msgid`You are signed in as: ${ apiUser.email }` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": this.createBackButtonText( this.l10nt( `Return to start` ) ),
                                "callback_data": this.encodeCallbackData( "run", "start" ),
                            },
                        ],
                    ],
                },
            } );
        }

        // private
        async #signUp ( ctx ) {
            var userId;

            const email = ctx.user.telegramUserId + "@telegram" + constants.localEmailTld;

            const user = await this.app.users.getUserByEmail( email );

            if ( user ) {
                userId = user.id;
            }
            else {
                const res = await this.app.users.createUser( email, {
                    "locale": ctx.user.locale,
                } );

                userId = res.data.id;
            }

            await this.dbh.do( SQL.setApiUserId, [

                //
                userId,
                ctx.user.telegramUserId,
                userId,
            ] );

            return ctx.run( "start" );
        }

        async #sendConfirmationEmail ( ctx ) {
            const token = crypto
                .createHmac( "md5", this.bot.telegramBotApi.apiToken )
                .update( ctx.user.telegramUserId + "/" )
                .update( ctx.state.email )
                .digest();

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
                        "url": this.createStartUrl( null, "signIn", token ),
                        "telegramBotName": this.bot.name,
                    },
                } )
            );

            return this._onWaitForConfirmation( ctx );
        }

        async #sendWaitForConfirmationMessage ( ctx, message ) {
            await this.#deleteConfirmationMessage( ctx );

            const res = await ctx.sendMessage( {
                "text": this.l10nt( locale =>
                    locale.l10n( msgid`${ Translation.toString( message, { locale } ) }

Yout email address: ${ ctx.state.email }
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

            await ctx.sendDeleteMessage( ctx.state.confirmationMessageId );

            await ctx.updateState( {
                "confirmationMessageId": null,
            } );
        }
    };

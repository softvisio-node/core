import crypto from "node:crypto";
import sql from "#lib/sql";
import { validateEmail } from "#lib/validate";

const SQL = {
    "getTelegramUserByEmail": sql`
SELECT
    telegram_bot_user.telegram_user_id
FROM
    "user",
    telegram_bot_user
WHERE
    "user".email = ?
    AND "user".id = telegram_bot_user.api_user_id
    AND telegram_bot_user.telegram_bot_id = ?
`.prepare(),
};

export default Super =>
    class extends Super {

        // properties
        get commandOrder () {
            return Number.MAX_SAFE_INTEGER;
        }

        // public
        async run ( ctx, message ) {

            // already signed-in
            if ( ctx.user.apiUserId ) {
                return this.#signinComplete( ctx );
            }

            // request email
            else if ( !ctx.state?.email ) {
                return this.#requestEmail( ctx, message );
            }

            // wait for email confirmation
            else {
                return this.#requestEmailConfirmation( ctx );
            }
        }

        getDescription ( ctx ) {
            return l10nt( `your account` );
        }

        async [ "API_resend_confirmatio_email" ] ( ctx ) {

            // signin done
            if ( ctx.user.apiUserId ) return this.#signinComplete( ctx );

            await this.#sendConfirmationEmail( ctx );

            return this.#requestEmailConfirmation( ctx );
        }

        async [ "API_change_email" ] ( ctx ) {

            // signin done
            if ( ctx.user.apiUserId ) return this.#signinComplete( ctx );

            await this.#deleteConfirmationMessage( ctx );

            await this.#setEmail( ctx );

            return ctx.run( this );
        }

        async [ "API_sign_in" ] ( ctx, token ) {

            // signin done
            if ( ctx.user.apiUserId ) return this.#signinComplete( ctx );

            const email = ctx.state?.email;

            CONFIRM: if ( email ) {
                const validToken = this.#createToken( ctx );

                // token is not valie
                if ( token !== validToken ) break CONFIRM;

                const res = await this.dbh.begin( async dbh => {
                    let apiUserId;

                    const apiUser = await this.app.users.getUserByEmail( email, { dbh } );

                    // api user exists
                    if ( apiUser ) {
                        apiUserId = apiUser.id;
                    }

                    // api user not exists
                    else {

                        // sign up is disabled
                        if ( !this.bot.config.telegram.signupEnabled ) {
                            await this.#setEmail( ctx );

                            throw result( [ 500, `Sign up is not enabled` ] );
                        }

                        // create user
                        const res = await this.#createApiUser( ctx, email, {
                            "emailConfirmed": true,
                            dbh,
                        } );

                        if ( !res.ok ) throw res;

                        apiUserId = res.data.id;
                    }

                    // set api user
                    const res = await this.#setApiUserId( ctx, apiUserId, { dbh } );

                    if ( !res.ok ) throw res;

                    return result( 200, apiUserId );
                } );

                if ( !res.ok ) break CONFIRM;

                // send event
                const telegramUser = await this.app.notifications?.getTelegramBotUserByApiUserId( res.data );

                if ( telegramUser ) {
                    this.app.publishToApi( "/notifications/telegram/update/", res.data, telegramUser );
                }

                return ctx.run( this );
            }

            // confirmation failed
            await ctx.sendText( l10nt( `Confirmation link is not valid. Please, try again.` ) );

            return ctx.run( this );
        }

        async [ "API_sign_out" ] ( ctx ) {
            if ( !ctx.user.apiUserId ) return;

            if ( !this.bot.config.telegram.signoutEnabled ) return;

            const res = await this.#setApiUserId( ctx );

            if ( !res.ok ) return;

            return ctx.run( "start" );
        }

        // protected
        async _init () {
            const res = this._registerStartCallback( this.app.telegram.config.signinStartParameterName, "signIn" );
            if ( !res.ok ) return res;

            return super._init();
        }

        // private
        async #requestEmail ( ctx, message ) {
            EMAIL: if ( message?.text ) {
                const email = message.text.toLowerCase();

                // email is not valid
                if ( !validateEmail( email ).ok ) {
                    await ctx.sendText( l10nt( `Email address is not correct` ) );
                }

                // email is valid
                else {

                    // signup is disabled
                    if ( !this.bot.config.telegram.signupEnabled ) {
                        const user = await this.app.users.getUserByEmail( email );

                        // appi user is not exists
                        if ( !user ) {
                            await ctx.sendText( l10nt( `This email address is not registered` ) );

                            break EMAIL;
                        }
                    }

                    const res = await this.dbh.selectRow( SQL.getTelegramUserByEmail, [ email, this.bot.id ] );

                    // error
                    if ( !res.ok ) return ctx.run( this );

                    // email api user already has linked telegram account
                    if ( res.data?.telegram_user_id ) {
                        await ctx.sendText( l10nt( `This email address is already used by the other user` ) );
                    }

                    // set signin email
                    else {
                        await this.#setEmail( ctx, email );

                        return this.#sendConfirmationEmail( ctx );
                    }
                }
            }

            return ctx.sendMessage( {
                "text": l10nt( `To sign in, please, enter yoour email address` ),
            } );
        }

        async #requestEmailConfirmation ( ctx ) {
            await this.#deleteConfirmationMessage( ctx );

            const res = await ctx.sendMessage( {
                "text": l10nt( `To complete sign in, please, click on link which I just sent to your email address.
If you didn't received emaul in several minutes you can send it again.` ),
                "reply_markup": {
                    "inline_keyboard": [
                        [
                            {
                                "text": l10nt( `Send confirmation email again` ),
                                "callback_data": this.createCallbackData( "resend_confirmatio_email" ),
                            },
                        ],
                        [
                            {
                                "text": l10nt( `Change email address` ),
                                "callback_data": this.createCallbackData( "change_email" ),
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

        async #signinComplete ( ctx ) {
            const apiUser = await ctx.user.getApiUser();

            await this.#deleteConfirmationMessage( ctx );

            // clear state
            await ctx.clearState();

            const buttons = [];

            if ( this.bot.config.telegram.signoutEnabled ) {
                buttons.push( [
                    {
                        "text": l10nt( `Sign out` ),
                        "callback_data": this.createCallbackData( "sign_out" ),
                    },
                ] );
            }

            return ctx.sendMessage( {
                "text": l10nt( locale =>
                    locale.l10n( `You are signed in as` ) +
                        `: \`${ apiUser.email }\`
Telegram id: \`${ ctx.user.id }\`` ),
                "parse_mode": "MarkdownV2",
                "reply_markup": {
                    "inline_keyboard": buttons,
                },
            } );
        }

        async #sendConfirmationEmail ( ctx ) {
            const token = this.#createToken( ctx );

            await this.app.notifications.sendEmail(
                ctx.state?.email,
                this.app.templates.get( "telegram/sign-in-email/subject" ).toString( {
                    "localeDomain": ctx.user.id,
                    "data": {
                        "telegramBotName": this.bot.name,
                    },
                } ),
                this.app.templates.get( "telegram/sign-in-email/body" ).toString( {
                    "localeDomain": ctx.user.id,
                    "data": {
                        "url": ctx.createStartUrl( this.app.telegram.config.signinStartParameterName, token ),
                        "telegramBotName": this.bot.name,
                    },
                } )
            );

            return this.#requestEmailConfirmation( ctx );
        }

        async #setEmail ( ctx, email ) {
            return ctx.updateState( {
                "email": email || null,
            } );
        }

        async #deleteConfirmationMessage ( ctx ) {
            if ( !ctx.state?.confirmationMessageId ) return;

            await ctx.user.send( "deleteMessage", { "message_id": ctx.state.confirmationMessageId } );

            await ctx.updateState( {
                "confirmationMessageId": undefined,
            } );
        }

        async #createApiUser ( ctx, email, { emailConfirmed, dbh } = {} ) {
            dbh ||= this.dbh;

            return this.app.users.createUser( email, {
                "locale": ctx.user.locale,
                "emailConfirmed": !!emailConfirmed,
                dbh,
            } );
        }

        async #setApiUserId ( ctx, apiUserId, { dbh } = {} ) {
            const res = await ctx.user.setApiUserId( apiUserId, { dbh } );

            if ( res.ok ) await ctx.updatePermissions();

            return res;
        }

        #createToken ( ctx ) {
            return crypto
                .createHmac( "md5", this.bot.api.apiToken )
                .update( ctx.user.id + "/" )
                .update( ctx.state?.email )
                .digest( "hex" );
        }
    };

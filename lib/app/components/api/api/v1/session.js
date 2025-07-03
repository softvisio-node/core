import constants from "#lib/app/constants";

export default Super =>
    class extends Super {
        #settings;

        // public
        async [ "API_init-session" ] ( ctx, { locale, locales, defaultLocale, forceLocale, detectLocaleByClientIpAddress } = {} ) {
            var permissions;

            if ( ctx.user ) {
                permissions = await this.app.acl.getAclUserPermissions( constants.mainAclId, ctx.user.id );

                // error get ACL user permissions
                if ( !permissions ) return result( [ 500, `Unable to get ACL user permissions` ] );
            }
            else {
                permissions = null;
            }

            return result( 200, {
                "user": ctx.user,
                permissions,
                "settings": await this.#getAppSettings(),
                "locale": this.app.locales.findClientLocale( ctx, locale, locales, {
                    defaultLocale,
                    forceLocale,
                    detectLocaleByClientIpAddress,
                } ),
            } );
        }

        async [ "API_check-authentication" ] ( ctx ) {
            return result( 200 );
        }

        async [ "API_sign-in" ] ( ctx, { email, password, "oauth_provider": oauthProvider, "oauth_code": oauthCode, "oauth_redirect_url": oauthRedirectUrl } ) {
            var user;

            // oauth
            if ( oauthProvider ) {
                user = await this.api.users.authenticateUserOauth( oauthProvider, oauthCode, oauthRedirectUrl );
            }

            // password
            else {
                user = await this.api.users.authenticateUserPassword( email, password );
            }

            // not authenticated
            if ( !user ) return result( 401 );

            // create user session
            const session = await this.api.sessions.createSession( user.id, {
                "hostname": ctx.hostname,
                "remoteAddress": ctx.remoteAddress,
                "userAgent": ctx.userAgent,
            } );

            // unable to create session
            if ( !session.ok ) return session;

            this.#sendNewSigninNotification( user.id, session.data );

            return result( 200, {
                "token": session.data.token,
            } );
        }

        async [ "API_authorize" ] ( ctx, { password, "oauth_provider": oauthProvider, "oauth_code": oauthCode, "oauth_redirect_url": oauthRedirectUrl } = {} ) {
            if ( !ctx.token?.isSessionToken ) return result( 400 );

            var user;

            if ( oauthProvider ) {
                user = await this.api.users.authenticateUserOauth( oauthProvider, oauthCode, oauthRedirectUrl );

                // oauth user email doesn't match current user email
                if ( user && user.email !== ctx.user.email ) return result( 401 );
            }
            else {
                user = await this.api.users.authenticateUserPassword( ctx.user.email, password );
            }

            // not authenticated
            if ( !user ) return result( 401 );

            return this.api.sessions.updateSession( ctx.token.id, ctx.remoteAddress, ctx.userAgent );
        }

        async [ "API_sign-out" ] ( ctx ) {
            if ( !ctx.token?.isSessionToken ) return result( 404 );

            return await this.api.sessions.deleteSession( ctx.token.id, { "userId": ctx.user.id } );
        }

        async [ "API_sign-up" ] ( ctx, email, { password, locale } = {} ) {

            // signup is disabled
            if ( !this.api.config.signupEnabled ) return result( 400 );

            var res;

            // oauth
            if ( typeof email === "object" ) {
                res = await this.api.users.createUserOauth( email.oauth_provider, email.oauth_code, email.oauth_redirect_url, {
                    password,
                    locale,
                } );
            }

            // email
            else {

                // dignup with local email is not allowed
                if ( !this.app.emailIsLocal( email ) ) return result( 400 );

                res = await this.api.users.createUser( email, {
                    password,
                    locale,
                } );
            }

            if ( res.ok ) {

                // sign in if user is enabled
                if ( res.data.enabled ) {
                    return this[ "API_sign-in" ]( ctx, {
                        "email": res.data.email,
                        "password": res.data.password,
                    } );
                }
                else {
                    return result( [ 200, "You were registered" ] );
                }
            }
            else {
                return res;
            }
        }

        async [ "API_send-confirmation-email" ] ( ctx ) {
            if ( ctx.user.isEmailConfirmed ) {
                return result( 200, {
                    "email_confirmed": true,
                } );
            }

            const token = await this.app.actionTokens.createActionToken( ctx.user.id, constants.emailConfirmationToken.id, {
                "lenth": constants.emailConfirmationToken.length,
                "maxAge": constants.emailConfirmationToken.maxAge,
                "emailToken": true,
            } );

            if ( !token.ok ) return token;

            const res = await this.#sendConfirmationEmail( token.data.email, token, ctx.user.locale );

            if ( !res.ok ) return res;

            return result( 200, {
                "email_confirmed": false,
            } );
        }

        async [ "API_confirm-email-by-token" ] ( ctx, token ) {
            const res = await this.app.actionTokens.activateActionToken( token, constants.emailConfirmationToken.id );

            if ( res.ok ) {
                this.app.publishToApi( "/session/email/confirm/", res.data.user_id );
            }

            return res;
        }

        async [ "API_send-password-recovery-email" ] ( ctx, email ) {
            const user = await this.app.users.getUserByEmail( email );
            if ( !user || !user.isEnabled ) return result( [ 404, `User not found` ] );

            const token = await this.app.actionTokens.createActionToken( user.id, constants.passwordResetToken.id, {
                "length": constants.passwordResetToken.length,
                "maxAge": constants.passwordResetToken.maxAge,
                "emailToken": true,
            } );
            if ( !token.ok ) return token;

            return this.#sendPasswordRecoveryEmail( email, token, user.locale );
        }

        async [ "API_set-password-by-token" ] ( ctx, token, password ) {
            return this.dbh.begin( async dbh => {
                let res = await this.app.actionTokens.activateActionToken( token, constants.passwordResetToken.id, {
                    dbh,
                } );
                if ( !res.ok ) throw res;

                const userId = res.data.user_id;

                res = await this.app.users.setUserPassword( userId, password, { dbh } );
                if ( !res.ok ) throw res;

                this.#sendPasswordChangedNotification( userId );

                return res;
            } );
        }

        async [ "API_register-push-notifications-token" ] ( ctx, token ) {
            return this.app.notifications.registerPushNotificationsToken( token, ctx.user.id );
        }

        async [ "API_get-acl-permissions" ] ( ctx, aclId ) {
            const permissions = await this.app.acl.getAclUserPermissions( aclId, ctx.user.id );

            if ( !permissions ) {
                return result( [ 400, `Unable to get ACL user permissions` ] );
            }
            else {
                return result( 200, permissions );
            }
        }

        // protected
        async _getAppSettings () {}

        // private
        async #getAppSettings () {
            if ( !this.#settings ) {
                const components = [];
                if ( this.app.components.has( "telegram" ) ) components.push( "telegram" );

                this.#settings = {
                    "backend_mode": this.app.env.mode,
                    "backend_build_version": this.app.env.buildVersion,

                    "locales": this.app.locales,

                    "passwords_strength": this.app.users.config.passwordsStrength,
                    "signup_enabled": this.api.config.signupEnabled,
                    "internal_notifications_enabled": this.app.notifications.channels.internal.enabled,
                    "push_notifications_supported": this.app.notifications.channels.push.supported,
                    "push_notifications_prefix": this.app.notifications.pushNotificationsPrefix,
                    components,

                    "oauth_google_client_id": this.api.config.oauth?.google?.clientId,
                    "oauth_github_client_id": this.api.config.oauth?.github?.clientId,
                    "oauth_facebook_client_id": this.api.config.oauth?.facebook?.clientId,
                };
            }

            const settings = await this._getAppSettings();

            if ( settings ) {
                return {
                    ...settings,
                    ...this.#settings,
                };
            }
            else {
                return this.#settings;
            }
        }

        async #sendPasswordChangedNotification ( userId ) {
            return this.app.notifications.sendNotification(

                //
                "security",
                userId,
                this.app.templates.get( "api/password-changed/subject" ),
                this.app.templates.get( "api/password-changed/body" )
            );
        }

        async #sendConfirmationEmail ( email, token, userLocale ) {
            return this.app.notifications.sendEmail(
                email,
                this.app.templates.get( "api/confirm-email-token/subject" ).toString( {
                    "localeDomain": userLocale,
                } ),
                this.app.templates.get( "api/confirm-email-token/body" ).toString( {
                    "localeDomain": userLocale,
                    "data": {
                        "url": `${ this.api.config.frontendUrl }#/confirm-email?token=${ token.data.token }`,
                        "tokenExpires": token.data.expires,
                    },
                } )
            );
        }

        async #sendPasswordRecoveryEmail ( email, token, userLocale ) {
            return this.app.notifications.sendEmail(
                email,
                this.app.templates.get( "api/password-recovery-token/subject" ).toString( {
                    "localeDomain": userLocale,
                } ),
                this.app.templates.get( "api/password-recovery-token/body" ).toString( {
                    "localeDomain": userLocale,
                    "data": {
                        "url": `${ this.api.config.frontendUrl }#/reset-password?token=${ token.data.token }`,
                        "tokenExpires": token.data.expires,
                    },
                } )
            );
        }

        async #sendNewSigninNotification ( userId, { userAgent, remoteAddress } ) {
            return this.app.notifications.sendNotification(
                "security",
                userId,
                this.app.templates.get( "api/new-signin/subject" ),
                this.app.templates.get( "api/new-signin/body" ).clone( {
                    "data": {
                        remoteAddress,
                        userAgent,
                    },
                } )
            );
        }
    };

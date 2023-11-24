import StartModule from "#lib/app/components/telegram/telegram/bot/modules/start";

export default Super =>
    class extends StartModule( Super ) {

        // properties
        get commands () {
            return {
                "start": this.l10nt( `Start` ),
                "locale": this.l10nt( `Change language` ),
                "sign_in": "Sign in",
            };
        }

        // public
        async run ( ctx, req ) {
            if ( !ctx.user.apiUserId ) {
                await ctx.sendText( this.app.locale.l10nt( `You are not authorized to use this bot. You need to link your Telegram account in your user profile settings.` ) );

                return ctx.call( "sign_in" );
            }
            else {
                await ctx.sendText( this.app.locale.l10nt( `This is notifications bot. It doesn't support any additional commands.` ) );
            }
        }
    };

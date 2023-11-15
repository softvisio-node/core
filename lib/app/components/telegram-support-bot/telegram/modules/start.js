export default Super =>
    class extends Super {

        // public
        async run ( ctx, req ) {
            if ( !ctx.user.apiUserId ) {
                await ctx.user.sendText( this.app.locale.l10nt( `You are not authorized to use this bot. You need to link your Telegram account in your user profile settings.` ) );
            }
            else {
                await ctx.user.sendText( this.app.locale.l10nt( `This is notifications bot. It doesn't support any additional commands.` ) );
            }
        }
    };

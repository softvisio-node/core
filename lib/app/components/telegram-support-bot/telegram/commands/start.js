import StartModule from "#lib/app/components/telegram/telegram/bot/commands/start";

export default Super =>
    class extends StartModule( Super ) {

        // public
        getCommands ( ctx ) {
            return [

                //
                "start",
                "locale",
                "sign-in",
            ];
        }

        async run ( ctx, req ) {
            await ctx.sendText( this.l10nt( `This is notifications bot. It doesn't support any additional commands.` ) );
        }
    };
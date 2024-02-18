import StartModule from "#lib/app/components/telegram/bot/commands/start";

export default Super =>
    class extends StartModule( Super ) {

        // public
        async run ( ctx, req ) {
            await ctx.sendText( global.l10nt( `This is notifications bot. It doesn't support any additional commands.` ) );
        }
    };

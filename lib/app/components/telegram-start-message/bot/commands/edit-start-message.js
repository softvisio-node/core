import MessageCommand from "#lib/app/components/telegram/bot/commands/message";

export default Super =>
    class extends MessageCommand( Super ) {

        // public
        getDescription ( ctx ) {
            return global.l10nt( `edit start message` );
        }

        checkPermissions ( ctx ) {
            return ctx.permissions.has( "telegram/bot:update" );
        }

        // protected
        async _getMessage ( ctx ) {
            return this.bot.startMessage.getMessage();
        }
    };

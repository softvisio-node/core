import MessageCommand from "#core/app/components/telegram/bot/commands/message";

export default Super =>
    class extends MessageCommand( Super ) {

        // public
        getDescription ( ctx ) {
            return this.l10nt( `edit start message` );
        }

        checkPermissions ( ctx ) {
            return ctx.permissions.has( "telegram/bot:update" );
        }

        // protected
        async _getMessage ( ctx ) {
            return this.bot.startMessage.getMessage();
        }
    };

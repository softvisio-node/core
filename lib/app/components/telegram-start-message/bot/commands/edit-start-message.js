import MessageCommand from "#lib/app/components/telegram/bot/commands/message";

export default Super =>
    class extends MessageCommand( Super ) {

        // public
        getDescription ( ctx ) {
            return l10nt( `edit start message` );
        }

        isEnabled ( ctx ) {
            return ctx.permissions.has( "telegram/bot:update" );
        }

        // protected
        async _getMessage ( ctx ) {
            return this.bot.startMessage.getMessage();
        }
    };

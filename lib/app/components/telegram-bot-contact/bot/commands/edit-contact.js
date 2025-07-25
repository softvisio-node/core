import EditContactCommand from "#lib/app/components/telegram/bot/commands/edit-contact";

export default Super =>
    class extends EditContactCommand( Super ) {

        // public
        isEnabled ( ctx ) {
            return ctx.permissions.has( "telegram/bot:update" );
        }

        getDescription ( ctx ) {
            return l10nt( "edit your contacts" );
        }

        // protected
        async _getContact ( ctx ) {
            return this.bot.getContact();
        }

        async _getFields ( ctx ) {
            return this.bot.config.botContact;
        }
    };

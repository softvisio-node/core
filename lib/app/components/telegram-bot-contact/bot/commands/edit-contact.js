import EditContactCommand from "#lib/app/components/telegram/bot/commands/edit-contact";

export default Super =>
    class extends EditContactCommand( Super ) {

        // protected
        async _getContact ( ctx ) {
            return this.bot.getContact();
        }

        async _getConfig ( ctx ) {
            return this.bot.config.botContact;
        }
    };

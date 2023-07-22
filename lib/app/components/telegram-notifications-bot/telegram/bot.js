import Bot from "#lib/app/components/telegram/telegram/bot";

export default class extends Bot {

    // protected
    async _update ( update ) {
        if ( !update.user.apiUserId ) {
            await update.user.sendMessage( this.locale.l10nt( `You are not authorized to use this bot. You need to link your Telegram account in your user profile settings.` ) );
        }
        else {
            await update.user.sendMessage( this.locale.l10nt( `This is notifications bot. It doesn't support any additional commands.` ) );
        }
    }
}

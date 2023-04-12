import TelegramComponent from "#lib/app/components/telegram/telegram/component";
import Bot from "./telegram/bot.js";

export default class extends TelegramComponent {

    // public
    get Bot () {
        return Bot;
    }

    // protected
    async _init () {
        var res;

        res = await super._init();
        if ( !res.ok ) return res;

        // init db
        // res = await this.dbh.schema.migrate( new URL( "db", import.meta.url ) );
        // if ( !res.ok ) return res;

        return result( 200 );
    }

    async _run () {
        var res;

        res = await super._init();
        if ( !res.ok ) return res;

        return result( 200 );
    }
}

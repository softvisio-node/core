import Component from "#lib/app/components/telegram/telegram/component";
import Bot from "./telegram/bot.js";

export default class extends Component {

    // properties
    get Bot () {
        return Bot;
    }

    // protected
    async _init () {
        var res;

        res = await super._init();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async _createBot ( dbh, id, options ) {
        return super._createBot( dbh, id, options );
    }
}

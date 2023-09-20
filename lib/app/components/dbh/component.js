import Component from "#lib/app/component";
import sql from "#lib/sql";

export default class extends Component {

    // protected
    async _checkEnabled () {
        return !!this.config.uri;
    }

    async _install () {
        return sql.new( this.config.uri );
    }

    async _init () {
        process.stdout.write( "Connecting to the database ... " );

        await this.instance.waitConnect();

        console.log( "connected" );

        return result( 200 );
    }

    async _start () {
        return this.instance.startCron();
    }

    async _shutDown () {
        return this.instance.destroy();
    }
}

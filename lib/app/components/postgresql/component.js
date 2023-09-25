import Component from "#lib/app/component";

export default class extends Component {

    // protected
    async _checkEnabled () {
        return this.isRequired && process.platform === "linux";
    }

    async _install () {
        const postgreSql = await import( "./postgresql.js" );

        return new postgreSql.default( this.app, this.config );
    }

    async _start () {
        return this.instance.start();
    }

    async _shutDown () {
        return this.instance.shutDown();
    }
}

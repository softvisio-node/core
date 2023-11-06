import Component from "#lib/app/component";
import Api from "#lib/app/components/api/api";

export default class extends Component {

    // protected
    async _install () {
        return new Api( this.app, this.config );
    }

    async _configureInstance () {
        const schema = this.components.getSchema( "api" );
        if ( !schema.ok ) return schema;

        return this.instance.configure( schema.data );
    }

    async _init () {
        this.app.templates.addFromFile( new URL( "templates.yaml", import.meta.url ) );

        return this.instance.init();
    }

    async _start () {
        return this.instance.start();
    }

    async _shutDown () {
        await this.instance.shutDown();
    }
}

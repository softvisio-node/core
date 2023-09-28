import Component from "#lib/app/component";

export default class extends Component {

    // protected
    async _install () {
        const Storage = ( await import( `./storage/type/${this.config.type}.js` ) ).default;

        return new Storage( this.app, this.config );
    }

    async _configureInstance () {
        return this.instance.configure();
    }

    async _init () {
        return this.instance.init();
    }

    async _start () {
        return this.instance.start();
    }
}

import Component from "#lib/app/component";

export default class extends Component {

    // protected
    async _install () {
        const Storage = ( await import( `./storage/type/${this.config.type}.js` ) ).default;

        return new Storage( this.app, this.config );
    }

    async _init () {
        return this.value.init();
    }

    async _start () {
        return this.value.start();
    }
}

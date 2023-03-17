import Component from "#lib/app/component";

export default class extends Component {

    // protected
    async _install () {
        const Storage = ( await import( `./storage/${this.config.type}.js` ) ).default;

        return new Storage( this.app, this.config );
    }

    // async _init () {
    //     return this.value.init();
    // }

    // async _run () {
    //     return this.value.run();
    // }
}

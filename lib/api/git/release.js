import SemanticVersion from "#lib/semantic-version";

export default class GitRelease extends SemanticVersion {
    #date;

    constructor ( version, { date } = {} ) {
        super( version );

        if ( date ) {
            this.#date = new Date( date );
        }
    }

    // properties
    get date () {
        return this.#date;
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {
            "version": this.versionString,
            "date": this.#date,
        };

        return "GitRelease: " + inspect( spec );
    }
}

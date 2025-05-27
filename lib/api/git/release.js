import SemanticVersion from "#lib/semantic-version";

export default class GitRelease extends SemanticVersion {
    #date;

    constructor ( version, date ) {
        super( version );

        if ( date ) {
            this.#date = new Date( date );
        }
    }

    // properties
    get date () {
        return this.#date;
    }
}

import GitChange from "./change.js";
import GitCommit from "./commit.js";

export default class GitChanges {
    #changes = [];
    #firstCommit;
    #lastCommit;
    #filteredChanges = {};

    constructor ( commits ) {
        const changes = new Map(),
            hashes = new Map();

        commits = ( commits || [] )
            .map( commit => {
                commit = GitCommit.new( commit );

                hashes.set( commit.hash, false );

                return commit;
            } )
            .sort( ( a, b ) => b.date - a.date );

        // process revert / reapply commits
        for ( const commit of commits ) {

            // commit is ignored
            if ( hashes.get( commit.hash ) ) {
                continue;
            }

            // merge commits
            else if ( commit.isMerge ) {
                hashes.set( commit.hash, true );
            }

            // revert commit
            else if ( commit.isRevert ) {
                if ( commit.revertHash && hashes.has( commit.revertHash ) ) {
                    hashes.set( commit.hash, true );
                    hashes.set( commit.revertHash, true );
                }
            }
        }

        for ( const commit of commits ) {

            // commit is ignored
            if ( hashes.get( commit.hash ) ) continue;

            let change = changes.get( commit.changeId );

            if ( !change ) {
                change = new GitChange( commit );

                changes.set( change.id, change );
            }
            else {
                change.addCommit( commit );
            }

            if ( this.#firstCommit ) {
                if ( this.#firstCommit.date > change.firstCommit.date ) {
                    this.#firstCommit = change.firstCommit;
                }
            }
            else {
                this.#firstCommit = change.firstCommit;
            }

            if ( this.#lastCommit ) {
                if ( this.#lastCommit.date < change.lastCommit.date ) {
                    this.#lastCommit = change.lastCommit;
                }
            }
            else {
                this.#lastCommit = change.lastCommit;
            }
        }

        this.#changes = [ ...changes.values() ].sort( this.constructor.compare );
    }

    // static
    static get compare () {
        return GitChange.compare;
    }

    // properties
    get size () {
        return this.#changes.length;
    }

    get hasChanges () {
        return !!this.#changes.length;
    }

    get firstCommit () {
        return this.#firstCommit;
    }

    get lastCommit () {
        return this.#lastCommit;
    }

    get hasBreakingChanges () {
        return Boolean( this.breakingChanges.length );
    }

    get hasFeatureChanges () {
        return Boolean( this.featureChanges.length );
    }

    get hasFixChanges () {
        return Boolean( this.fixChanges.length );
    }

    get hasOtherChanges () {
        return Boolean( this.otherChanges.length );
    }

    get breakingChanges () {
        this.#filteredChanges.breakingChanges ??= this.getChanges( change => change.isBreakingChange );

        return this.#filteredChanges.breakingChanges;
    }

    get featureChanges () {
        this.#filteredChanges.featureChanges ??= this.getChanges( change => change.isFeature );

        return this.#filteredChanges.featureChanges;
    }

    get featureNonBreakingChanges () {
        this.#filteredChanges.featureNonBreakingChanges ??= this.getChanges( change => change.isFeature && !change.isBreakingChange );

        return this.#filteredChanges.featureNonBreakingChanges;
    }

    get fixChanges () {
        this.#filteredChanges.fixChanges ??= this.getChanges( change => change.isFix );

        return this.#filteredChanges.fixChanges;
    }

    get fixNonBreakingChanges () {
        this.#filteredChanges.fixNonBreakingChanges ??= this.getChanges( change => change.isFix && !change.isBreakingChange );

        return this.#filteredChanges.fixNonBreakingChanges;
    }

    get otherChanges () {
        this.#filteredChanges.otherChanges ??= this.getChanges( change => change.isOther );

        return this.#filteredChanges.otherChanges;
    }

    get otherNonBreakingChanges () {
        this.#filteredChanges.otherNonBreakingChanges ??= this.getChanges( change => change.isOther && !change.isBreakingChange );

        return this.#filteredChanges.otherNonBreakingChanges;
    }

    // public
    getChanges ( filter ) {
        return this.#changes.filter( filter );
    }

    [ Symbol.iterator ] () {
        return this.#changes.values();
    }
}

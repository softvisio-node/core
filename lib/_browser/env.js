class Env {
    #gitId;

    get mode () {
        return process.env.NODE_ENV || "production";
    }

    get isProduction () {
        return !process.env.NODE_ENV || process.env.NODE_ENV === "production";
    }

    get isDevelopment () {
        return process.env.NODE_ENV === "development";
    }

    get isTest () {
        return process.env.NODE_ENV === "test";
    }

    getGitId () {
        if ( this.#gitId === undefined ) {
            try {
                this.#gitId = JSON.parse( process.env.GIT_ID || "" ) || null;
            }
            catch ( e ) {
                this.#gitId = null;
            }
        }

        return this.#gitId;
    }
}

export default new Env();

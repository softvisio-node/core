module.exports = class {
    app = null;
    api = null;
    is_authenticated = false;
    user_id = null;
    user_name = null;

    privateToken = null;

    constructor ( api ) {
        this.api = api;
    }

    async call ( method, ...args ) {}
};

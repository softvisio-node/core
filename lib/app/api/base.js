module.exports = class {
    app = null;
    dbh = null;

    constructor ( options ) {
        this.app = options.app;
        this.dbh = options.app.dbh;
    }
};

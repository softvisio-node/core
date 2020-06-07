module.exports = class {
    app;
    dbh;

    constructor ( options ) {
        this.app = options.app;
        this.dbh = options.app.dbh;
    }
};

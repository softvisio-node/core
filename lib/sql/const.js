export default {
    "reservedEvents": new Set( [

        // events
        "newListener",
        "removeListener",

        // dbh
        "connect",
        "disconnect",
        "destroy",
        "release",
    ] ),

    "migrationTableName": "_schema",
};

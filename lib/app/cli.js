import _CLI from "#lib/cli";

export default class CLI extends _CLI {
    static parse ( spec = {} ) {
        spec = this._findSpec( spec );

        if ( !spec.options ) spec.options = {};

        spec.options.mode = {
            "description": `Set application mode. Set NODE_ENV variable. Allowed values: "production", "development", "test"`,
            "default": "production",
            "schema": {
                "type": "string",
                "enum": ["production", "development", "test"],
            },
        };

        spec.options["reset-settings"] = {
            "short": false,
            "description": `Update application settings from the ".env" files and exit.`,
            "default": false,
            "schema": {
                "type": "boolean",
            },
        };

        spec.options["reset-root"] = {
            "short": false,
            "description": `Set root password from the ".env" files and exit. If root password is not defined in environment it will be randomly generated.`,
            "default": false,
            "schema": {
                "type": "boolean",
            },
        };

        super.parse( spec );
    }
}

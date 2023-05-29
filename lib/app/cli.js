import _CLI from "#lib/cli";
import env from "#lib/env";

export default class CLI extends _CLI {
    static async parse ( spec = {} ) {
        spec = this.findSpec( spec ) || {};

        spec.title ||= env.package.name + " v" + env.package.version;

        spec.options ||= {};

        spec.options.service = {
            "description": `Application service name to run`,
            "schema": {
                "type": "string",
                "format": "kebab-case",
            },
        };

        spec.options.mode = {
            "description": `Set application mode. Set NODE_ENV variable. Allowed values: "production", "development", "test"`,
            "schema": {
                "type": "string",
                "enum": ["production", "development", "test"],
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

        await super.parse( spec );

        // set mode
        if ( process.cli?.options.mode ) env.mode = process.cli.options.mode;
    }
}

const Argument = require('./arguments/argument');

module.exports = class {
    arguments = {};

    #currentPosition = 0;
    #order = [];
    #helpUsage = null;
    #help = null;

    // TODO validate min / mix
    constructor(args) {
        if (!args) return;

        var hasFreePositions = false,
            startPosition = 0;

        for (const name in args) {
            const argument = new Argument(name, args[name], startPosition);

            if (argument.freePositions) {
                if (hasFreePositions) this.throwSpecError(`Unable to add argument "${name}" with free positions.`);

                hasFreePositions = true;
            } else {
                if (argument.endPosition) startPosition += argument.endPosition;
            }

            this.arguments[name] = argument;
            this.#order.push(argument);
        }

		console.log(this);
		process.exit();
    }

    // TODO
    addValue(value) {
        var errors = [];

        // this.#totalArguments++;

        // if (this.#nextArgument == null) {
        //     errors.push(`Unknown argument "${value}"`);
        // } else {
        //     errors.push(...this.#nextArgument.addValue(value));
        // }

        return errors;
    }

    // TODO validate required agrs
    validate() {
        var errors = [];

        return errors;
    }

    throwSpecError(error) {
        console.log(error);

        process.exit(2);
    }

    getValues() {
        var values = {};

        for (const name in this.arguments) {
            values[name] = this.arguments[name].value;
        }

        return values;
    }

    // TODO
    getHelpUsage() {
        if (this.#helpUsage == null) {
            this.#helpUsage = '';
        }

        return this.#helpUsage;
    }

    // TODO
    getHelp() {
        if (this.#help == null) {
            this.#help = '';
        }

        return this.#help;
    }
};
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 45:33         |                              | Parsing error: Private name #nextArgument is not defined                       |
// |       |               |                              |   43 |             errors.push(`Unknown argument "${value}"`);                 |
// |       |               |                              |   44 |         } else {                                                        |
// |       |               |                              | > 45 |             errors.push(...this.#nextArgument.addValue(value));         |
// |       |               |                              |      |                                 ^                                       |
// |       |               |                              |   46 |         }                                                               |
// |       |               |                              |   47 |                                                                         |
// |       |               |                              |   48 |         return errors;                                                  |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----

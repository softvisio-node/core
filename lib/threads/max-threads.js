const Events = require( "events" );
const MaxThreadsMixin = require( "./mixins/max-threads" );

class MaxThreads extends MaxThreadsMixin( Events ) {}

module.exports = MaxThreads;

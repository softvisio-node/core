const EventEmitter = require( "events" );
const MaxThreadsMixin = require( "./mixins/max-threads" );

class MaxThreads extends MaxThreadsMixin( EventEmitter ) {}

module.exports = MaxThreads;

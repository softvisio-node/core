const { mix } = require( "../../mixins" );
const Backend = require( "../backend" );
const Local = require( "./local" );

module.exports = class extends mix( Local, Backend ) {};

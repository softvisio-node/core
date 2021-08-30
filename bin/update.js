#!/usr/bin/env node

import resources from "#lib/hostname/resources";

const res = await resources.update();

if ( !res.ok ) process.exit( 3 );

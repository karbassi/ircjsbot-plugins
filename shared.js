const fmt = require( "util" ).format
    , irc = require( "irc-js" )

// Redis stuff
const TOKEN = "ff774f90da063a0dfa783172f16af4e3"
    , HOST  = "127.0.0.1"
    , PORT  = 6379

// Redis events
const EVENT =
    { ERROR: "error"
    }

// Redis status codes
const STATUS =
    { ERROR: 0
    , SUCCESS: 1
    }

const getKey = function( nick, prefix ) {
  const id = nick instanceof irc.Person ? nick.id : new irc.Person( nick, null, null ).id
      , p = prefix || "IRCJS"
  return p + id
}

const times =
  [ 1000      // Second
  , 60000     // Minute
  , 3600000   // Hour
  , 86400000  // Day
  , 604800000 // Week
  ]           // Right square bracket

const labels = [ "s", "m", "h", "d", "w" ]

/** Input a JS timestamp, get a nice string like "1h 2s", which is the amount of time passed since then.
 *  @param {Date|number}  t     E.g. 1342489409837 from Date.now()
 */
const timeAgo = function( t ) {
  const out = []
  var rem = Date.now() - t
    , idx = times.length
    , cnt = 0
  while ( idx-- ) {
    cnt = ~~( rem / times[ idx ] )
    if ( cnt ) {
      rem -= cnt * times[ idx ]
      out.push( cnt + labels[ idx ] )
    }
  }
  return out.splice( 0, 2 ).join( ' ' )
}

exports.timeAgo = timeAgo

exports.redis =
  { EVENT:  EVENT
  , STATUS: STATUS
  , TOKEN:  TOKEN
  , HOST:   HOST
  , PORT:   PORT
  , key:    getKey
  }
